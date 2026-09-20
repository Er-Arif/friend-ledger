from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.exceptions import AppError

app = FastAPI(
    title="Friend Ledger API",
    version="0.1.0",
)

app.include_router(
    api_router,
    prefix="/api/v1",
)


@app.exception_handler(AppError)
async def handle_app_error(
    _request: Request,
    exc: AppError,
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
            "request_id": str(uuid4()),
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = [
        {
            "location": list(error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": {
                    "fields": errors,
                },
            },
            "request_id": str(uuid4()),
        },
    )


@app.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "friend-ledger-api",
    }