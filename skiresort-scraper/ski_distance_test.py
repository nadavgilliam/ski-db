import math
import json
import requests
from collections import defaultdict

from shapely.geometry import Point, LineString, Polygon
from shapely.ops import transform
from pyproj import Transformer

# ==========================
# 1. CONFIG
# ==========================

# Your hotel coordinates
HOTEL_LAT = 45.29793969030922
HOTEL_LON = 6.5832264545347305

# Radius for most checks (in meters)
RADIUS_M = 500

# Small radius for "at the hotel" facilities (in meters)
HOTEL_RADIUS_M = 40


# ==========================
# 2. GEO HELPERS
# ==========================

transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

def project_geom(geom):
    return transform(lambda x, y: transformer.transform(x, y), geom)

hotel_point_ll = Point(HOTEL_LON, HOTEL_LAT)
hotel_point_m = project_geom(hotel_point_ll)

def distance_m(geom_ll):
    geom_m = project_geom(geom_ll)
    return hotel_point_m.distance(geom_m)


def make_bbox(lat, lon, radius_m):
    deg_lat = radius_m / 111320.0
    lat_rad = math.radians(lat)
    deg_lon = radius_m / (111320.0 * max(math.cos(lat_rad), 0.01))
    deg_lat *= 1.4
    deg_lon *= 1.4
    south = lat - deg_lat
    north = lat + deg_lat
    west = lon - deg_lon
    east = lon + deg_lon
    return south, west, north, east


south, west, north, east = make_bbox(HOTEL_LAT, HOTEL_LON, RADIUS_M)

# ==========================
# 3. OVERPASS QUERY
# ==========================

overpass_url = "https://overpass-api.de/api/interpreter"

query = f"""
[out:json][timeout:30];
(
  // Lifts: only station nodes as candidates; ways just for metadata
  node["aerialway"="station"]({south},{west},{north},{east});
  way["aerialway"]({south},{west},{north},{east});

  // Runs
  way["piste:type"="downhill"]({south},{west},{north},{east});

  // Public transport
  node["highway"="bus_stop"]({south},{west},{north},{east});
  node["public_transport"="platform"]({south},{west},{north},{east});
  node["public_transport"="stop_position"]({south},{west},{north},{east});
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

  // Family / relaxation near hotel
  node["leisure"~"^(swimming_pool|spa|playground)$"]({south},{west},{north},{east});
  way["leisure"~"^(swimming_pool|spa|playground)$"]({south},{west},{north},{east});
  node["amenity"~"^(spa|sauna|kindergarten)$"]({south},{west},{north},{east});
  way["amenity"~"^(spa|sauna|kindergarten)$"]({south},{west},{north},{east});
  node["social_facility"="childcare"]({south},{west},{north},{east});
  way["social_facility"="childcare"]({south},{west},{north},{east});
);
out geom;
"""

print("Querying Overpass API...")
response = requests.post(overpass_url, data={"data": query})
response.raise_for_status()
data = response.json()
elements = data.get("elements", [])
print(f"Got {len(elements)} OSM elements")


# ==========================
# 4. PARSE ELEMENTS
# ==========================

lift_station_candidates = []  # station nodes
lift_way_metadata = []        # aerialway ways for type lookup

run_features = []
public_transport_points = []
parking_features = []
food_drink_features = []
shop_features = []
hotel_candidates = []
family_relax_features = []

def build_geom(el):
    etype = el.get("type")
    if etype == "node":
        return Point(el["lon"], el["lat"])
    elif etype == "way":
        geom_pts = el.get("geometry", [])
        coords = [(p["lon"], p["lat"]) for p in geom_pts]
        if len(coords) < 2:
            return None
        if coords[0] == coords[-1] and len(coords) >= 4:
            try:
                return Polygon(coords)
            except Exception:
                return LineString(coords)
        else:
            return LineString(coords)
    return None

def centroid_latlon(geom_ll):
    c = geom_ll.centroid
    return c.y, c.x  # lat, lon

