import math
import json
import pickle
import hashlib
import requests
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

from shapely.geometry import Point, LineString, Polygon
from shapely.ops import transform, nearest_points
from pyproj import Transformer
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


# ==========================
# CONFIGURATION
# ==========================

@dataclass
class Config:
    """Configuration for ski resort analysis"""
    
    # Search radii (in meters)
    RADIUS_LIFTS: int = 500
    RADIUS_RUNS: int = 500
    RADIUS_SKI_SCHOOLS: int = 500
    RADIUS_PASS_OFFICES: int = 500
    RADIUS_RESTAURANTS: int = 500
    RADIUS_SHOPS: int = 500
    RADIUS_TRANSPORT: int = 500
    RADIUS_PARKING: int = 500
    HOTEL_FACILITIES_RADIUS: int = 40
    
    # Maximum search radius for bbox (use the largest)
    @property
    def MAX_RADIUS(self) -> int:
        return max(
            self.RADIUS_LIFTS, self.RADIUS_RUNS, self.RADIUS_SKI_SCHOOLS,
            self.RADIUS_PASS_OFFICES, self.RADIUS_RESTAURANTS, self.RADIUS_SHOPS,
            self.RADIUS_TRANSPORT, self.RADIUS_PARKING
        )
    
    # Scoring weights
    WEIGHT_LIFTS: float = 0.35
    WEIGHT_RUNS: float = 0.25
    WEIGHT_SKI_SCHOOLS: float = 0.10
    WEIGHT_PASS_OFFICE: float = 0.05
    WEIGHT_AMENITIES: float = 0.15
    WEIGHT_TRANSPORT: float = 0.05
    WEIGHT_APRES_SKI: float = 0.05
    
    # Lift type priorities (lower = better)
    LIFT_TYPE_PRIORITY: Dict[str, int] = None
    
    def __post_init__(self):
        if self.LIFT_TYPE_PRIORITY is None:
            self.LIFT_TYPE_PRIORITY = {
                'cable_car': 1,
                'gondola': 2,
                'chair_lift': 3,
                'mixed_lift': 4,
                'drag_lift': 5,
                't-bar': 6,
                'platter': 6,
                'unknown': 7,
            }
    
    # Cache settings
    USE_CACHE: bool = True
    CACHE_DIR: str = '.osm_cache'
    
    # API settings
    OVERPASS_URL: str = "https://overpass-api.de/api/interpreter"
    OVERPASS_TIMEOUT: int = 60
    MAX_RETRIES: int = 3


CONFIG = Config()


# ==========================
# COORDINATE PROJECTION
# ==========================

transformer_to_meters = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
transformer_to_latlon = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)


def project_to_meters(geom):
    """Project WGS84 geometry to Web Mercator (meters)"""
    return transform(lambda x, y: transformer_to_meters.transform(x, y), geom)


def project_to_latlon(geom):
    """Project Web Mercator geometry back to WGS84"""
    return transform(lambda x, y: transformer_to_latlon.transform(x, y), geom)


# ==========================
# GEOMETRY UTILITIES
# ==========================

def build_geom(element: dict) -> Optional[object]:
    """Build Shapely geometry from OSM element"""
    etype = element.get("type")
    if etype == "node":
        return Point(element["lon"], element["lat"])
    elif etype == "way":
        geom_pts = element.get("geometry", [])
        coords = [(p["lon"], p["lat"]) for p in geom_pts]
        if len(coords) < 2:
            return None
        # Closed polygon
        if coords[0] == coords[-1] and len(coords) >= 4:
            try:
                return Polygon(coords)
            except Exception:
                return LineString(coords)
        else:
            return LineString(coords)
    return None


def centroid_latlon(geom_ll) -> Tuple[float, float]:
    """Get centroid as (lat, lon)"""
    c = geom_ll.centroid
    return c.y, c.x


def distance_to_nearest_point(hotel_point_m, geom_ll) -> float:
    """
    Calculate distance from hotel to nearest point on geometry.
    For points: direct distance
    For lines/polygons: distance to nearest point on boundary
    """
    geom_m = project_to_meters(geom_ll)
    return hotel_point_m.distance(geom_m)


def get_nearest_point_coords(hotel_point_m, geom_ll) -> Tuple[float, float]:
    """
    Get coordinates of nearest point on geometry to hotel.
    Returns (lat, lon)
    """
    geom_m = project_to_meters(geom_ll)
    nearest_geom = nearest_points(hotel_point_m, geom_m)[1]
    nearest_ll = project_to_latlon(nearest_geom)
    return nearest_ll.y, nearest_ll.x


# ==========================
# CACHE UTILITIES
# ==========================

def get_cache_path(query: str) -> Path:
    """Generate cache file path for query"""
    cache_dir = Path(CONFIG.CACHE_DIR)
    cache_dir.mkdir(exist_ok=True)
    cache_key = hashlib.md5(query.encode()).hexdigest()
    return cache_dir / f"{cache_key}.pkl"


def load_from_cache(query: str) -> Optional[dict]:
    """Load cached query result"""
    if not CONFIG.USE_CACHE:
        return None
    cache_file = get_cache_path(query)
    if cache_file.exists():
        try:
            with cache_file.open('rb') as f:
                return pickle.load(f)
        except Exception as e:
            print(f"Cache read error: {e}")
            return None
    return None


