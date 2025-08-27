# schemas.py - Complete Fixed Version
from pydantic import BaseModel, validator, Field
from datetime import date
from typing import Optional, List
import re


class TenantData(BaseModel):
    """Updated tenant data validation with gender and passport ID"""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    bornOn: Optional[str] = Field(None, max_length=50)
    refundIban: Optional[str] = Field(None, max_length=50)
    passport_id: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=20)
    apartment_id: Optional[int] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name is required and cannot be empty')
        return v.strip()

    @validator('email')
    def validate_email(cls, v):
        if v is not None and v.strip():
            # Basic email validation
            if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v.strip()):
                raise ValueError('Invalid email format')
            return v.strip()
        return None

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None and v.strip():
            # Allow various phone formats
            if not re.match(r'^[\+\-\s\(\)\d]+$', v.strip()):
                raise ValueError('Phone number contains invalid characters')
            return v.strip()
        return None

    @validator('refundIban')
    def validate_iban(cls, v):
        if v is not None and v.strip():
            # Basic IBAN format validation (can be enhanced)
            cleaned = re.sub(r'\s+', '', v.strip().upper())
            if not re.match(r'^[A-Z]{2}[0-9]{2}[A-Z0-9]+$', cleaned):
                raise ValueError('Invalid IBAN format')
            return cleaned
        return None

    @validator('passport_id')
    def validate_passport_id(cls, v):
        if v is not None and v.strip():
            # Basic passport ID validation - alphanumeric
            cleaned = v.strip().upper()
            if not re.match(r'^[A-Z0-9]+$', cleaned):
                raise ValueError('Passport ID should contain only letters and numbers')
            return cleaned
        return None

    @validator('gender')
    def validate_gender(cls, v):
        if v is not None and v.strip():
            valid_genders = ['male', 'female', 'other', 'prefer_not_to_say']
            if v.lower() not in valid_genders:
                raise ValueError(f'Gender must be one of: {", ".join(valid_genders)}')
            return v.lower()
        return None

    @validator('bornOn')
    def validate_birth_date(cls, v):
        if v is not None and v.strip():
            # Validate date format (YYYY-MM-DD)
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', v.strip()):
                raise ValueError('Birth date must be in YYYY-MM-DD format')
            return v.strip()
        return None


