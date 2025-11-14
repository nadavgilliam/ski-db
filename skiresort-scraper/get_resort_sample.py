import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
COUNTRY_ISO = "CH"   # change to e.g. "AT", "FR", "US" as needed
MAX_PRINT = 20       # print only first N results

# Overpass query:
#  - get all ski "site" relations in a country
#  - fetch relations + *all member ways/nodes* so we can inspect tags for lifts and runs
query = f"""
[out:json][timeout:180];
area["ISO3166-1"="{COUNTRY_ISO}"]->.country;
rel(area.country)["type"="site"]["site"="piste"]->.res;

(
  rel.res;
  way(r.res);
  node(r.res);
);
out body center qt;
"""

resp = requests.post(OVERPASS_URL, data={"data": query})
resp.raise_for_status()
data = resp.json()["elements"]

# Build quick lookups for ways/nodes tags by id so we can test members
way_tags = {}
node_tags = {}
relations = []

for el in data:
    t = el.get("type")
    if t == "way":
        way_tags[el["id"]] = el.get("tags", {})
    elif t == "node":
        node_tags[el["id"]] = el.get("tags", {})
    elif t == "relation":
        relations.append(el)

def relation_has_downhill_and_lift(rel):
    """
    A relation qualifies as 'alpine resort' if:
      - at least one member way has piste:type=downhill (downhill run)
      - AND at least one member node/way has aerialway=* (a lift)
    """
    has_downhill = False
    has_lift = False

    for m in rel.get("members", []):
        mtype = m.get("type")
        mid = m.get("ref")

        if mtype == "way":
            tags = way_tags.get(mid, {})
            if tags.get("piste:type") == "downhill":
                has_downhill = True
            if "aerialway" in tags:
                has_lift = True

        elif mtype == "node":
            tags = node_tags.get(mid, {})
            if "aerialway" in tags:
                has_lift = True

        # early exit if both true
        if has_downhill and has_lift:
            return True

    return False

# Filter relations
alpine_resorts = [r for r in relations if relation_has_downhill_and_lift(r)]

print(f"Total alpine resorts (downhill runs AND lifts) in {COUNTRY_ISO}: {len(alpine_resorts)}\n")

# Print first N
for rel in alpine_resorts[:MAX_PRINT]:
    tags = rel.get("tags", {})
    name = tags.get("name", "Unnamed resort")
    lat = rel.get("center", {}).get("lat")
    lon = rel.get("center", {}).get("lon")
    website = tags.get("website", "")
    print(f"{name} — ({lat:.5f}, {lon:.5f}) {website}")
