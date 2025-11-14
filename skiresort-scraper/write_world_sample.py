import json
import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text

import settings

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.1)"}
RESORT_SLUG_RX = re.compile(r"/ski-resort/([^/]+)/")

# ---------- helpers: parsing ----------

def parse_dec_km(km_line: str):
    """Return tuple total, blue, red, black as strings (allow decimals), else None."""
    total = blue = red = black = None
    if not km_line:
        return total, blue, red, black
    parts = re.findall(r"(\d+(?:\.\d+)?)\s*km", km_line.replace("\xa0", " "))
    if len(parts) >= 1: total = parts[0]
    if len(parts) >= 4: blue, red, black = parts[1:4]
    return total, blue, red, black

def parse_heights(h: str):
    """Best-effort parse of altitude line like '1024 m(1845 m-2869 m)' or '944 m-2400 m'."""
    if not h:
        return None, None, None
    nums = [int(float(x)) for x in re.findall(r"(\d+(?:\.\d+)?)\s*m", h)]
    # Common patterns:
    # - 3 numbers: village/base, min, max
    # - 2 numbers: min, max
    village = min_h = max_h = None
    if len(nums) >= 3:
        village, min_h, max_h = nums[:3]
    elif len(nums) == 2:
        min_h, max_h = nums
    return village, min_h, max_h

def parse_lifts(s: str):
    if not s:
        return None
    m = re.search(r"(\d+)", s.replace("\xa0", " "))
    return int(m.group(1)) if m else None

def parse_prices(s: str):
    """Extract local currency day price and approx EUR if present."""
    if not s:
        return None, None, None
    # Examples: 'SFr. 66,- / approx. € 71,-'  or  '€ 79,-'
    # Local first:
    m_local = re.search(r"(SFr\.|CHF|€|\$|£)\s*([\d.,]+)", s)
    cur_map = {"SFr.": "CHF", "€": "EUR", "$": "USD", "£": "GBP", "CHF": "CHF"}
    price_local = currency = None
    if m_local:
        currency = cur_map.get(m_local.group(1), m_local.group(1))
        price_local = float(m_local.group(2).replace(".", "").replace(",", "."))
    # approx EUR:
    eur = None
    m_eur = re.search(r"approx\.\s*€\s*([\d.,]+)", s)
    if m_eur:
        eur = float(m_eur.group(1).replace(".", "").replace(",", "."))
    return price_local, currency, eur

