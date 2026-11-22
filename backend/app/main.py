from contextlib import asynccontextmanager
from importlib import import_module

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(title="Field Shift API", version="0.2.0", lifespan=lifespan,
              description="Decision support only. Not a replacement for farmer or agronomist judgment.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
for name in ("locations", "crops", "suitability", "farms", "sources", "farm_environment", "geocode"):
    try:
        app.include_router(import_module(f".routers.{name}", __package__).router)
    except ModuleNotFoundError as e:   # keep the API up if an optional router is missing in a checkout
        if f"routers.{name}" not in str(e):
            raise


@app.get("/health")
def health():
    return {"ok": True}
