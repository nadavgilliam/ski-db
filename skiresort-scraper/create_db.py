# create_db.py
from sqlalchemy import create_engine
import settings

DDL_RESORTS = """
CREATE TABLE IF NOT EXISTS resorts (
    resort_id           TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    country             TEXT,
    country_code        TEXT,
    region              TEXT,
    source_url          TEXT NOT NULL,
    status              TEXT,
    rating              REAL,
    altitude_min_m      INTEGER,
    altitude_max_m      INTEGER,
    altitude_village_m  INTEGER,
    piste_km_total      REAL,
    piste_km_blue       REAL,
    piste_km_red        REAL,
    piste_km_black      REAL,
    lifts_count         INTEGER,
    price_day_local     REAL,
    price_currency      TEXT,
    price_day_eur       REAL,
    last_seen_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
"""

DDL_COUNTRIES = """
CREATE TABLE IF NOT EXISTS countries (
    slug TEXT PRIMARY KEY,
    country TEXT NOT NULL,
    url TEXT NOT NULL,
    last_seen_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
"""

DDL_FETCH_LOG = """
CREATE TABLE IF NOT EXISTS fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,
    fetched_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
"""

def main():
    engine = create_engine(settings.DATABASE_URL, future=True)
    with engine.begin() as conn:
        # set WAL only for SQLite targets
        if settings.DATABASE_URL.startswith("sqlite"):
            conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
        conn.exec_driver_sql(DDL_RESORTS)
        conn.exec_driver_sql(DDL_COUNTRIES)
        conn.exec_driver_sql(DDL_FETCH_LOG)
    print("Initialized schema at:", settings.DATABASE_URL)

if __name__ == "__main__":
    main()
