import requests
from pathlib import Path

URL = "https://www.skiresort.info/ski-resorts/switzerland/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.1; +https://example.com/bot)"
}

resp = requests.get(URL, headers=HEADERS, timeout=30)
resp.raise_for_status()

out = Path("switzerland.html")
out.write_bytes(resp.content)

print("Saved:", out.resolve())
print("Bytes:", out.stat().st_size)
print("HTTP status:", resp.status_code)
