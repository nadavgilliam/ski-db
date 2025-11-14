import json, time, requests
from sqlalchemy import create_engine
import settings
from net import log, sleep_jitter
from write_one_country import scrape_country, upsert_resorts

if __name__ == "__main__":
    with open("countries_index.json", "r", encoding="utf-8") as f:
        countries = json.load(f)

    # Optional: small subset for a dry run
    # countries = countries[:10]

    engine = create_engine(settings.DATABASE_URL, future=True)
    session = requests.Session()

    total_resorts = 0
    for i, c in enumerate(countries, start=1):
        name, url = c["country"], c["url"]
        log(f"[{i}/{len(countries)}] Start {name}")
        try:
            rows = scrape_country(name, url, session=session)
            n = upsert_resorts(engine, name, rows)
            total_resorts += n
            log(f"[{i}/{len(countries)}] {name}: upserted {n} (running total {total_resorts})")
        except Exception as e:
            log(f"[{i}/{len(countries)}] {name}: ERROR {e}")
        sleep_jitter(1.5, 0.8)  # short pause between countries

    log(f"All countries run complete. Total upserted: {total_resorts} ✅")
