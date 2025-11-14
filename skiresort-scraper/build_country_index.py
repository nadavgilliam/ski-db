import re
import json
import requests
from urllib.parse import quote

RAW = """
Germany (644)
Japan (559)
USA (531)
Austria (440)
China (389)
Switzerland (352)
Czech Republic (317)
Canada (293)
Poland (290)
Italy (286)
Sweden (256)
France (251)
Russia (176)
Norway (170)
Slovakia (122)
Romania (100)
United Kingdom (84)
Finland (80)
Netherlands (63)
Ukraine (58)
Slovenia (50)
Turkey (41)
New Zealand (36)
Iran (34)
Spain (33)
Serbia (29)
Greece (26)
Bulgaria (23)
Kyrgyzstan (23)
Bosnia and Herzegovina (22)
India (22)
South Korea (21)
Argentina (20)
Chile (19)
Latvia (18)
Australia (15)
Hungary (15)
Denmark (13)
Greenland (13)
Iceland (13)
Belgium (11)
Croatia (11)
Lithuania (11)
Montenegro (11)
North Macedonia (9)
Georgia (7)
Kazakhstan (7)
Lebanon (7)
Albania (6)
Estonia (6)
Uzbekistan (6)
United Arab Emirates (6)
Belarus (6)
Kosovo (5)
Malaysia (5)
Morocco (5)
Turkmenistan (5)
Andorra (4)
North Korea (4)
Armenia (3)
Azerbaijan (3)
Brazil (3)
Qatar (3)
Liechtenstein (3)
Pakistan (3)
Portugal (3)
South Africa (3)
Iraq (2)
Ireland (2)
Israel (2)
Nepal (2)
Peru (2)
Thailand (2)
Egypt (1)
Algeria (1)
Bahrain (1)
Indonesia (1)
Lesotho (1)
Mexico (1)
Mongolia (1)
Namibia (1)
Singapore (1)
Cyprus (1)
""".strip()

BASE = "https://www.skiresort.info/ski-resorts/"

# Special-case slugs where the site differs from naive slugify
SLUG_EXCEPTIONS = {
    "USA": "usa",
    # most others follow naive slugify: lower, spaces->-, remove accents/punct
}

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.1)"}

def parse_lines(raw: str):
    out = []
    for line in raw.splitlines():
        m = re.match(r"^(.*?)\s*\((\d+)\)\s*$", line.strip())
        if not m:
            continue
        name, count = m.group(1).strip(), int(m.group(2))
        out.append((name, count))
    return out

def slugify(name: str) -> str:
    # basic ascii-ish slug (good enough for these names)
    s = name.lower()
    s = s.replace("&", "and")
    s = re.sub(r"[’'´`]", "", s)      # drop apostrophes/accents
    s = re.sub(r"[^a-z0-9\s-]", "", s) # remove punctuation
    s = re.sub(r"\s+", "-", s).strip("-")
    return s

def build_url(name: str) -> str:
    slug = SLUG_EXCEPTIONS.get(name, slugify(name))
    return BASE + quote(slug.strip("/")) + "/"

def check_url(url: str) -> bool:
    try:
        r = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
        return r.status_code == 200
    except Exception:
        return False

if __name__ == "__main__":
    seen = set()
    rows = []
    for name, cnt in parse_lines(RAW):
        if name in seen:
            continue
        seen.add(name)
        url = build_url(name)
        ok = check_url(url)
        rows.append({"country": name, "slug": url.split("/")[-2], "url": url, "resort_count": cnt, "ok": ok})

    # Print a concise report
    bad = [r for r in rows if not r["ok"]]
    print(f"Built {len(rows)} countries. Reachable: {len(rows)-len(bad)}; Unreachable: {len(bad)}")
    if bad:
        print("\nUnreachable (need manual slug fix?):")
        for r in bad:
            print(" -", r["country"], "=>", r["url"])

    # Also dump to JSON for inspection (no DB writes yet)
    with open("countries_index.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print("\nWrote countries_index.json")
