import json, sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from .config import DB_PATH, ROOT

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()

def migrate(c):
    """Add columns introduced after the first schema, without touching existing rows."""
    cols = {r["name"] for r in c.execute("PRAGMA table_info(farm)")}
    for name, ddl in (("name", "TEXT"), ("place_name", "TEXT"), ("env_key", "TEXT"), ("updated_at", "TEXT")):
        if name not in cols:
            c.execute(f"ALTER TABLE farm ADD COLUMN {name} {ddl}")

def init_db():
    with conn() as c:
        c.executescript((ROOT / "sql" / "schema.sql").read_text(encoding="utf-8"))
        migrate(c)
    try:
        from .data.seed import seed
        seed()
    except ImportError:
        pass

def dumps(o):
    return json.dumps(o, ensure_ascii=False)
