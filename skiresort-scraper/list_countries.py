import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://www.skiresort.info/ski-resorts/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.1)"}

def fetch_country_links():
    r = requests.get(BASE_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    countries = []
    for a in soup.select("a[href*='/ski-resorts/']"):
        href = urljoin(BASE_URL, a.get("href", ""))
        m = re.match(r"https://www\.skiresort\.info/ski-resorts/([a-z0-9-]+)/?$", href)
        if m:
            slug = m.group(1)
            name = a.get_text(strip=True)
            countries.append({"country": name, "slug": slug, "url": href})
    return countries

if __name__ == "__main__":
    countries = fetch_country_links()
    print(f"Found {len(countries)} countries:\n")
    for c in countries:
        print(f"- {c['country']:25}  {c['url']}")
