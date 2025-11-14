import json
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.1)"}

def listing_pages(start_url: str):
    """Discover /page/N/ pagination for a country listing."""
    r = requests.get(start_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    pages = {start_url}
    for a in soup.select("a[href]"):
        href = urljoin(start_url, a["href"])
        if re.search(r"/page/\d+/?$", href):
            pages.add(href)

    # normalize to 1..max order
    max_page = 1
    for p in pages:
        m = re.search(r"/page/(\d+)/?$", p)
        if m:
            max_page = max(max_page, int(m.group(1)))
    ordered = [start_url] + [start_url.rstrip("/") + f"/page/{i}/" for i in range(2, max_page + 1)]
    # de-dup while preserving order
    seen, result = set(), []
    for p in ordered:
        if p not in seen:
            result.append(p); seen.add(p)
    return result


def parse_item(card):
    """Extract all relevant fields from one resort card."""
    def txt(el):
        return el.get_text(strip=True) if el else None

    # 1. Name + URL
    name_a = card.select_one(".h3 a") or card.select_one("a[href*='/ski-resort/']")
    name = txt(name_a)
    url = urljoin("https://www.skiresort.info/", name_a["href"]) if name_a and name_a.has_attr("href") else None

    # 2. Open/closed status
    status = "unknown"
    icon = card.find("img", class_=re.compile(r"list-resort-.*status-icon"))
    if icon:
        cls = " ".join(icon.get("class", []))
        status = "open" if "open" in cls else ("closed" if "closed" in cls else "unknown")

    # 3. Rating
    rating_div = card.select_one("[data-rank]")
    rating = float(rating_div["data-rank"]) if rating_div and rating_div.has_attr("data-rank") else None

    # 4. Info table rows
    table = card.select_one(".resort-list-item-text table.info-table")
    rows = [[td.get_text(strip=True) for td in tr.find_all("td")] for tr in table.select("tr")] if table else []
    def safe(r, c): return rows[r][c] if len(rows) > r and len(rows[r]) > c else None

    height = safe(1, 1)
    km_line = safe(2, 1)
    lifts = safe(3, 1)
    price_line = safe(4, 1)

    # 5. Parse km numbers (include decimals!)
    total_km = blue_km = red_km = black_km = None
    if km_line:
        parts = re.findall(r"(\d+(?:\.\d+)?)\s*km", km_line.replace("\xa0", " "))
        if len(parts) == 4:
            total_km, blue_km, red_km, black_km = parts
        elif len(parts) >= 1:
            total_km = parts[0]

    return {
        "name": name,
        "url": url,
        "status": status,
        "rating": rating,
        "height": height,
        "total_km": total_km,
        "blue_km": blue_km,
        "red_km": red_km,
        "black_km": black_km,
        "lifts": lifts,
        "price_line": price_line,
    }


def scrape_country(country_name: str, country_url: str):
    """Return list of resort dicts for a single country."""
    all_rows = []
    for idx, page in enumerate(listing_pages(country_url), 1):
        r = requests.get(page, headers=HEADERS, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        for card in soup.select(".resort-list-item"):
            all_rows.append(parse_item(card))
        # be polite
        time.sleep(1)
    return all_rows


if __name__ == "__main__":
    with open("countries_index.json", "r", encoding="utf-8") as f:
        countries = json.load(f)

    # Limit to 10 countries for validation
    countries = countries[:10]

    grand_total = 0

    for c in countries:
        name, url = c["country"], c["url"]
        rows = scrape_country(name, url)
        grand_total += len(rows)
        print(f"\n=== {name} — {len(rows)} resorts ===")
        for r in rows[:5]:
            print(f"\nName:        {r['name']}")
            print(f"Status:      {r['status']}")
            print(f"Rating:      {r['rating']}")
            print(f"Height:      {r['height']}")
            print(f"Total km:    {r['total_km']}")
            print(f"Blue km:     {r['blue_km']}")
            print(f"Red km:      {r['red_km']}")
            print(f"Black km:    {r['black_km']}")
            print(f"Lifts:       {r['lifts']}")
            print(f"Price line:  {r['price_line']}")
            print(f"URL:         {r['url']}")
        print("-" * 70)

    print(f"\nGRAND TOTAL resorts scraped: {grand_total}")
