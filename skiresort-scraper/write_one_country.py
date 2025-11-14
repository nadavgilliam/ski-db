import sys, json, re, time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text

import settings
from net import get_soup, fetch, log, sleep_jitter

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.3)"}
RESORT_SLUG_RX = re.compile(r"/ski-resort/([^/]+)/")


def listing_pages(start_url: str, session: requests.Session):
    soup = get_soup(start_url, session=session)
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
    seen, out = set(), []
    for p in ordered:
        if p not in seen:
            out.append(p); seen.add(p)
    return out


def parse_dec_km(km_line: str):
    total = blue = red = black = None
    if km_line:
        parts = re.findall(r"(\d+(?:\.\d+)?)\s*km", km_line.replace("\xa0", " "))
        if parts: total = parts[0]
        if len(parts) >= 4: blue, red, black = parts[1:4]
    return total, blue, red, black


def parse_heights(h: str):
    if not h: return None, None, None
    nums = [int(float(x)) for x in re.findall(r"(\d+(?:\.\d+)?)\s*m", h)]
    v = mn = mx = None
    if len(nums) >= 3: v, mn, mx = nums[:3]
    elif len(nums) == 2: mn, mx = nums
    return v, mn, mx


def parse_lifts(s: str):
    if not s: return None
    m = re.search(r"(\d+)", s.replace("\xa0", " "))
    return int(m.group(1)) if m else None


def parse_prices(s: str):
    if not s: return None, None, None
    m_local = re.search(r"(SFr\.|CHF|€|\$|£)\s*([\d.,]+)", s)
    cur_map = {"SFr.": "CHF", "€": "EUR", "$": "USD", "£": "GBP", "CHF": "CHF"}
    price_local = currency = None
    if m_local:
        currency = cur_map.get(m_local.group(1), m_local.group(1))
        price_local = float(m_local.group(2).replace(".", "").replace(",", "."))
    eur = None
    m_eur = re.search(r"approx\.\s*€\s*([\d.,]+)", s)
    if m_eur:
        eur = float(m_eur.group(1).replace(".", "").replace(",", "."))
    return price_local, currency, eur


def parse_card(card):
    a = card.select_one(".h3 a") or card.select_one("a[href*='/ski-resort/']")
    name = a.get_text(strip=True) if a else None
    detail_url = urljoin("https://www.skiresort.info/", a["href"]) if a and a.has_attr("href") else None
    slug = None
    if detail_url:
        m = RESORT_SLUG_RX.search(detail_url)
        if m: slug = m.group(1)

    status = "unknown"
    icon = card.find("img", class_=re.compile(r"list-resort-.*status-icon"))
    if icon:
        cls = " ".join(icon.get("class", []))
        status = "open" if "open" in cls else ("closed" if "closed" in cls else "unknown")

    rating_div = card.select_one("[data-rank]")
    rating = float(rating_div["data-rank"]) if rating_div and rating_div.has_attr("data-rank") else None

    table = card.select_one(".resort-list-item-text table.info-table")
    rows = [[td.get_text(strip=True) for td in tr.find_all("td")] for tr in table.select("tr")] if table else []
    safe = lambda r, c: rows[r][c] if len(rows) > r and len(rows[r]) > c else None

    height = safe(1,1)
    km_line = safe(2,1)
    lifts_line = safe(3,1)
    price_line = safe(4,1)

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


def upsert_resorts(engine, country_name, rows):
    n = 0
    with engine.begin() as conn:
        for r in rows:
            if not r.get("resort_id"):
                continue
            payload = dict(r); payload["country"] = country_name
            conn.execute(UPSERT_SQL, payload)
            n += 1
    return n


def scrape_country(country_name, country_url, session: requests.Session):
    pages = listing_pages(country_url, session=session)
    log(f"{country_name}: found {len(pages)} page(s)")
    all_rows, total_cards = [], 0

    for i, page in enumerate(pages, start=1):
        log(f"{country_name}: fetching page {i}/{len(pages)} → {page}")
        soup = get_soup(page, session=session, max_retries=3)
        cards = soup.select(".resort-list-item")
        total_cards += len(cards)
        for card in cards:
            all_rows.append(parse_card(card))
        sleep_jitter(1.0, 0.6)  # polite pacing

    log(f"{country_name}: parsed {total_cards} cards")
    return all_rows


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python write_one_country.py 'Switzerland'  (or slug 'switzerland')")
        sys.exit(1)

    target = sys.argv[1].strip().lower()

    with open("countries_index.json", "r", encoding="utf-8") as f:
        countries = json.load(f)

    match = next((c for c in countries if c["country"].lower() == target or c["slug"].lower() == target), None)
    if not match:
        print(f"Country '{sys.argv[1]}' not found. Try a slug like 'switzerland'.")
        sys.exit(2)

    name, url = match["country"], match["url"]
    log(f"Scraping {name} → {url}")

    session = requests.Session()
    session.headers.update(HEADERS)

    engine = create_engine(settings.DATABASE_URL, future=True)
    rows = scrape_country(name, url, session=session)
    count = upsert_resorts(engine, name, rows)
    log(f"Upserted {count} resorts for {name}. ✅")
