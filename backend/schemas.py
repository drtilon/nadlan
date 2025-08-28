# schemas.py - COMPLETELY FIXED VERSION with all string literals properly closed
from pydantic import BaseModel, validator, Field
from datetime import date
from typing import Optional, List
import re


class TenantData(BaseModel):
    """Tenant data validation with CORRECT field names matching the database"""
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    passport_id: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=10)

    # CORRECT field names matching the database model
    date_of_birth: Optional[date] = Field(None, description="Date of birth")
    refund_iban: Optional[str] = Field(None, max_length=255, description="Refund IBAN")

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name is required and cannot be empty')
        return v.strip()

    @validator('email')
    def validate_email(cls, v):
        if not v or not v.strip():
            raise ValueError('Email is required')
        # Basic email validation - FIXED: Properly closed string
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v):
            raise ValueError('Invalid email format')
        return v.strip().lower()

    @validator('phone')
    def validate_phone(cls, v):
        if v:
            # Remove spaces and common separators
            clean_phone = re.sub(r'[\s\-\(\)]', '', v)
            if len(clean_phone) < 8 or len(clean_phone) > 20:
                raise ValueError('Phone number must be between 8-20 digits')
        return v

    @validator('passport_id')
    def validate_passport_id(cls, v):
        if v:
            if len(v) < 5 or len(v) > 50:
                raise ValueError('Passport ID must be between 5-50 characters')
        return v

    @validator('gender')
    def validate_gender(cls, v):
        if v:
            v = v.lower().strip()
            if v not in ['male', 'female', 'other', 'm', 'f']:
                raise ValueError('Gender must be male, female, or other')
            # Normalize to full words
            if v in ['m', 'male']:
                return 'male'
            elif v in ['f', 'female']:
                return 'female'
            else:
                return 'other'
        return v


