from fastapi import FastAPI

from app.routers import health, internal, telegram

app = FastAPI(title="Wedding Bot Backend")
app.include_router(health.router)
app.include_router(telegram.router)
app.include_router(internal.router)
