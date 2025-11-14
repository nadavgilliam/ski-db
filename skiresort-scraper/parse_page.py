from bs4 import BeautifulSoup
import re

with open("switzerland.html", "r", encoding="utf-8", errors="ignore") as f:
    soup = BeautifulSoup(f.read(), "html.parser")

def parse_item(item):
    # 1) name
    name = (item.select_one(".h3 a") or item.select_one("a")).get_text(strip=True)

    # 2) open/closed (in class name of the small status icon on the card)
    status_icon = item.find("img", class_=re.compile(r"list-resort-.*status-icon"))
    status = "unknown"
    if status_icon:
        cls = " ".join(status_icon.get("class", []))
        status = "open" if "open" in cls else ("closed" if "closed" in cls else "unknown")

    # table with the rest of the basics
    table = item.select_one(".resort-list-item-text table.info-table")
    rows = [["", ""], ["", ""], ["", ""], ["", ""]]
    if table:
        rows = [[td.get_text(strip=True) for td in tr.find_all("td")] for tr in table.select("tr")]

    # 3) rating (if present on list; some pages put only bars, so we fallback to data-rank)
    rating_div = item.select_one('[data-rank]')
    rating = rating_div['data-rank'] if rating_div and rating_div.has_attr('data-rank') else None

    # 4) height range
    height = rows[1][1] if len(rows) > 1 and len(rows[1]) > 1 else None

    # 5) kilometers (blue/red/black appear concatenated)
    km = rows[2][1] if len(rows) > 2 and len(rows[2]) > 1 else None
    # Optional: split into total/blue/red/black
    total_km, blue_km, red_km, black_km = None, None, None, None
    if km:
        # Example: "104 km42 km50 km12 km"
        parts = re.findall(r"(\d+)\s*km", km)
        if len(parts) == 4:
            total_km, blue_km, red_km, black_km = parts

    # 6) lifts
    lifts = rows[3][1] if len(rows) > 3 and len(rows[3]) > 1 else None

    # 7) the currency-looking number (ticket price line)
    price_line = rows[4][1] if len(rows) > 4 and len(rows[4]) > 1 else None

    return {
        "name": name,
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

items = soup.select(".resort-list-item")
for i, it in enumerate(items[:5], 1):
    print(i, parse_item(it))
print(f"\nFound {len(items)} resorts on this page.")