class TenantUpdateData(BaseModel):
    """For tenant updates - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    bornOn: Optional[str] = Field(None, max_length=50)
    refundIban: Optional[str] = Field(None, max_length=50)
    passport_id: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=20)
    apartment_id: Optional[int] = None

    # Apply same validators as TenantData but for optional fields
    @validator('name')
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Name cannot be empty if provided')
        return v.strip() if v else None

    @validator('email')
    def validate_email(cls, v):
        if v is not None and v.strip():
            if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v.strip()):
                raise ValueError('Invalid email format')
            return v.strip()
        return None

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None and v.strip():
            if not re.match(r'^[\+\-\s\(\)\d]+$', v.strip()):
                raise ValueError('Phone number contains invalid characters')
            return v.strip()
        return None

    @validator('refundIban')
    def validate_iban(cls, v):
        if v is not None and v.strip():
            cleaned = re.sub(r'\s+', '', v.strip().upper())
            if not re.match(r'^[A-Z]{2}[0-9]{2}[A-Z0-9]+$', cleaned):
                raise ValueError('Invalid IBAN format')
            return cleaned
        return None

    @validator('passport_id')
    def validate_passport_id(cls, v):
        if v is not None and v.strip():
            cleaned = v.strip().upper()
            if not re.match(r'^[A-Z0-9]+$', cleaned):
                raise ValueError('Passport ID should contain only letters and numbers')
            return cleaned
        return None

    @validator('gender')
    def validate_gender(cls, v):
        if v is not None and v.strip():
            valid_genders = ['male', 'female', 'other', 'prefer_not_to_say']
            if v.lower() not in valid_genders:
                raise ValueError(f'Gender must be one of: {", ".join(valid_genders)}')
            return v.lower()
        return None

    @validator('bornOn')
    def validate_birth_date(cls, v):
        if v is not None and v.strip():
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', v.strip()):
                raise ValueError('Birth date must be in YYYY-MM-DD format')
            return v.strip()
        return None

class ApartmentAddressData(BaseModel):
    """Validation for address components"""
    street_name: str = Field(..., min_length=1, max_length=100, description="Street name")
    house_number: str = Field(..., min_length=1, max_length=20, description="House number (can include letters)")
    zip_code: str = Field(..., min_length=3, max_length=20, description="Postal/ZIP code")
    city: str = Field(..., min_length=1, max_length=50, description="City name")
    state: Optional[str] = Field(None, max_length=50, description="State/Province (optional)")
    country: str = Field(default="Israel", max_length=50, description="Country name")
    building: Optional[str] = Field(None, max_length=50, description="Building name/number (optional)")
    floor: Optional[str] = Field(None, max_length=10, description="Floor number (optional)")
    side: Optional[str] = Field(None, max_length=10, description="Side/Unit identifier (optional)")

    @validator('street_name', 'city', 'country')
    def validate_required_text_fields(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required and cannot be empty')
        return v.strip()

    @validator('house_number')
    def validate_house_number(cls, v):
        if not v or not v.strip():
            raise ValueError('House number is required')
        # Allow numbers with letters (e.g., "123A", "45-47")
        if not re.match(r'^[0-9]+[A-Za-z]?(-[0-9]+[A-Za-z]?)?$', v.strip()):
            raise ValueError('House number must be numeric, optionally with letter suffix (e.g., "123", "123A", "45-47")')
        return v.strip()

    @validator('zip_code')
    def validate_zip_code(cls, v):
        if not v or not v.strip():
            raise ValueError('ZIP/Postal code is required')
        # Basic validation - alphanumeric with possible spaces/dashes
        if not re.match(r'^[A-Za-z0-9\s\-]+$', v.strip()):
            raise ValueError('ZIP code contains invalid characters')
        return v.strip()

    @validator('state', 'building', 'floor', 'side', pre=True)
    def validate_optional_fields(cls, v):
        if v is not None:
            v = str(v).strip()
            return v if v else None
        return None

    @validator('floor')
    def validate_floor(cls, v):
        if v is not None:
            # Allow numbers, basement, ground floor variations
            if not re.match(r'^(-?\d+|[Bb]asement|[Gg]round|[Gg]F|[Bb]\d*|[Pp]arking)$', v):
                raise ValueError('Floor must be a number, "Basement", "Ground", "GF", etc.')
        return v


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

    # Apartment details
    rooms: int = Field(..., ge=1, le=20, description="Number of rooms")
    size: float = Field(..., gt=0, le=10000, description="Size in square meters")
    maxOccupancy: int = Field(..., ge=1, le=50, description="Maximum occupancy")

    # Financial
    rent: float = Field(..., ge=0, description="Monthly rent")
    deposit: float = Field(..., ge=0, description="Security deposit")
    managementFee: Optional[float] = Field(0.0, ge=0, le=100, description="Management fee percentage")
    rentCost: Optional[float] = Field(0.0, ge=0, description="Rent cost for rental model")

    # Status and model
    status: str = Field(..., description="Apartment status")
    model: Optional[str] = Field("management", description="Property model")
    notes: Optional[str] = Field(None, description="Additional notes")

    # NEW: Gender preference for apartments
    genderPreference: Optional[str] = Field("mixed", description="Gender preference for tenants")

    # Dates
    moveInDate: Optional[date] = None
    contractEndDate: Optional[date] = None

    # Foreign keys
    landlord_id: Optional[int] = None

    # Related data
    tenants: Optional[List[TenantData]] = None

    @validator('rooms', 'maxOccupancy')
    def validate_positive_integers(cls, v):
        if v <= 0:
            raise ValueError('Must be a positive number')
        return v

    @validator('size', 'rent', 'deposit')
    def validate_positive_numbers(cls, v):
        if v <= 0:
            raise ValueError('Must be a positive number')
        return v

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ['vacant', 'occupied', 'contract_sent', 'maintenance']
        if v.lower() not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v.lower()

    @validator('model')
    def validate_model(cls, v):
        if v is not None:
            valid_models = ['management', 'rental']
            if v.lower() not in valid_models:
                raise ValueError(f'Model must be one of: {", ".join(valid_models)}')
            return v.lower()
        return 'management'

    @validator('genderPreference')
    def validate_gender_preference(cls, v):
        if v is not None:
            valid_preferences = ['mixed', 'men_only', 'women_only']
            if v.lower() not in valid_preferences:
                raise ValueError(f'Gender preference must be one of: {", ".join(valid_preferences)}')
            return v.lower()
        return 'mixed'

    # Include all validators from ApartmentAddressData
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

    @validator('state', 'building', 'floor', 'side', pre=True)
    def validate_optional_fields(cls, v):
        if v is not None:
            v = str(v).strip()
            return v if v else None
        return None


class ApartmentUpdateData(BaseModel):
    """For apartment updates - all fields optional except those that shouldn't change"""
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

    # Other fields
    rooms: Optional[int] = Field(None, ge=1, le=20)
    size: Optional[float] = Field(None, gt=0, le=10000)
    maxOccupancy: Optional[int] = Field(None, ge=1, le=50)
    rent: Optional[float] = Field(None, ge=0)
    deposit: Optional[float] = Field(None, ge=0)
    managementFee: Optional[float] = Field(None, ge=0, le=100)
    rentCost: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = None
    genderPreference: Optional[str] = None  # NEW: Gender preference
    moveInDate: Optional[date] = None
    contractEndDate: Optional[date] = None
    landlord_id: Optional[int] = None

    # Apply same validators as ApartmentData but for optional fields
    @validator('street_name', 'city', 'country')
    def validate_text_fields(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Field cannot be empty if provided')
        return v.strip() if v else None

    @validator('genderPreference')
    def validate_gender_preference(cls, v):
        if v is not None:
            valid_preferences = ['mixed', 'men_only', 'women_only']
            if v.lower() not in valid_preferences:
                raise ValueError(f'Gender preference must be one of: {", ".join(valid_preferences)}')
            return v.lower()
        return v


class LandlordData(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    iban: Optional[str] = Field(None, max_length=100)
    company_address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None
