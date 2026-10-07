"""Every error the API sends: `{detail, code, params}`.

`code` (ErrorCode) is what the user sees: the frontend shows `errors.<code>` from
fr.ts / es.ts (French + Spanish users), with `params` filled in. `detail` stays
French for logs / curl and as the frontend fallback.

    raise ApiError(404, ErrorCode.BL_NOT_FOUND, f"Bon de livraison introuvable : {ref}", ref=ref)

ErrorCode values = `frontend/src/api/errors.ts` (gate: e2e/tests/99-gates.spec.ts)."""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ErrorCode(StrEnum):
    # Request / generic
    INVALID_INPUT = "invalidInput"
    SERVER_ERROR = "serverError"
    TOO_MANY_ATTEMPTS = "tooManyAttempts"
    # Auth + access
    SESSION_EXPIRED = "sessionExpired"
    BAD_CREDENTIALS = "badCredentials"
    ACCOUNT_DISABLED = "accountDisabled"
    WRONG_PASSWORD = "wrongPassword"
    INVALID_TOKEN = "invalidToken"
    SESSION_NOT_FOUND = "sessionNotFound"
    FEATURE_DISABLED = "featureDisabled"
    ADMIN_ONLY = "adminOnly"
    OWNER_ONLY = "ownerOnly"
    DEVELOPER_ONLY = "developerOnly"
    ADMIN_USE_ADMIN_ROUTES = "adminUseAdminRoutes"
    FORBIDDEN = "forbidden"
    NO_PHARMACY = "noPharmacy"
    # Pharmacies + members
    PHARMACY_NOT_FOUND = "pharmacyNotFound"
    PHARMACY_ARCHIVED = "pharmacyArchived"
    PHARMACY_CODE_FAILED = "pharmacyCodeFailed"
    PHARMACY_ID_MISMATCH = "pharmacyIdMismatch"
    USER_NOT_FOUND = "userNotFound"
    EMPLOYEE_NOT_FOUND = "employeeNotFound"
    EMAIL_TAKEN = "emailTaken"
    ADMIN_NO_PERMISSIONS = "adminNoPermissions"
    ADMIN_STATUS_LOCKED = "adminStatusLocked"
    ADMIN_NOT_DELETABLE = "adminNotDeletable"
    ONLY_MEMBERS_HAVE_PHARMACY = "onlyMembersHavePharmacy"
    SIGNUP_NOT_FOUND = "signupNotFound"
    SIGNUP_ALREADY_DECIDED = "signupAlreadyDecided"
    PHARMACY_CODE_UNKNOWN = "pharmacyCodeUnknown"
    # Catalogue + category suffixes
    PRODUCT_NAME_REQUIRED = "productNameRequired"
    MEDICAMENT_EXISTS = "medicamentExists"
    MEDICAMENT_NOT_FOUND = "medicamentNotFound"
    MEDICAMENTS_NOT_FOUND = "medicamentsNotFound"
    MEDICAMENT_IN_USE = "medicamentInUse"
    PRODUCT_NOT_FOUND = "productNotFound"
    STOCK_MIN_ABOVE_MAX = "stockMinAboveMax"
    SUFFIX_EXISTS = "suffixExists"
    SUFFIX_NOT_FOUND = "suffixNotFound"
    # Imports
    FILE_TOO_LARGE = "fileTooLarge"
    CSV_ONLY = "csvOnly"
    EMPTY_FILE = "emptyFile"
    FILE_CORRUPTED = "fileCorrupted"
    EMPTY_BODY = "emptyBody"
    ROW_MISSING_NAME = "rowMissingName"
    INVALID_BATCH_STATUS = "invalidBatchStatus"
    BATCH_NOT_FOUND = "batchNotFound"
    BATCH_FORBIDDEN = "batchForbidden"
    BATCH_ALREADY_DELETED = "batchAlreadyDeleted"
    # Lists, stats, exclusions, accounting
    EXPORT_TOO_LARGE = "exportTooLarge"
    LISTE_MODE_USE_POST = "listeModeUsePost"
    LISTE_MODE_ADMIN = "listeModeAdmin"
    BL_REF_EMPTY = "blRefEmpty"
    BL_NOT_FOUND = "blNotFound"
    SUPPLIER_EMPTY = "supplierEmpty"
    SUPPLIER_NOT_FOUND = "supplierNotFound"
    PAYMENT_NOT_FOUND = "paymentNotFound"
    # Store website (hidden feature)
    REQUEST_NOT_FOUND = "requestNotFound"
    REQUEST_ACTIVE_EXISTS = "requestActiveExists"
    REQUEST_LOCKED = "requestLocked"
    REQUEST_CLAIMED = "requestClaimed"
    NOT_ASSIGNED_DEVELOPER = "notAssignedDeveloper"
    TRANSITION_NOT_ALLOWED = "transitionNotAllowed"
    FEATURED_IDS_INVALID = "featuredIdsInvalid"
    CUSTOMIZATION_MISSING = "customizationMissing"
    LOGO_FORMAT = "logoFormat"
    LOGO_TOO_LARGE = "logoTooLarge"
    PREVIEW_NOT_FOUND = "previewNotFound"


class ApiError(HTTPException):
    """HTTPException + a translatable `code` and its `params`."""

    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        detail: str,
        headers: dict[str, str] | None = None,
        **params: Any,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code
        self.params = params


log = logging.getLogger("uvicorn.error")


def error_body(code: ErrorCode, detail: Any, **params: Any) -> dict:
    return {"detail": detail, "code": code, "params": params}


def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        error_body(exc.code, exc.detail, **exc.params), status_code=exc.status_code, headers=exc.headers
    )


class CatchServerErrors:
    """Any exception nothing else handled → JSON 500 `{detail, code: serverError}`.

    Added INSIDE the CORS middleware (main.py), so the answer carries the CORS headers:
    without them the browser drops a crash answer and the user read « Serveur
    injoignable » (network message) for what is a server problem. The trace still
    goes to the server log."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def send_tracking(message: Any) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, send_tracking)
        except Exception:
            log.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if started:  # part of the answer already left: nothing clean to send
                raise
            body = error_body(
                ErrorCode.SERVER_ERROR, "Le logiciel a rencontré un problème. Réessayez dans quelques minutes."
            )
            await JSONResponse(body, status_code=500)(scope, receive, send)


def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """FastAPI's default 422 body (pydantic messages, English) + `invalidInput`."""
    return JSONResponse(error_body(ErrorCode.INVALID_INPUT, jsonable_encoder(exc.errors())), status_code=422)
