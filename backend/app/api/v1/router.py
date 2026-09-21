from fastapi import APIRouter

from app.api.v1 import auth, me, payments, sessions

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(sessions.router)
api_router.include_router(payments.router)