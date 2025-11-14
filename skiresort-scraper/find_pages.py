import re
import requests
from urllib.parse import urljoin
from bs4 import BeautifulSoup

START = "https://www.skiresort.info/ski-resorts/switzerland/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.1; +https://example.com/bot)"
}

def listing_pages(start_url: str):
    r = requests.get(start_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    # Collect all pagination hrefs
    hrefs = {start_url}
    for a in soup.select("a[href]"):
        href = a["href"]
        # normalize to absolute
        abs_href = urljoin(start_url, href)
        # match .../page/<n>/ pattern
        if re.search(r"/page/\d+/?$", abs_href):
            hrefs.add(abs_href)

    # Derive the max page number, then build clean list 1..max
    max_page = 1
    for h in hrefs:
        m = re.search(r"/page/(\d+)/?", h)
        if m:
            max_page = max(max_page, int(m.group(1)))

    pages = [start_url] + [start_url.rstrip("/") + f"/page/{i}/" for i in range(2, max_page + 1)]
    # de-dup while preserving order
    seen, ordered = set(), []
    for p in pages:
        if p not in seen:
            ordered.append(p); seen.add(p)
    return ordered

if __name__ == "__main__":
    pages = listing_pages(START)
    print("Found pages:")
    for p in pages:
        print(" -", p)
    print(f"\nTotal pages: {len(pages)}")
