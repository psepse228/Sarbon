from fastapi import FastAPI

from app.routers import health, telegram

app = FastAPI(title="Wedding Bot Backend")
app.include_router(health.router)
app.include_router(telegram.router)