def get_pages(start_url: str):
    r = requests.get(start_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    pages = {start_url}
    for a in soup.select("a[href]"):
        href = urljoin(start_url, a["href"])
        if re.search(r"/page/\d+/?$", href):
            pages.add(href)
    max_page = 1
    for p in pages:
        m = re.search(r"/page/(\d+)/?$", p)
        if m:
            max_page = max(max_page, int(m.group(1)))
    ordered = [start_url] + [start_url.rstrip("/") + f"/page/{i}/" for i in range(2, max_page + 1)]
    # de-dup
    seen, result = set(), []
    for p in ordered:
        if p not in seen:
            result.append(p); seen.add(p)
    return result

def parse_card(card):
    # name + detail url
    a = card.select_one(".h3 a") or card.select_one("a[href*='/ski-resort/']")
    name = a.get_text(strip=True) if a else None
    detail_url = urljoin("https://www.skiresort.info/", a["href"]) if a and a.has_attr("href") else None
    slug = None
    if detail_url:
        m = RESORT_SLUG_RX.search(detail_url)
        if m: slug = m.group(1)

    # status
    status = "unknown"
    icon = card.find("img", class_=re.compile(r"list-resort-.*status-icon"))
    if icon:
        cls = " ".join(icon.get("class", []))
        status = "open" if "open" in cls else ("closed" if "closed" in cls else "unknown")

    # rating
    rating_div = card.select_one("[data-rank]")
    rating = float(rating_div["data-rank"]) if rating_div and rating_div.has_attr("data-rank") else None

    # info table
    table = card.select_one(".resort-list-item-text table.info-table")
    rows = [[td.get_text(strip=True) for td in tr.find_all("td")] for tr in table.select("tr")] if table else []
    def safe(r, c): return rows[r][c] if len(rows) > r and len(rows[r]) > c else None

    height = safe(1, 1)
    km_line = safe(2, 1)
    lifts_line = safe(3, 1)
    price_line = safe(4, 1)

    total_km, blue_km, red_km, black_km = parse_dec_km(km_line)
    village, alt_min, alt_max = parse_heights(height)
    lifts_count = parse_lifts(lifts_line)
    price_local, currency, price_eur = parse_prices(price_line)

    return {
        "resort_id": slug,
        "name": name,
        "status": status,
        "rating": rating,
        "altitude_village_m": village,
        "altitude_min_m": alt_min,
        "altitude_max_m": alt_max,
        "piste_km_total": float(total_km) if total_km else None,
        "piste_km_blue": float(blue_km) if blue_km else None,
        "piste_km_red": float(red_km) if red_km else None,
        "piste_km_black": float(black_km) if black_km else None,
        "lifts_count": lifts_count,
        "price_day_local": price_local,
        "price_currency": currency,
        "price_day_eur": price_eur,
        "source_url": detail_url,
    }

# ---------- DB upsert ----------

UPSERT_SQL = text("""
INSERT INTO resorts (
    resort_id, name, country, country_code, region, source_url, status, rating,
    altitude_min_m, altitude_max_m, altitude_village_m,
    piste_km_total, piste_km_blue, piste_km_red, piste_km_black,
    lifts_count, price_day_local, price_currency, price_day_eur,
    last_seen_at
) VALUES (
    :resort_id, :name, :country, NULL, NULL, :source_url, :status, :rating,
    :altitude_min_m, :altitude_max_m, :altitude_village_m,
    :piste_km_total, :piste_km_blue, :piste_km_red, :piste_km_black,
    :lifts_count, :price_day_local, :price_currency, :price_day_eur,
    strftime('%Y-%m-%dT%H:%M:%SZ','now')
)
ON CONFLICT(resort_id) DO UPDATE SET
    name = excluded.name,
    country = excluded.country,
    source_url = excluded.source_url,
    status = excluded.status,
    rating = excluded.rating,
    altitude_min_m = excluded.altitude_min_m,
    altitude_max_m = excluded.altitude_max_m,
    altitude_village_m = excluded.altitude_village_m,
    piste_km_total = excluded.piste_km_total,
    piste_km_blue = excluded.piste_km_blue,
    piste_km_red = excluded.piste_km_red,
    piste_km_black = excluded.piste_km_black,
    lifts_count = excluded.lifts_count,
    price_day_local = excluded.price_day_local,
    price_currency = excluded.price_currency,
    price_day_eur = excluded.price_day_eur,
    last_seen_at = excluded.last_seen_at
""")

def upsert_resorts(engine, country_name: str, rows: list):
    inserted = 0
    with engine.begin() as conn:
        for r in rows:
            if not r.get("resort_id"):  # skip if we couldn't get a stable id
                continue
            payload = dict(r)
            payload["country"] = country_name
            conn.execute(UPSERT_SQL, payload)
            inserted += 1
    return inserted

# ---------- main flow (small batch) ----------

def scrape_country(country_name: str, country_url: str):
    all_rows = []
    for page in get_pages(country_url):
        r = requests.get(page, headers=HEADERS, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        for card in soup.select(".resort-list-item"):
            all_rows.append(parse_card(card))
        time.sleep(1)
    return all_rows

if __name__ == "__main__":
    engine = create_engine(settings.DATABASE_URL, future=True)

    with open("countries_index.json", "r", encoding="utf-8") as f:
        countries = json.load(f)

    # LIMIT: only first 2 countries for this initial write
    countries = countries[:2]

    total = 0
    for c in countries:
        name, url = c["country"], c["url"]
        rows = scrape_country(name, url)
        count = upsert_resorts(engine, name, rows)
        print(f"{name}: upserted {count} resorts")
        total += count

    print(f"\nTOTAL upserted: {total}")