class TenantUpdateData(BaseModel):
    """Tenant update data validation - allows partial updates"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    passport_id: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=10)

    # CORRECT field names matching the database model
    date_of_birth: Optional[date] = Field(None, description="Date of birth")
    refund_iban: Optional[str] = Field(None, max_length=255, description="Refund IBAN")

    @validator('name')
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Name cannot be empty if provided')
        return v.strip() if v else v

    @validator('email')
    def validate_email(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Email cannot be empty if provided')
            # Basic email validation - FIXED: Properly closed string
            if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v):
                raise ValueError('Invalid email format')
            return v.strip().lower()
        return v

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None and v:
            # Remove spaces and common separators
            clean_phone = re.sub(r'[\s\-\(\)]', '', v)
            if len(clean_phone) < 8 or len(clean_phone) > 20:
                raise ValueError('Phone number must be between 8-20 digits')
        return v

    @validator('passport_id')
    def validate_passport_id(cls, v):
        if v is not None and v:
            if len(v) < 5 or len(v) > 50:
                raise ValueError('Passport ID must be between 5-50 characters')
        return v

    @validator('gender')
    def validate_gender(cls, v):
        if v is not None and v:
            v = v.lower().strip()
            if v not in ['male', 'female', 'other', 'm', 'f']:
                raise ValueError('Gender must be male, female, or other')
            # Normalize to full words
            if v in ['m', 'male']:
                return 'male'
            elif v in ['f', 'female']:
                return 'female'
            else:
                return 'other'
        return v


class ApartmentData(BaseModel):
    """Apartment data validation with NEW field names"""
    # Location fields
    full_address: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=255)
    street_name: Optional[str] = Field(None, max_length=100)
    house_number: Optional[str] = Field(None, max_length=20)
    building: Optional[str] = Field(None, max_length=50)
    floor: Optional[str] = Field(None, max_length=10)
    side: Optional[str] = Field(None, max_length=10)
    zip_code: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=50)
    state: Optional[str] = Field(None, max_length=50)
    country: Optional[str] = Field("Israel", max_length=50)

    # Property model and financial information
    model: str = Field("rental", description="Property management model")
    rent: float = Field(..., gt=0, description="Monthly rent amount")
    deposit: float = Field(0.0, ge=0, description="Security deposit amount")

    # NEW FIELDS for Management Fee and Rent Cost
    managementFee: Optional[float] = Field(0.0, ge=0, description="Management fee for management model")
    rentCost: Optional[float] = Field(0.0, ge=0, description="Rent cost for management model")

    # Foreign key
    landlord_id: Optional[int] = Field(None, description="Landlord ID")

    @validator('model')
    def validate_model(cls, v):
        if v not in ['rental', 'management']:
            raise ValueError('Model must be either "rental" or "management"')
        return v

    @validator('rent')
    def validate_rent(cls, v):
        if v <= 0:
            raise ValueError('Rent must be greater than 0')
        if v > 50000:  # Reasonable upper limit
            raise ValueError('Rent cannot exceed 50,000')
        return float(v)

    @validator('deposit')
    def validate_deposit(cls, v):
        if v < 0:
            raise ValueError('Deposit cannot be negative')
        if v > 200000:  # Reasonable upper limit
            raise ValueError('Deposit cannot exceed 200,000')
        return float(v)

    @validator('managementFee')
    def validate_management_fee(cls, v):
        if v is not None and v < 0:
            raise ValueError('Management fee cannot be negative')
        if v is not None and v > 10000:
            raise ValueError('Management fee cannot exceed 10,000')
        return float(v) if v is not None else 0.0

    @validator('rentCost')
    def validate_rent_cost(cls, v):
        if v is not None and v < 0:
            raise ValueError('Rent cost cannot be negative')
        if v is not None and v > 50000:
            raise ValueError('Rent cost cannot exceed 50,000')
        return float(v) if v is not None else 0.0

    @validator('zip_code')
    def validate_zip_code(cls, v):
        if v:
            # Remove spaces and validate format
            clean_zip = re.sub(r'\s', '', v)
            if not re.match(r'^[0-9]{5}([0-9]{2})?$', clean_zip):
                # Allow international formats
                if len(clean_zip) < 3 or len(clean_zip) > 10:
                    raise ValueError('Invalid zip code format')
        return v


class LandlordData(BaseModel):
    """Landlord data validation"""
    name: str = Field(..., min_length=1, max_length=100)
    company_name: Optional[str] = Field(None, max_length=100)
    email: str = Field(..., max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    iban: Optional[str] = Field(None, max_length=100)
    company_address: Optional[str] = Field(None, max_length=200)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name is required and cannot be empty')
        return v.strip()

    @validator('email')
    def validate_email(cls, v):
        if not v or not v.strip():
            raise ValueError('Email is required')
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v):
            raise ValueError('Invalid email format')
        return v.strip().lower()

    @validator('phone')
    def validate_phone(cls, v):
        if v:
            # Remove spaces and common separators
            clean_phone = re.sub(r'[\s\-\(\)]', '', v)
            if len(clean_phone) < 8 or len(clean_phone) > 20:
                raise ValueError('Phone number must be between 8-20 digits')
        return v

    @validator('iban')
    def validate_iban(cls, v):
        if v:
            # Basic IBAN validation (remove spaces, check length)
            clean_iban = re.sub(r'\s', '', v).upper()
            if len(clean_iban) < 15 or len(clean_iban) > 34:
                raise ValueError('IBAN must be between 15-34 characters')
            if not re.match(r'^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$', clean_iban):
                raise ValueError('Invalid IBAN format')
        return v


class PaymentData(BaseModel):
    """Payment data validation"""
    apartment_id: int = Field(..., description="Apartment ID")
    contract_period_id: Optional[int] = Field(None, description="Contract period ID")
    month: int = Field(..., ge=1, le=12, description="Payment month (1-12)")
    year: int = Field(..., ge=2020, le=2030, description="Payment year")
    amount: float = Field(..., gt=0, description="Payment amount")
    payment_date: Optional[date] = Field(None, description="Payment date")
    payment_method: Optional[str] = Field("bank_transfer", max_length=50)
    payment_type: str = Field("rent", max_length=50)
    internet: Optional[float] = Field(0.0, ge=0)
    electricity: Optional[float] = Field(0.0, ge=0)
    other: Optional[float] = Field(0.0, ge=0)
    status: str = Field("outstanding", max_length=20)
    notes: Optional[str] = Field(None, max_length=1000)

    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Payment amount must be greater than 0')
        if v > 100000:  # Reasonable upper limit
            raise ValueError('Payment amount cannot exceed 100,000')
        return float(v)

    @validator('payment_method')
    def validate_payment_method(cls, v):
        if v:
            valid_methods = ['bank_transfer', 'cash', 'check', 'credit_card', 'paypal', 'other']
            if v not in valid_methods:
                raise ValueError(f'Payment method must be one of: {", ".join(valid_methods)}')
        return v

    @validator('payment_type')
    def validate_payment_type(cls, v):
        valid_types = ['rent', 'deposit', 'utilities', 'maintenance', 'other']
        if v not in valid_types:
            raise ValueError(f'Payment type must be one of: {", ".join(valid_types)}')
        return v

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ['paid', 'outstanding', 'partial', 'overdue', 'cancelled', 'not_applicable']
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v


class ContractPeriodData(BaseModel):
    """Contract period data validation"""
    apartment_id: int = Field(..., description="Apartment ID")
    contract_number: str = Field(..., min_length=1, max_length=50)
    start_date: date = Field(..., description="Contract start date")
    end_date: Optional[date] = Field(None, description="Contract end date")
    monthly_rent: float = Field(..., gt=0, description="Monthly rent amount")
    security_deposit: float = Field(0.0, ge=0, description="Security deposit")
    status: str = Field("active", max_length=20)
    notes: Optional[str] = Field(None, max_length=1000)

    @validator('contract_number')
    def validate_contract_number(cls, v):
        if not v or not v.strip():
            raise ValueError('Contract number is required')
        return v.strip().upper()

    @validator('monthly_rent')
    def validate_monthly_rent(cls, v):
        if v <= 0:
            raise ValueError('Monthly rent must be greater than 0')
        if v > 50000:
            raise ValueError('Monthly rent cannot exceed 50,000')
        return float(v)

    @validator('security_deposit')
    def validate_security_deposit(cls, v):
        if v < 0:
            raise ValueError('Security deposit cannot be negative')
        return float(v)

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ['active', 'completed', 'terminated', 'pending', 'future']
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

    @validator('end_date')
    def validate_end_date(cls, v, values):
        if v and 'start_date' in values:
            if v <= values['start_date']:
                raise ValueError('End date must be after start date')
        return v
