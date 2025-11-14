from sqlalchemy import create_engine, inspect, text
import settings

engine = create_engine(settings.DATABASE_URL, future=True)

with engine.connect() as conn:
    # simple round-trip
    conn.execute(text("SELECT 1"))
    inspector = inspect(conn)
    print("Connected to:", settings.DATABASE_URL)
    print("Tables:", inspector.get_table_names())
