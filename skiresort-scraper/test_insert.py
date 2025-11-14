# test_insert.py
from sqlalchemy import create_engine, text
import settings

engine = create_engine(settings.DATABASE_URL, future=True)

SAMPLE = {
    "resort_id": "test-aletsch",
    "name": "Aletsch Arena – Test Resort",
    "country": "Switzerland",
    "country_code": "CH",
    "region": "Valais",
    "source_url": "https://www.skiresort.info/ski-resort/aletsch-arena/",
    "status": "open",
    "rating": 4.7,
    "altitude_min_m": 1845,
    "altitude_max_m": 2869,
    "altitude_village_m": 1024,
    "piste_km_total": 104.5,
    "piste_km_blue": 42.0,
    "piste_km_red": 50.0,
    "piste_km_black": 12.5,
    "lifts_count": 35,
    "price_day_local": 66,
    "price_currency": "CHF",
    "price_day_eur": 71,
}

UPSERT = text("""
INSERT INTO resorts (
    resort_id, name, country, country_code, region, source_url, status, rating,
    altitude_min_m, altitude_max_m, altitude_village_m,
    piste_km_total, piste_km_blue, piste_km_red, piste_km_black,
    lifts_count, price_day_local, price_currency, price_day_eur,
    last_seen_at
)
VALUES (
    :resort_id, :name, :country, :country_code, :region, :source_url, :status, :rating,
    :altitude_min_m, :altitude_max_m, :altitude_village_m,
    :piste_km_total, :piste_km_blue, :piste_km_red, :piste_km_black,
    :lifts_count, :price_day_local, :price_currency, :price_day_eur,
    strftime('%Y-%m-%dT%H:%M:%SZ','now')
)
ON CONFLICT(resort_id) DO UPDATE SET
    name = excluded.name,
    country = excluded.country,
    status = excluded.status,
    rating = excluded.rating,
    piste_km_total = excluded.piste_km_total,
    lifts_count = excluded.lifts_count,
    price_day_local = excluded.price_day_local,
    price_currency = excluded.price_currency,
    price_day_eur = excluded.price_day_eur,
    last_seen_at = excluded.last_seen_at
""")

with engine.begin() as conn:
    conn.execute(UPSERT, SAMPLE)
    count = conn.execute(text("SELECT COUNT(*) FROM resorts")).scalar_one()
    print(f"Inserted! resorts table now has {count} rows.")

print("✅ Insert test complete.")