def save_to_cache(query: str, data: dict):
    """Save query result to cache"""
    if not CONFIG.USE_CACHE:
        return
    cache_file = get_cache_path(query)
    try:
        with cache_file.open('wb') as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"Cache write error: {e}")


# ==========================
# OVERPASS API
# ==========================

@retry(
    retry=retry_if_exception_type((requests.RequestException, requests.Timeout)),
    stop=stop_after_attempt(CONFIG.MAX_RETRIES),
    wait=wait_exponential(min=4, max=10)
)
def query_overpass(query: str) -> dict:
    """Query Overpass API with retry logic"""
    print(f"Querying Overpass API (timeout={CONFIG.OVERPASS_TIMEOUT}s)...")
    try:
        response = requests.post(
            CONFIG.OVERPASS_URL,
            data={"data": query},
            timeout=CONFIG.OVERPASS_TIMEOUT
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
        print(f"Response status: {response.status_code}")
        print(f"Response text: {response.text[:500]}")
        raise


def fetch_osm_data(hotel_lat: float, hotel_lon: float) -> dict:
    """Fetch OSM data with caching"""
    south, west, north, east = make_bbox(hotel_lat, hotel_lon, CONFIG.MAX_RADIUS)
    
    query = f"""
[out:json][timeout:{CONFIG.OVERPASS_TIMEOUT}];
(
  // Lifts: station nodes and ways
  node["aerialway"="station"]({south},{west},{north},{east});
  way["aerialway"~"chair_lift|drag_lift|gondola|cable_car|mixed_lift|t-bar|platter|magic_carpet"]({south},{west},{north},{east});

  // Runs
  way["piste:type"="downhill"]({south},{west},{north},{east});

  // Ski schools
  node["amenity"="ski_school"]({south},{west},{north},{east});
  way["amenity"="ski_school"]({south},{west},{north},{east});

  // Ski pass offices
  node["shop"="ticket"]({south},{west},{north},{east});
  way["shop"="ticket"]({south},{west},{north},{east});
  node["amenity"="ticket_office"]({south},{west},{north},{east});
  way["amenity"="ticket_office"]({south},{west},{north},{east});

  // Public transport
  node["highway"="bus_stop"]({south},{west},{north},{east});
  node["public_transport"="platform"]({south},{west},{north},{east});
  node["amenity"="bus_station"]({south},{west},{north},{east});
  node["railway"="station"]({south},{west},{north},{east});
  node["railway"="halt"]({south},{west},{north},{east});
  node["railway"="tram_stop"]({south},{west},{north},{east});

  // Parking
  node["amenity"="parking"]({south},{west},{north},{east});
  way["amenity"="parking"]({south},{west},{north},{east});

  // Restaurants / bars / nightclubs
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|nightclub)$"]({south},{west},{north},{east});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|nightclub)$"]({south},{west},{north},{east});

  // Shops
  node["shop"]({south},{west},{north},{east});
  way["shop"]({south},{west},{north},{east});

  // Hotels
  node["tourism"~"^(hotel|guest_house|apartment|chalet|hostel|alpine_hut)$"]({south},{west},{north},{east});
  way["tourism"~"^(hotel|guest_house|apartment|chalet|hostel|alpine_hut)$"]({south},{west},{north},{east});

  // Family / relaxation facilities
  node["leisure"~"^(swimming_pool|spa|playground)$"]({south},{west},{north},{east});
  way["leisure"~"^(swimming_pool|spa|playground)$"]({south},{west},{north},{east});
  node["amenity"~"^(spa|sauna|kindergarten)$"]({south},{west},{north},{east});
  way["amenity"~"^(spa|sauna|kindergarten)$"]({south},{west},{north},{east});
  node["social_facility"="childcare"]({south},{west},{north},{east});
  way["social_facility"="childcare"]({south},{west},{north},{east});
);
out geom;
"""
    
    # Check cache
    cached = load_from_cache(query)
    if cached:
        print("Using cached data")
        return cached
    
    # Fetch from API
    try:
        data = query_overpass(query)
        save_to_cache(query, data)
        return data
    except Exception as e:
        print(f"Failed to fetch from Overpass API: {e}")
        raise


def make_bbox(lat: float, lon: float, radius_m: float) -> Tuple[float, float, float, float]:
    """Create bounding box around point"""
    deg_lat = radius_m / 111320.0
    lat_rad = math.radians(lat)
    deg_lon = radius_m / (111320.0 * max(math.cos(lat_rad), 0.01))
    # Add 40% buffer for safety
    deg_lat *= 1.4
    deg_lon *= 1.4
    south = lat - deg_lat
    north = lat + deg_lat
    west = lon - deg_lon
    east = lon + deg_lon
    return south, west, north, east


# ==========================
# FEATURE CLASSIFICATION
# ==========================

def is_ski_school(tags: dict) -> bool:
    """Check if feature is a ski school"""
    if tags.get("amenity") == "ski_school":
        return True
    if tags.get("sport") == "skiing" and tags.get("club") == "sport":
        return True
    name = (tags.get("name") or "").lower()
    if "ski school" in name or "école de ski" in name or "skischule" in name:
        return True
    return False


def is_ski_pass_office(tags: dict) -> bool:
    """Check if feature is a ski pass office"""
    if tags.get("shop") == "ticket" and tags.get("ticket") == "ski_pass":
        return True
    if tags.get("amenity") == "ticket_office" and tags.get("ticket") == "ski_pass":
        return True
    if tags.get("ski_pass") == "yes":
        return True
    name = (tags.get("name") or "").lower()
    if "ski pass" in name or "forfait" in name or "skipass" in name:
        return True
    return False


def is_ski_rental(tags: dict) -> bool:
    """Check if shop offers ski rental"""
    shop = tags.get("shop", "")
    name = (tags.get("name") or "").lower()
    desc = " ".join([
        tags.get("description") or "",
        tags.get("note") or "",
        tags.get("operator") or ""
    ]).lower()
    
    if shop == "ski":
        return True
    if shop in ("sports", "outdoor"):
        keywords = ["ski", "snowboard", "rental", "rent", "hire"]
        text = name + " " + desc
        if any(kw in text for kw in keywords):
            return True
    for key, val in tags.items():
        if "rental" in key.lower() and "ski" in val.lower():
            return True
    return False


def classify_public_transport(tags: dict) -> str:
    """Classify public transport type"""
    if tags.get("amenity") == "bus_station":
        return "bus_station"
    if tags.get("highway") == "bus_stop":
        return "bus_stop"
    if tags.get("railway") == "station":
        return "train_station"
    if tags.get("railway") == "halt":
        return "train_halt"
    if tags.get("railway") == "tram_stop":
        return "tram_stop"
    if tags.get("public_transport") == "platform":
        return "pt_platform"
    return "other"


def classify_food_drink(tags: dict) -> Optional[str]:
    """Classify food/drink establishment"""
    a = tags.get("amenity")
    if a in ("restaurant", "cafe", "fast_food", "bar", "pub", "nightclub"):
        return a
    return None


def get_lift_type(tags: dict) -> str:
    """Get lift type from tags"""
    aerialway = tags.get("aerialway", "")
    if aerialway in CONFIG.LIFT_TYPE_PRIORITY:
        return aerialway
    return "unknown"


def get_run_difficulty(tags: dict) -> str:
    """Get ski run difficulty"""
    return tags.get("piste:difficulty", "unknown")


def run_display_name(tags: dict) -> str:
    """Get display name for ski run"""
    return (
        tags.get("name") or
        tags.get("piste:name") or
        tags.get("ref") or
        "(unnamed)"
    )


def hotel_category(tags: dict) -> Optional[str]:
    """Get hotel category"""
    t = tags.get("tourism")
    if t in ("hotel", "guest_house", "apartment", "chalet", "hostel", "alpine_hut"):
        return t
    return None


# ==========================
# MAIN ANALYZER CLASS
# ==========================

class SkiResortAnalyzer:
    """Analyzes ski resort location for hotel evaluation"""
    
    def __init__(self, hotel_lat: float, hotel_lon: float, hotel_name: str = None):
        self.hotel_lat = hotel_lat
        self.hotel_lon = hotel_lon
        self.hotel_name = hotel_name or f"Hotel at {hotel_lat:.4f}, {hotel_lon:.4f}"
        
        # Create hotel point geometries
        self.hotel_point_ll = Point(hotel_lon, hotel_lat)
        self.hotel_point_m = project_to_meters(self.hotel_point_ll)
        
        # Storage for parsed features
        self.lift_stations = []
        self.lift_ways = []
        self.runs = []
        self.ski_schools = []
        self.pass_offices = []
        self.public_transport = []
        self.parking = []
        self.food_drink = []
        self.shops = []
        self.hotels = []
        self.family_relax = []
        
        # Results
        self.results = {}
    
    def analyze(self) -> dict:
        """Run complete analysis"""
        print(f"\n{'='*60}")
        print(f"Analyzing location: {self.hotel_name}")
        print(f"Coordinates: {self.hotel_lat:.6f}, {self.hotel_lon:.6f}")
        print(f"{'='*60}\n")
        
        # Fetch data
        try:
            data = fetch_osm_data(self.hotel_lat, self.hotel_lon)
            elements = data.get("elements", [])
            print(f"Retrieved {len(elements)} OSM elements\n")
        except Exception as e:
            print(f"ERROR fetching OSM data: {e}")
            raise
        
        # Parse elements
        self._parse_elements(elements)
        
        # Analyze each category
        self.results = {
            "hotel_name": self.hotel_name,
            "hotel_coords": [self.hotel_lat, self.hotel_lon],
            "lifts": self._analyze_lifts(),
            "runs": self._analyze_runs(),
            "ski_schools": self._analyze_ski_schools(),
            "pass_offices": self._analyze_pass_offices(),
            "public_transport": self._analyze_public_transport(),
            "parking": self._analyze_parking(),
            "food_stats": self._analyze_food_drink(),
            "shops": self._analyze_shops(),
            "hotel": self._analyze_hotel(),
        }
        
        # Calculate scores
        self.results["scores"] = self._calculate_scores()
        
        return self.results
    
    def _parse_elements(self, elements: List[dict]):
        """Parse OSM elements into categories"""
        print("Parsing OSM elements...")
        
        for el in elements:
            tags = el.get("tags", {})
            geom_ll = build_geom(el)
            if geom_ll is None:
                continue
            
            lat_c, lon_c = centroid_latlon(geom_ll)
            etype = el.get("type")
            
            # Lifts
            aerialway = tags.get("aerialway")
            if aerialway:
                if etype == "node" and aerialway == "station":
                    self.lift_stations.append({
                        "geom": geom_ll,
                        "tags": tags,
                        "id": el.get("id"),
                        "lat": lat_c,
                        "lon": lon_c,
                    })
                elif etype == "way":
                    self.lift_ways.append({
                        "geom": geom_ll,
                        "tags": tags,
                        "id": el.get("id"),
                        "nodes": el.get("nodes", []),
                        "lat": lat_c,
                        "lon": lon_c,
                    })
            
            # Runs
            if tags.get("piste:type") == "downhill" and etype == "way":
                self.runs.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "id": el.get("id"),
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Ski schools
            if is_ski_school(tags):
                self.ski_schools.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Pass offices
            if is_ski_pass_office(tags):
                self.pass_offices.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Public transport
            if (tags.get("highway") == "bus_stop" or
                tags.get("public_transport") == "platform" or
                tags.get("amenity") == "bus_station" or
                tags.get("railway") in ("station", "halt", "tram_stop")):
                self.public_transport.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Parking
            if tags.get("amenity") == "parking":
                self.parking.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Food & drink
            if classify_food_drink(tags):
                self.food_drink.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Shops
            if "shop" in tags:
                self.shops.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Hotels
            if hotel_category(tags):
                self.hotels.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
            
            # Family facilities
            if (tags.get("leisure") in ("swimming_pool", "spa", "playground") or
                tags.get("amenity") in ("spa", "sauna", "kindergarten") or
                tags.get("social_facility") == "childcare"):
                self.family_relax.append({
                    "geom": geom_ll,
                    "tags": tags,
                    "lat": lat_c,
                    "lon": lon_c,
                })
        
        print(f"  Lifts: {len(self.lift_stations)} stations, {len(self.lift_ways)} ways")
        print(f"  Runs: {len(self.runs)}")
        print(f"  Ski schools: {len(self.ski_schools)}")
        print(f"  Pass offices: {len(self.pass_offices)}")
        print(f"  Transport: {len(self.public_transport)}")
        print(f"  Parking: {len(self.parking)}")
        print(f"  Food/Drink: {len(self.food_drink)}")
        print(f"  Shops: {len(self.shops)}")
        print(f"  Hotels: {len(self.hotels)}")
        print()
    
    def _analyze_lifts(self) -> dict:
        """Analyze nearby ski lifts"""
        print("Analyzing lifts...")
        
        # Map station nodes to their parent ways to get lift types
        node_to_lift_types = defaultdict(set)
        node_to_lift_names = defaultdict(set)
        
        for way in self.lift_ways:
            lift_type = get_lift_type(way["tags"])
            lift_name = way["tags"].get("name", "")
            for nid in way.get("nodes", []):
                node_to_lift_types[nid].add(lift_type)
                if lift_name:
                    node_to_lift_names[nid].add(lift_name)
        
        # Analyze lift stations only (not ways)
        lift_candidates = []
        
        for station in self.lift_stations:
            dist = distance_to_nearest_point(self.hotel_point_m, station["geom"])
            if dist > CONFIG.RADIUS_LIFTS:
                continue
            
            tags = station["tags"]
            station_id = station["id"]
            
            # Get lift type from parent ways
            lift_types = node_to_lift_types.get(station_id, set())
            lift_type = sorted(lift_types)[0] if lift_types else "unknown"
            
            # Get name from station or parent ways
            name = tags.get("name")
            if not name:
                parent_names = node_to_lift_names.get(station_id, set())
                name = sorted(parent_names)[0] if parent_names else "(unnamed lift)"
            
            # Determine station type (entry/exit/other)
            station_type = None
            aerialway_access = tags.get("aerialway:access")
            if aerialway_access == "entry":
                station_type = "entry"
            elif aerialway_access == "exit":
                station_type = "exit"
            elif tags.get("station") == "valley":
                station_type = "entry"
            
            lift_candidates.append({
                "name": name,
                "type": lift_type,
                "station_type": station_type,
                "distance_m": round(dist, 1),
                "distance_note": "to lift station",
                "priority": CONFIG.LIFT_TYPE_PRIORITY.get(lift_type, 999),
                "coords": [station["lat"], station["lon"]],
            })
        
        # Deduplicate by name - keep closest station for each lift
        seen_names = {}
        for lift in lift_candidates:
            key = lift["name"].lower()
            if key not in seen_names or lift["distance_m"] < seen_names[key]["distance_m"]:
                seen_names[key] = lift
        
        unique_lifts = list(seen_names.values())
        unique_lifts.sort(key=lambda x: (x["distance_m"], x["priority"]))
        
        return {
            "nearest_3": unique_lifts[:3],
            "total_within_radius": len(unique_lifts),
            "search_radius_m": CONFIG.RADIUS_LIFTS,
        }
    
    def _analyze_runs(self) -> dict:
        """Analyze nearby ski runs"""
        print("Analyzing runs...")
        
        candidates = []
        
        for run in self.runs:
            dist_nearest = distance_to_nearest_point(self.hotel_point_m, run["geom"])
            if dist_nearest > CONFIG.RADIUS_RUNS:
                continue
            
            tags = run["tags"]
            name = run_display_name(tags)
            difficulty = get_run_difficulty(tags)
            
            nearest_lat, nearest_lon = get_nearest_point_coords(
                self.hotel_point_m, run["geom"]
            )
            
            candidates.append({
                "name": name,
                "difficulty": difficulty,
                "distance_m": round(dist_nearest, 1),
                "distance_note": "to nearest point on run",
                "nearest_point_coords": [nearest_lat, nearest_lon],
                "centroid_coords": [run["lat"], run["lon"]],
            })
        
        # Deduplicate by name
        candidates.sort(key=lambda x: x["distance_m"])
        seen = set()
        unique = []
        difficulty_counts = defaultdict(int)
        
        for c in candidates:
            key = c["name"].lower()
            if key not in seen:
                seen.add(key)
                unique.append(c)
                difficulty_counts[c["difficulty"]] += 1
        
        return {
            "nearest_3": unique[:3],
            "total_within_radius": len(unique),
            "difficulty_distribution": dict(difficulty_counts),
            "search_radius_m": CONFIG.RADIUS_RUNS,
        }
    
    def _analyze_ski_schools(self) -> dict:
        """Analyze nearby ski schools"""
        print("Analyzing ski schools...")
        
        candidates = []
        for school in self.ski_schools:
            dist_nearest = distance_to_nearest_point(self.hotel_point_m, school["geom"])
            if dist_nearest > CONFIG.RADIUS_SKI_SCHOOLS:
                continue
            
            tags = school["tags"]
            nearest_lat, nearest_lon = get_nearest_point_coords(
                self.hotel_point_m, school["geom"]
            )
            
            candidates.append({
                "name": tags.get("name") or "(unnamed ski school)",
                "distance_m": round(dist_nearest, 1),
                "phone": tags.get("phone"),
                "website": tags.get("website"),
                "coords": [nearest_lat, nearest_lon],
            })
        
        candidates.sort(key=lambda x: x["distance_m"])
        
        # Check if hotel has ski school
        hotel_has_ski_school = any(
            distance_to_nearest_point(self.hotel_point_m, s["geom"]) <= CONFIG.HOTEL_FACILITIES_RADIUS
            for s in self.ski_schools
        )
        
        return {
            "nearest_3": candidates[:3],
            "total_within_radius": len(candidates),
            "hotel_has_ski_school": hotel_has_ski_school,
            "search_radius_m": CONFIG.RADIUS_SKI_SCHOOLS,
        }
    
    def _analyze_pass_offices(self) -> dict:
        """Analyze nearby ski pass offices"""
        print("Analyzing ski pass offices...")
        
        candidates = []
        for office in self.pass_offices:
            dist_nearest = distance_to_nearest_point(self.hotel_point_m, office["geom"])
            if dist_nearest > CONFIG.RADIUS_PASS_OFFICES:
                continue
            
            tags = office["tags"]
            nearest_lat, nearest_lon = get_nearest_point_coords(
                self.hotel_point_m, office["geom"]
            )
            
            candidates.append({
                "name": tags.get("name") or "(ski pass office)",
                "distance_m": round(dist_nearest, 1),
                "opening_hours": tags.get("opening_hours"),
                "coords": [nearest_lat, nearest_lon],
            })
        
        candidates.sort(key=lambda x: x["distance_m"])
        
        # Check if hotel has pass office
        hotel_has_pass_office = any(
            distance_to_nearest_point(self.hotel_point_m, o["geom"]) <= CONFIG.HOTEL_FACILITIES_RADIUS
            for o in self.pass_offices
        )
        
        return {
            "nearest_3": candidates[:3],
            "total_within_radius": len(candidates),
            "hotel_has_pass_office": hotel_has_pass_office,
            "search_radius_m": CONFIG.RADIUS_PASS_OFFICES,
        }
    
    def _analyze_public_transport(self) -> dict:
        """Analyze nearby public transport"""
        print("Analyzing public transport...")
        
        results = []
        for pt in self.public_transport:
            dist = distance_to_nearest_point(self.hotel_point_m, pt["geom"])
            if dist > CONFIG.RADIUS_TRANSPORT:
                continue
            
            tags = pt["tags"]
            results.append({
                "name": tags.get("name"),
                "type": classify_public_transport(tags),
                "distance_m": round(dist, 1),
                "coords": [pt["lat"], pt["lon"]],
            })
        
        results.sort(key=lambda x: x["distance_m"])
        
        return {
            "stops": results,
            "total_within_radius": len(results),
            "search_radius_m": CONFIG.RADIUS_TRANSPORT,
        }
    
    def _analyze_parking(self) -> dict:
        """Analyze nearby parking"""
        print("Analyzing parking...")
        
        results = []
        for p in self.parking:
            dist = distance_to_nearest_point(self.hotel_point_m, p["geom"])
            if dist > CONFIG.RADIUS_PARKING:
                continue
            
            tags = p["tags"]
            name = tags.get("name")
            
            # Skip parking without names
            if not name:
                continue
            
            results.append({
                "name": name,
                "type": "parking",
                "distance_m": round(dist, 1),
                "fee": tags.get("fee"),
                "capacity": tags.get("capacity"),
                "coords": [p["lat"], p["lon"]],
            })
        
        results.sort(key=lambda x: x["distance_m"])
        
        return {
            "lots": results,
            "total_within_radius": len(results),
            "search_radius_m": CONFIG.RADIUS_PARKING,
        }
    
    def _analyze_food_drink(self) -> dict:
        """Analyze food and drink establishments"""
        print("Analyzing food/drink...")
        
        restaurants_like = 0
        bars_like = 0
        nightclubs = 0
        
        for f in self.food_drink:
            dist = distance_to_nearest_point(self.hotel_point_m, f["geom"])
            if dist > CONFIG.RADIUS_RESTAURANTS:
                continue
            
            cat = classify_food_drink(f["tags"])
            if cat in ("restaurant", "cafe", "fast_food"):
                restaurants_like += 1
            if cat in ("bar", "pub"):
                bars_like += 1
            if cat == "nightclub":
                nightclubs += 1
        
        return {
            "restaurants_like": restaurants_like,
            "bars_like": bars_like,
            "nightclubs": nightclubs,
            "nightlife_total": bars_like + nightclubs,
            "search_radius_m": CONFIG.RADIUS_RESTAURANTS,
        }
    
    def _analyze_shops(self) -> dict:
        """Analyze nearby shops"""
        print("Analyzing shops...")
        
        shops_list = []
        ski_rental_count = 0
        
        for s in self.shops:
            dist = distance_to_nearest_point(self.hotel_point_m, s["geom"])
            if dist > CONFIG.RADIUS_SHOPS:
                continue
            
            tags = s["tags"]
            is_rental = is_ski_rental(tags)
            if is_rental:
                ski_rental_count += 1
            
            shops_list.append({
                "name": tags.get("name"),
                "shop": tags.get("shop"),
                "is_ski_rental": is_rental,
                "distance_m": round(dist, 1),
                "coords": [s["lat"], s["lon"]],
            })
        
        shops_list.sort(key=lambda x: x["distance_m"])
        
        return {
            "total_shops": len(shops_list),
            "ski_rental_count": ski_rental_count,
            "shops_list": shops_list,
            "search_radius_m": CONFIG.RADIUS_SHOPS,
        }
    
    def _analyze_hotel(self) -> dict:
        """Analyze hotel object and facilities"""
        print("Analyzing hotel facilities...")
        
        # Find closest hotel object
        hotel_obj = None
        best_dist = None
        for h in self.hotels:
            dist = distance_to_nearest_point(self.hotel_point_m, h["geom"])
            if best_dist is None or dist < best_dist:
                hotel_obj = h
                best_dist = dist
        
        info = {
            "name": None,
            "category": None,
            "stars": None,
            "distance_m": None,
            "coords": None,
            "has_spa": False,
            "has_pool": False,
            "has_sauna": False,
            "has_playground": False,
            "has_childcare": False,
        }
        
        if hotel_obj and best_dist <= 60:
            tags = hotel_obj["tags"]
            info.update({
                "name": tags.get("name"),
                "category": hotel_category(tags),
                "stars": tags.get("stars"),
                "distance_m": round(best_dist, 1),
                "coords": [hotel_obj["lat"], hotel_obj["lon"]],
            })
            
            # Check for facilities at hotel
            hotel_geom_m = project_to_meters(hotel_obj["geom"])
            
            for f in self.family_relax:
                f_geom_m = project_to_meters(f["geom"])
                dist = hotel_geom_m.distance(f_geom_m)
                if dist > CONFIG.HOTEL_FACILITIES_RADIUS:
                    continue
                
                tags = f["tags"]
                leisure = tags.get("leisure")
                amenity = tags.get("amenity")
                social = tags.get("social_facility")
                
                if leisure == "swimming_pool":
                    info["has_pool"] = True
                if leisure == "spa" or amenity == "spa":
                    info["has_spa"] = True
                if amenity == "sauna":
                    info["has_sauna"] = True
                if leisure == "playground":
                    info["has_playground"] = True
                if amenity == "kindergarten" or social == "childcare":
                    info["has_childcare"] = True
        
        return info
    
    def _calculate_scores(self) -> dict:
        """Calculate location quality scores"""
        print("Calculating location scores...")
        
        scores = {
            "lifts": 0,
            "runs": 0,
            "ski_schools": 0,
            "pass_office": 0,
            "amenities": 0,
            "transport": 0,
            "apres_ski": 0,
        }
        
        # Lifts score (0-100)
        lifts = self.results["lifts"]["nearest_3"]
        if lifts:
            closest_dist = lifts[0]["distance_m"]
            lift_type_quality = 100 - (lifts[0]["priority"] * 10)
            
            if closest_dist < 100:
                dist_score = 100
            elif closest_dist < 200:
                dist_score = 80
            elif closest_dist < 350:
                dist_score = 60
            elif closest_dist < 500:
                dist_score = 40
            else:
                dist_score = 20
            
            # Bonus for multiple lifts
            quantity_bonus = min(len(lifts) * 5, 20)
            
            scores["lifts"] = min(
                (dist_score * 0.6) + (lift_type_quality * 0.3) + quantity_bonus,
                100
            )
        
        # Runs score (0-100)
        runs = self.results["runs"]["nearest_3"]
        if runs:
            closest_dist = runs[0]["distance_m"]
            
            if closest_dist < 50:
                dist_score = 100
            elif closest_dist < 150:
                dist_score = 80
            elif closest_dist < 300:
                dist_score = 60
            elif closest_dist < 500:
                dist_score = 40
            else:
                dist_score = 20
            
            # Variety bonus
            variety_score = min(len(runs) * 15, 40)
            
            scores["runs"] = min(dist_score * 0.7 + variety_score, 100)
        
        # Ski schools score (0-100)
        ski_schools = self.results["ski_schools"]
        if ski_schools["hotel_has_ski_school"]:
            scores["ski_schools"] = 100
        elif ski_schools["total_within_radius"] > 0:
            closest = ski_schools["nearest_3"][0]["distance_m"]
            if closest < 200:
                scores["ski_schools"] = 80
            elif closest < 400:
                scores["ski_schools"] = 60
            else:
                scores["ski_schools"] = 40
        
        # Pass office score (0-100)
        pass_offices = self.results["pass_offices"]
        if pass_offices["hotel_has_pass_office"]:
            scores["pass_office"] = 100
        elif pass_offices["total_within_radius"] > 0:
            closest = pass_offices["nearest_3"][0]["distance_m"]
            if closest < 200:
                scores["pass_office"] = 80
            elif closest < 400:
                scores["pass_office"] = 60
            else:
                scores["pass_office"] = 40
        
        # Amenities score (0-100)
        shops = self.results["shops"]
        hotel = self.results["hotel"]
        amenity_points = 0
        amenity_points += min(shops["ski_rental_count"] * 20, 40)
        amenity_points += min(shops["total_shops"] * 2, 20)
        if hotel["has_spa"]:
            amenity_points += 15
        if hotel["has_pool"]:
            amenity_points += 15
        if hotel["has_childcare"]:
            amenity_points += 10
        scores["amenities"] = min(amenity_points, 100)
        
        # Transport score (0-100)
        transport = self.results["public_transport"]
        parking = self.results["parking"]
        transport_points = 0
        if transport["total_within_radius"] > 0:
            transport_points += 50
        if parking["total_within_radius"] > 0:
            transport_points += 50
        scores["transport"] = transport_points
        
        # Après-ski score (0-100)
        food = self.results["food_stats"]
        apres_points = 0
        apres_points += min(food["restaurants_like"] * 8, 40)
        apres_points += min(food["bars_like"] * 10, 40)
        apres_points += min(food["nightclubs"] * 20, 20)
        scores["apres_ski"] = min(apres_points, 100)
        
        # Overall weighted score
        overall = (
            scores["lifts"] * CONFIG.WEIGHT_LIFTS +
            scores["runs"] * CONFIG.WEIGHT_RUNS +
            scores["ski_schools"] * CONFIG.WEIGHT_SKI_SCHOOLS +
            scores["pass_office"] * CONFIG.WEIGHT_PASS_OFFICE +
            scores["amenities"] * CONFIG.WEIGHT_AMENITIES +
            scores["transport"] * CONFIG.WEIGHT_TRANSPORT +
            scores["apres_ski"] * CONFIG.WEIGHT_APRES_SKI
        )
        
        scores["overall"] = round(overall, 1)
        
        # Rating
        if overall >= 80:
            rating = "Excellent"
        elif overall >= 65:
            rating = "Very Good"
        elif overall >= 50:
            rating = "Good"
        elif overall >= 35:
            rating = "Average"
        else:
            rating = "Below Average"
        
        scores["rating"] = rating
        
        return scores


# ==========================
# COMPARATIVE ANALYSIS
# ==========================

def compare_locations(analyzers: List[SkiResortAnalyzer]) -> dict:
    """Compare multiple hotel locations"""
    print(f"\n{'='*60}")
    print("COMPARATIVE ANALYSIS")
    print(f"{'='*60}\n")
    
    if not analyzers:
        return {}
    
    results = [a.results for a in analyzers]
    
    # Rankings by category
    rankings = {
        "by_overall_score": [],
        "by_lift_proximity": [],
        "by_run_proximity": [],
        "by_ski_school": [],
        "by_apres_ski": [],
        "by_family_friendly": [],
    }
    
    # Overall score ranking
    ranked_overall = sorted(
        results,
        key=lambda x: x["scores"]["overall"],
        reverse=True
    )
    for i, r in enumerate(ranked_overall, 1):
        rankings["by_overall_score"].append({
            "rank": i,
            "hotel_name": r["hotel_name"],
            "score": r["scores"]["overall"],
            "rating": r["scores"]["rating"],
        })
    
    # Lift proximity ranking
    ranked_lifts = sorted(
        results,
        key=lambda x: (
            len(x["lifts"]["nearest_3"]) > 0,
            -x["lifts"]["nearest_3"][0]["distance_m"] if x["lifts"]["nearest_3"] else float('inf')
        ),
        reverse=True
    )
    for i, r in enumerate(ranked_lifts, 1):
        lift_dist = r["lifts"]["nearest_3"][0]["distance_m"] if r["lifts"]["nearest_3"] else None
        rankings["by_lift_proximity"].append({
            "rank": i,
            "hotel_name": r["hotel_name"],
            "closest_lift_distance_m": lift_dist,
            "lift_count": r["lifts"]["total_within_radius"],
        })
    
    # Run proximity ranking
    ranked_runs = sorted(
        results,
        key=lambda x: (
            len(x["runs"]["nearest_3"]) > 0,
            -x["runs"]["nearest_3"][0]["distance_m"] if x["runs"]["nearest_3"] else float('inf')
        ),
        reverse=True
    )
    for i, r in enumerate(ranked_runs, 1):
        run_dist = r["runs"]["nearest_3"][0]["distance_m"] if r["runs"]["nearest_3"] else None
        rankings["by_run_proximity"].append({
            "rank": i,
            "hotel_name": r["hotel_name"],
            "closest_run_distance_m": run_dist,
            "run_count": r["runs"]["total_within_radius"],
        })
    
    # Ski school ranking
    ranked_schools = sorted(
        results,
        key=lambda x: (
            x["ski_schools"]["hotel_has_ski_school"],
            x["ski_schools"]["total_within_radius"]
        ),
        reverse=True
    )
    for i, r in enumerate(ranked_schools, 1):
        rankings["by_ski_school"].append({
            "rank": i,
            "hotel_name": r["hotel_name"],
            "has_ski_school_at_hotel": r["ski_schools"]["hotel_has_ski_school"],
            "nearby_ski_schools": r["ski_schools"]["total_within_radius"],
        })
    
    # Après-ski ranking
    ranked_apres = sorted(
        results,
        key=lambda x: x["scores"]["apres_ski"],
        reverse=True
    )
    for i, r in enumerate(ranked_apres, 1):
        rankings["by_apres_ski"].append({
            "rank": i,
            "hotel_name": r["hotel_name"],
            "apres_ski_score": r["scores"]["apres_ski"],
            "nightlife_total": r["food_stats"]["nightlife_total"],
        })
    
    # Family-friendly ranking
    ranked_family = sorted(
        results,
        key=lambda x: (
            x["hotel"]["has_childcare"],
            x["hotel"]["has_pool"],
            x["hotel"]["has_playground"],
            x["ski_schools"]["hotel_has_ski_school"]
        ),
        reverse=True
    )
    for i, r in enumerate(ranked_family, 1):
        family_features = sum([
            r["hotel"]["has_childcare"],
            r["hotel"]["has_pool"],
            r["hotel"]["has_playground"],
            r["ski_schools"]["hotel_has_ski_school"],
        ])
        rankings["by_family_friendly"].append({
            "rank": i,
            "hotel_name": r["hotel_name"],
            "family_features_count": family_features,
            "has_childcare": r["hotel"]["has_childcare"],
            "has_pool": r["hotel"]["has_pool"],
        })
    
    # Best for different traveler types
    recommendations = {
        "best_overall": ranked_overall[0]["hotel_name"],
        "best_for_skiing": ranked_lifts[0]["hotel_name"],
        "best_for_families": ranked_family[0]["hotel_name"],
        "best_for_nightlife": ranked_apres[0]["hotel_name"],
    }
    
    return {
        "total_locations_compared": len(results),
        "rankings": rankings,
        "recommendations": recommendations,
    }


# ==========================
# MAIN EXECUTION
# ==========================

def main():
    """Main execution function"""
    
    # Example: Single location analysis
    hotel_coords = [
        (45.29793969030922, 6.5832264545347305, "Hotel Example 1"),
        # Add more hotels here for comparison:
        # (45.298, 6.584, "Hotel Example 2"),
    ]
    
    analyzers = []
    for lat, lon, name in hotel_coords:
        try:
            analyzer = SkiResortAnalyzer(lat, lon, name)
            analyzer.analyze()
            analyzers.append(analyzer)
        except Exception as e:
            print(f"ERROR analyzing {name}: {e}\n")
            continue
    
    if not analyzers:
        print("No locations successfully analyzed.")
        return
    
    # Print JSON results for each location
    for analyzer in analyzers:
        print("\n" + "="*60)
        print(f"JSON OUTPUT: {analyzer.results['hotel_name']}")
        print("="*60)
        print(json.dumps(analyzer.results, indent=2, ensure_ascii=False))
    
    # Comparative analysis if multiple locations
    if len(analyzers) > 1:
        comparison = compare_locations(analyzers)
        
        print("\n" + "="*60)
        print("COMPARATIVE ANALYSIS JSON")
        print("="*60)
        print(json.dumps(comparison, indent=2, ensure_ascii=False))
        
        # Export comparison
        with open('comparison_results.json', 'w') as f:
            json.dump(comparison, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Detailed comparison saved to comparison_results.json")
    
    # Export detailed results for each location
    for analyzer in analyzers:
        filename = f"results_{analyzer.hotel_name.replace(' ', '_').lower()}.json"
        with open(filename, 'w') as f:
            json.dump(analyzer.results, f, indent=2, ensure_ascii=False)
        print(f"✓ Detailed results saved to {filename}")
    
    print(f"\n{'='*60}")
    print("Analysis complete!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()