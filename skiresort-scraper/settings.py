import os
from dotenv import load_dotenv

load_dotenv()

# Default to local SQLite; later you can paste your RDS URL here
# e.g., postgresql+psycopg://user:pass@host:5432/dbname
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///skiresort.db")
