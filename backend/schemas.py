from pydantic import BaseModel
from datetime import date
from typing import Optional, List


class TenantData(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class ApartmentData(BaseModel):
    address: str
    rooms: int
    size: float
    maxOccupancy: int  # NEW FIELD
    tenants: Optional[List[TenantData]] = None  # This accepts a list of tenants.
    landlordName: str
    landlordEmail: str
    landlordPhone: str
    moveInDate: Optional[date] = None
    contractEndDate: Optional[date] = None
    rent: float
    deposit: float
    notes: Optional[str] = None
    IBAN: str
    status: str
    managementFee: Optional[float] = 0.0
    rentCost: Optional[float] = 0.0