def classify_public_transport(tags):
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
    if tags.get("public_transport") == "stop_position":
        return "pt_stop_position"
    return "other"

def classify_parking(tags):
    if tags.get("amenity") == "parking":
        return "parking"
    return None

def classify_food_drink(tags):
    a = tags.get("amenity")
    if a in ("restaurant", "cafe", "fast_food", "bar", "pub", "nightclub"):
        return a
    return None

def is_ski_rental(tags):
    shop = tags.get("shop", "")
    name = (tags.get("name") or "").lower()
    desc = " ".join(
        (tags.get("description") or "",
         tags.get("note") or "",
         tags.get("operator") or "")
    ).lower()
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

def run_display_name(tags):
    return (
        tags.get("name")
        or tags.get("piste:name")
        or tags.get("ref")
        or "(no name)"
    )

def hotel_category(tags):
    t = tags.get("tourism")
    if t in ("hotel", "guest_house", "apartment", "chalet", "hostel", "alpine_hut"):
        return t
    return None

for el in elements:
    tags = el.get("tags", {})
    geom_ll = build_geom(el)
    if geom_ll is None:
        continue
    lat_c, lon_c = centroid_latlon(geom_ll)

    etype = el.get("type")
    aerialway_tag = tags.get("aerialway")

    # Lifts: station nodes vs ways
    if aerialway_tag:
        if etype == "node" and aerialway_tag == "station":
            # classify station kind
            if tags.get("station") == "valley":
                kind = "valley_station"
            else:
                access = tags.get("aerialway:access")
                if access == "entry":
                    kind = "entry_station"
                elif access == "exit":
                    kind = "exit_station"
                else:
                    kind = "station"
            lift_station_candidates.append({
                "geom": geom_ll,
                "tags": tags,
                "kind": kind,
                "id": el.get("id"),
                "lat": lat_c,
                "lon": lon_c,
            })
        elif etype == "way":
            # parent ways to infer lift type from
            lift_way_metadata.append({
                "id": el.get("id"),
                "tags": tags,
                "nodes": el.get("nodes", []),
            })

    # Runs
    if tags.get("piste:type") == "downhill" and etype == "way":
        run_features.append({
            "geom": geom_ll,
            "tags": tags,
            "id": el.get("id"),
            "lat": lat_c,
            "lon": lon_c,
        })

    # Public transport
    if (tags.get("highway") == "bus_stop"
        or tags.get("public_transport") in ("platform", "stop_position")
        or tags.get("amenity") == "bus_station"
        or tags.get("railway") in ("station", "halt", "tram_stop")):
        public_transport_points.append({
            "geom": geom_ll,
            "tags": tags,
            "lat": lat_c,
            "lon": lon_c,
        })

    # Parking
    if tags.get("amenity") == "parking":
        parking_features.append({
            "geom": geom_ll,
            "tags": tags,
            "lat": lat_c,
            "lon": lon_c,
        })

    # Food & drink
    if classify_food_drink(tags) is not None:
        food_drink_features.append({
            "geom": geom_ll,
            "tags": tags,
            "lat": lat_c,
            "lon": lon_c,
        })

    # Shops
    if "shop" in tags:
        shop_features.append({
            "geom": geom_ll,
            "tags": tags,
            "lat": lat_c,
            "lon": lon_c,
        })

    # Hotels
    if hotel_category(tags) is not None:
        hotel_candidates.append({
            "geom": geom_ll,
            "tags": tags,
            "lat": lat_c,
            "lon": lon_c,
        })

    # Family & relax
    if (
        tags.get("leisure") in ("swimming_pool", "spa", "playground")
        or tags.get("amenity") in ("spa", "sauna", "kindergarten")
        or tags.get("social_facility") == "childcare"
    ):
        family_relax_features.append({
            "geom": geom_ll,
            "tags": tags,
            "lat": lat_c,
            "lon": lon_c,
        })


# ==========================
# 5. NEAREST LIFTS (3 within 500 m, station-only)
# ==========================

