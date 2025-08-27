# schemas.py - COMPLETE FIXED VERSION with correct field names
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
        # Basic email validation
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v.strip()):
            raise ValueError('Invalid email format')
        return v.strip()

    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^[\d\s\-\+\(\)]+$', v.strip()):
            raise ValueError('Phone number contains invalid characters')
        return v.strip() if v else None

    @validator('passport_id')
    def validate_passport_id(cls, v):
        if v and len(v.strip()) < 3:
            raise ValueError('Passport ID must be at least 3 characters long')
        return v.strip() if v else None

    @validator('gender')
    def validate_gender(cls, v):
        if v and v.lower() not in ['male', 'female', 'other', 'm', 'f']:
            raise ValueError('Gender must be male, female, or other')
        return v.lower() if v else None

    @validator('refund_iban')
    def validate_refund_iban(cls, v):
        if v and len(v.strip()) < 10:
            raise ValueError('IBAN must be at least 10 characters long')
        return v.strip() if v else None


class TenantUpdateData(BaseModel):
    """For tenant updates - all fields optional with CORRECT field names"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    passport_id: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=10)

    # CORRECT field names
    date_of_birth: Optional[date] = Field(None)
    refund_iban: Optional[str] = Field(None, max_length=255)

    @validator('name')
    def validate_name(cls, v):
        if v and not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip() if v else None

    @validator('email')
    def validate_email(cls, v):
        if v and not re.match(r'^[^@]+@[^@]+\.[^@]+$', v.strip()):
            raise ValueError('Invalid email format')
        return v.strip() if v else None

    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^[\d\s\-\+\(\)]+$', v.strip()):
            raise ValueError('Phone number contains invalid characters')
        return v.strip() if v else None

    @validator('passport_id')
    def validate_passport_id(cls, v):
        if v and len(v.strip()) < 3:
            raise ValueError('Passport ID must be at least 3 characters long')
        return v.strip() if v else None

    @validator('gender')
    def validate_gender(cls, v):
        if v and v.lower() not in ['male', 'female', 'other', 'm', 'f']:
            raise ValueError('Gender must be male, female, or other')
        return v.lower() if v else None

    @validator('refund_iban')
    def validate_refund_iban(cls, v):
        if v and len(v.strip()) < 10:
            raise ValueError('IBAN must be at least 10 characters long')
        return v.strip() if v else None


class ApartmentAddressData(BaseModel):
    """Apartment address validation"""
    street_name: str = Field(..., min_length=1, max_length=100)
    house_number: str = Field(..., min_length=1, max_length=20)
    zip_code: str = Field(..., min_length=3, max_length=20)
    city: str = Field(..., min_length=1, max_length=50)
    state: Optional[str] = Field(None, max_length=50)
    country: str = Field(default="Israel", max_length=50)
    building: Optional[str] = Field(None, max_length=50)
    floor: Optional[str] = Field(None, max_length=10)
    side: Optional[str] = Field(None, max_length=10)

    @validator('street_name', 'city', 'country')
    def validate_required_text_fields(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required and cannot be empty')
        return v.strip()

    @validator('house_number')
    def validate_house_number(cls, v):
        if not v or not v.strip():
            raise ValueError('House number is required')
        # Allow numbers with optional letter suffix (e.g., "123", "123A", "123-125")
        if not re.match(r'^[0-9]+[A-Za-z]?(-[0-9]+[A-Za-z]?)?$', v.strip()):
            raise ValueError('House number must be numeric, optionally with letter suffix')
        return v.strip()

    @validator('zip_code')
    def validate_zip_code(cls, v):
        if not v or not v.strip():
            raise ValueError('ZIP/Postal code is required')
        if not re.match(r'^[A-Za-z0-9\s\-]+$', v.strip()):
            raise ValueError('ZIP code contains invalid characters')
        return v.strip()

    @validator('state', 'building', 'floor', 'side', pre=True)
    def validate_optional_fields(cls, v):
        if v is not None:
            v = str(v).strip()
            return v if v else None
        return None


class ApartmentData(BaseModel):
    """Complete apartment data validation"""
    # Address components (flattened from ApartmentAddressData)
    street_name: str = Field(..., min_length=1, max_length=100)
    house_number: str = Field(..., min_length=1, max_length=20)
    zip_code: str = Field(..., min_length=3, max_length=20)
    city: str = Field(..., min_length=1, max_length=50)
    state: Optional[str] = Field(None, max_length=50)
    country: str = Field(default="Israel", max_length=50)
    building: Optional[str] = Field(None, max_length=50)
    floor: Optional[str] = Field(None, max_length=10)
    side: Optional[str] = Field(None, max_length=10)

    # Apartment details - using field names that match the database
    bedrooms: int = Field(..., ge=1, le=20, description="Number of bedrooms", alias="rooms")
    area: Optional[float] = Field(None, gt=0, le=10000, description="Area in square meters", alias="size")
    maxOccupancy: int = Field(..., ge=1, le=50, description="Maximum occupancy")

    # Financial
    rent: float = Field(..., ge=0, description="Monthly rent")
    deposit: Optional[float] = Field(0, ge=0, description="Security deposit")

    # Status and preferences
    genderPreference: Optional[str] = Field("mixed", description="Gender preference for tenants")
    status: Optional[str] = Field("vacant", description="Apartment status")

    # Foreign keys
    landlord_id: Optional[int] = None

    # Other fields
    notes: Optional[str] = Field(None, max_length=1000)

    @validator('bedrooms', 'maxOccupancy')
    def validate_positive_integers(cls, v):
        if v <= 0:
            raise ValueError('Must be a positive number')
        return v

    @validator('area', 'rent', 'deposit')
    def validate_positive_numbers(cls, v):
        if v is not None and v < 0:
            raise ValueError('Must be a non-negative number')
        return v

    @validator('genderPreference')
    def validate_gender_preference(cls, v):
        if v is not None:
            valid_preferences = ['mixed', 'male', 'female']
            if v.lower() not in valid_preferences:
                raise ValueError(f'Gender preference must be one of: {", ".join(valid_preferences)}')
            return v.lower()
        return 'mixed'

    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ['vacant', 'occupied', 'contract_sent', 'maintenance']
            if v.lower() not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
            return v.lower()
        return 'vacant'

    # Include validators from ApartmentAddressData
    @validator('street_name', 'city', 'country')
    def validate_required_text_fields(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required and cannot be empty')
        return v.strip()

    @validator('house_number')
    def validate_house_number(cls, v):
        if not v or not v.strip():
            raise ValueError('House number is required')
        if not re.match(r'^[0-9]+[A-Za-z]?(-[0-9]+[A-Za-z]?)?$', v.strip()):
            raise ValueError('House number must be numeric, optionally with letter suffix')
        return v.strip()

    @validator('zip_code')
    def validate_zip_code(cls, v):
        if not v or not v.strip():
            raise ValueError('ZIP/Postal code is required')
        if not re.match(r'^[A-Za-z0-9\s\-]+$', v.strip()):
            raise ValueError('ZIP code contains invalid characters')
        return v.strip()

    @validator('state', 'building', 'floor', 'side', 'notes', pre=True)
    def validate_optional_fields(cls, v):
        if v is not None:
            v = str(v).strip()
            return v if v else None
        return None


class ApartmentUpdateData(BaseModel):
    """For apartment updates - all fields optional"""
    # Address components
    street_name: Optional[str] = Field(None, min_length=1, max_length=100)
    house_number: Optional[str] = Field(None, min_length=1, max_length=20)
    zip_code: Optional[str] = Field(None, min_length=3, max_length=20)
    city: Optional[str] = Field(None, min_length=1, max_length=50)
    state: Optional[str] = Field(None, max_length=50)
    country: Optional[str] = Field(None, max_length=50)
    building: Optional[str] = Field(None, max_length=50)
    floor: Optional[str] = Field(None, max_length=10)
    side: Optional[str] = Field(None, max_length=10)

    # Apartment details
    bedrooms: Optional[int] = Field(None, ge=1, le=20, alias="rooms")
    area: Optional[float] = Field(None, gt=0, le=10000, alias="size")
    maxOccupancy: Optional[int] = Field(None, ge=1, le=50)

    # Financial
    rent: Optional[float] = Field(None, ge=0)
    deposit: Optional[float] = Field(None, ge=0)

    # Preferences
    genderPreference: Optional[str] = None
    status: Optional[str] = None

    # Foreign keys
    landlord_id: Optional[int] = None

    # Other fields
    notes: Optional[str] = Field(None, max_length=1000)

    # Apply same validators as ApartmentData but for optional fields
    @validator('bedrooms', 'maxOccupancy')
    def validate_positive_integers(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Must be a positive number')
        return v

    @validator('area', 'rent', 'deposit')
    def validate_positive_numbers(cls, v):
        if v is not None and v < 0:
            raise ValueError('Must be a non-negative number')
        return v

    @validator('genderPreference')
    def validate_gender_preference(cls, v):
        if v is not None:
            valid_preferences = ['mixed', 'male', 'female']
            if v.lower() not in valid_preferences:
                raise ValueError(f'Gender preference must be one of: {", ".join(valid_preferences)}')
            return v.lower()
        return v

    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ['vacant', 'occupied', 'contract_sent', 'maintenance']
            if v.lower() not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
            return v.lower()
        return v


class LandlordData(BaseModel):
    """Landlord data validation"""
    company_name: str = Field(..., min_length=1, max_length=200)
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    iban: Optional[str] = Field(None, max_length=50)
    company_address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

    @validator('company_name')
    def validate_company_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Company name is required')
        return v.strip()

    @validator('email')
    def validate_email(cls, v):
        if v and not re.match(r'^[^@]+@[^@]+\.[^@]+$', v.strip()):
            raise ValueError('Invalid email format')
        return v.strip() if v else None

    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^[\d\s\-\+\(\)]+$', v.strip()):
            raise ValueError('Phone number contains invalid characters')
        return v.strip() if v else None

    @validator('iban')
    def validate_iban(cls, v):
        if v and len(v.strip()) < 10:
            raise ValueError('IBAN must be at least 10 characters long')
        return v.strip() if v else None

    @validator('name', 'company_address', 'notes', pre=True)
    def validate_optional_text_fields(cls, v):
        if v is not None:
            v = str(v).strip()
            return v if v else None
        return None
