from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MedicamentCreate(BaseModel):
    pid: str
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None
    laboratoire: Optional[str] = None
    product_type: Optional[str] = None


class MedicamentUpdate(BaseModel):
    product: Optional[str] = None
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None
    laboratoire: Optional[str] = None
    product_type: Optional[str] = None


class MedicamentOut(BaseModel):
    id: int
    pid: str
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None
    laboratoire: Optional[str] = None
    product_type: Optional[str] = None

    model_config = {"from_attributes": True}


class CategorySuffixOut(BaseModel):
    id: int
    category: str
    suffix: str
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class CategorySuffixCreate(BaseModel):
    category: str
    suffix: str
    color: Optional[str] = None


class CategorySuffixUpdate(BaseModel):
    category: Optional[str] = None
    suffix: Optional[str] = None
    color: Optional[str] = None


class CatalogRequestCreate(BaseModel):
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    laboratoire: Optional[str] = None


class NonDeclareRequestCreate(BaseModel):
    medicament_id: int
    notes: Optional[str] = None


class CatalogRequestOut(BaseModel):
    id: int
    requested_by: int
    pharmacy_id: Optional[int] = None
    status: str
    reject_reason: Optional[str] = None
    request_type: str = "new_product"
    medicament_id: Optional[int] = None
    medicament_name: Optional[str] = None
    notes: Optional[str] = None
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    laboratoire: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    pharmacy_name: Optional[str] = None

    model_config = {"from_attributes": True}


class CatalogRejectBody(BaseModel):
    reason: Optional[str] = None