def compute_nearest_lifts():
    if not lift_station_candidates:
        return []

    # Map node_id -> set of aerialway types from parent ways
    node_to_lift_types = defaultdict(set)
    for way in lift_way_metadata:
        lift_type = way["tags"].get("aerialway")
        if not lift_type:
            continue
        for nid in way.get("nodes", []):
            node_to_lift_types[nid].add(lift_type)

    candidates_in_radius = []
    for c in lift_station_candidates:
        d = distance_m(c["geom"])
        if d <= RADIUS_M:
            c2 = c.copy()
            c2["distance_m"] = d
            # resolve lift type from parent ways if possible
            lift_types = node_to_lift_types.get(c["id"])
            if lift_types:
                # pick one deterministically
                c2["lift_type_resolved"] = sorted(lift_types)[0]
            else:
                c2["lift_type_resolved"] = "unknown"
            candidates_in_radius.append(c2)

    if not candidates_in_radius:
        return []

    # Group by (name, underlying lift type) so we get one entry per physical lift
    grouped = defaultdict(list)
    for c in candidates_in_radius:
        tags = c["tags"]
        name = tags.get("name") or "(unnamed lift)"
        lift_type = c["lift_type_resolved"]
        group_key = (name, lift_type)
        grouped[group_key].append(c)

    # priority for best station
    priority = {
        "valley_station": 0,
        "entry_station": 1,
        "station": 2,
        "exit_station": 3,
        None: 4,
    }

    best_per_lift = []
    for (name, lift_type), items in grouped.items():
        items_sorted = sorted(
            items,
            key=lambda x: (priority.get(x["kind"], 4), x["distance_m"])
        )
        best = items_sorted[0]
        best_per_lift.append({
            "name": name,
            "aerialway_type": lift_type,
            "source": best["kind"],
            "distance_m": best["distance_m"],
            "coords": [best["lat"], best["lon"]],
        })

    best_per_lift.sort(key=lambda x: x["distance_m"])
    return best_per_lift[:3]


nearest_lifts = compute_nearest_lifts()


# ==========================
# 6. NEAREST RUNS (3 within 500 m, no duplicates by name)
# ==========================

def compute_nearest_runs():
    candidates = []
    for r in run_features:
        d = distance_m(r["geom"])
        if d <= RADIUS_M:
            tags = r["tags"]
            name = run_display_name(tags)
            candidates.append({
                "name": name,
                "difficulty": tags.get("piste:difficulty", "unknown"),
                "distance_m": d,
                "coords": [r["lat"], r["lon"]],
            })

    candidates.sort(key=lambda x: x["distance_m"])

    # Deduplicate by name (case-insensitive), so one entry per run name
    seen = set()
    unique = []
    for c in candidates:
        key = c["name"].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(c)
        if len(unique) == 3:
            break

    return unique


nearest_runs = compute_nearest_runs()


# ==========================
# 7. PUBLIC TRANSPORT & PARKING WITHIN 500 m
# ==========================

def compute_public_transport():
    results = []
    for pt in public_transport_points:
        d = distance_m(pt["geom"])
        if d <= RADIUS_M:
            tags = pt["tags"]
            pt_type = classify_public_transport(tags)
            results.append({
                "name": tags.get("name"),
                "type": pt_type,
                "distance_m": d,
                "coords": [pt["lat"], pt["lon"]],
            })
    results.sort(key=lambda x: x["distance_m"])
    return results

def compute_parking():
    results = []
    for p in parking_features:
        d = distance_m(p["geom"])
        if d <= RADIUS_M:
            tags = p["tags"]
            p_type = classify_parking(tags)
            if p_type:
                results.append({
                    "name": tags.get("name"),
                    "type": p_type,
                    "distance_m": d,
                    "coords": [p["lat"], p["lon"]],
                })
    results.sort(key=lambda x: x["distance_m"])
    return results

pt_stops = compute_public_transport()
parkings = compute_parking()


# ==========================
# 8. FOOD / DRINK / NIGHTLIFE
# ==========================

def compute_food_drink_stats():
    restaurants_or_similar = 0
    bars_or_pubs = 0
    nightclubs = 0

    for f in food_drink_features:
        d = distance_m(f["geom"])
        if d > RADIUS_M:
            continue
        t = classify_food_drink(f["tags"])
        if t in ("restaurant", "cafe", "fast_food"):
            restaurants_or_similar += 1
        if t in ("bar", "pub"):
            bars_or_pubs += 1
        if t == "nightclub":
            nightclubs += 1

    return {
        "restaurants_like": restaurants_or_similar,
        "bars_like": bars_or_pubs,
        "nightclubs": nightclubs,
        "nightlife_total": bars_or_pubs + nightclubs,
    }

food_stats = compute_food_drink_stats()


# ==========================
# 9. SHOPS & SKI RENTALS
# ==========================

def compute_shops():
    shops_in_radius = []
    ski_rental_count = 0

    for s in shop_features:
        d = distance_m(s["geom"])
        if d > RADIUS_M:
            continue
        tags = s["tags"]
        shop_type = tags.get("shop")
        name = tags.get("name")
        ski_rental = is_ski_rental(tags)
        if ski_rental:
            ski_rental_count += 1
        shops_in_radius.append({
            "name": name,
            "shop": shop_type,
            "is_ski_rental": ski_rental,
            "distance_m": d,
            "coords": [s["lat"], s["lon"]],
        })

    shops_in_radius.sort(key=lambda x: x["distance_m"])
    return shops_in_radius, ski_rental_count

shops_in_radius, ski_rental_count = compute_shops()


# ==========================
# 10. HOTEL CATEGORY & FAMILY/RELAX AT HOTEL
# ==========================

def find_hotel_object():
    if not hotel_candidates:
        return None
    best = None
    best_d = None
    for h in hotel_candidates:
        d = distance_m(h["geom"])
        if best is None or d < best_d:
            best = h
            best_d = d
    if best_d is not None and best_d <= 60:
        best["distance_m"] = best_d
        return best
    return None

hotel_obj = find_hotel_object()

hotel_info = {
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

if hotel_obj:
    tags = hotel_obj["tags"]
    hotel_info["category"] = hotel_category(tags)
    hotel_info["name"] = tags.get("name")
    hotel_info["stars"] = tags.get("stars")
    hotel_info["distance_m"] = hotel_obj["distance_m"]
    hotel_info["coords"] = [hotel_obj["lat"], hotel_obj["lon"]]

def compute_family_relax_at_hotel():
    if not hotel_obj:
        return
    hotel_geom_ll = hotel_obj["geom"]
    hotel_geom_m = project_geom(hotel_geom_ll)

    def dist_from_hotel(geom_ll):
        geom_m = project_geom(geom_ll)
        return hotel_geom_m.distance(geom_m)

    for f in family_relax_features:
        d = dist_from_hotel(f["geom"])
        if d > HOTEL_RADIUS_M:
            continue
        tags = f["tags"]
        leisure = tags.get("leisure")
        amenity = tags.get("amenity")
        social = tags.get("social_facility")

        if leisure == "swimming_pool":
            hotel_info["has_pool"] = True
        if leisure == "spa" or amenity == "spa":
            hotel_info["has_spa"] = True
        if amenity == "sauna":
            hotel_info["has_sauna"] = True
        if leisure == "playground":
            hotel_info["has_playground"] = True
        if amenity == "kindergarten" or social == "childcare":
            hotel_info["has_childcare"] = True

compute_family_relax_at_hotel()


# ==========================
# 11. BUILD JSON RESULT
# ==========================

result = {
    "hotel_coords": [HOTEL_LAT, HOTEL_LON],
    "radius_m": RADIUS_M,
    "lifts": nearest_lifts,
    "runs": nearest_runs,
    "public_transport": pt_stops,
    "parking": parkings,
    "food_stats": food_stats,
    "shops": {
        "total_shops": len(shops_in_radius),
        "ski_rental_count": ski_rental_count,
        "shops_list": shops_in_radius,
    },
    "hotel": hotel_info,
}

print(json.dumps(result, indent=2, ensure_ascii=False))
