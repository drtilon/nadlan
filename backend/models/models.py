# models/models.py - Refactored Database Models
from datetime import date, datetime
from extentions import db, bcrypt
from sqlalchemy import func
import json


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="user")
    is_approved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "is_approved": self.is_approved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.username}>"


class Landlord(db.Model):
    __tablename__ = "landlords"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company_name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    iban = db.Column(db.String(100), nullable=True)
    company_address = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    apartments = db.relationship("Apartment", backref="landlord", lazy=True)

    def to_dict(self, include_apartments=False):
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        if include_apartments and self.apartments:
            result["apartments"] = [
                apt.to_dict(include_contract_periods=False, include_tenants=False)
                for apt in self.apartments
            ]

        return result

    def __repr__(self):
        return f"<Landlord {self.id}: {self.name}>"


class Apartment(db.Model):
    __tablename__ = "apartments"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)

    # Address fields
    street_name = db.Column(db.String(100), nullable=False, default="Unknown Street")
    house_number = db.Column(db.String(20), nullable=False, default="1")
    zip_code = db.Column(db.String(20), nullable=False, default="00000")
    city = db.Column(db.String(50), nullable=False, default="Tel Aviv")
    state = db.Column(db.String(50), nullable=True)
    country = db.Column(db.String(50), nullable=False, default="Israel")
    building = db.Column(db.String(50), nullable=True)
    floor = db.Column(db.String(10), nullable=True)
    side = db.Column(db.String(10), nullable=True)
    full_address = db.Column(db.String(500), nullable=True)

    # Legacy address field for backward compatibility
    address = db.Column(db.String(200), nullable=True)

    # Apartment details
    rent = db.Column(db.Numeric(10, 2), nullable=False, default=1000.00)
    bedrooms = db.Column(db.Integer, default=1)
    bathrooms = db.Column(db.Integer, default=1)
    area = db.Column(db.Numeric(10, 2), nullable=True)
    maxOccupancy = db.Column(db.Integer, default=4)
    genderPreference = db.Column(db.String(20), default="mixed")

    # Foreign keys
    landlord_id = db.Column(db.Integer, db.ForeignKey("landlords.id"), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contract_periods = db.relationship("ContractPeriod", backref="apartment", lazy=True, cascade="all, delete-orphan")
    contracts = db.relationship("Contract", backref="apartment", lazy=True)  # For file contracts
    payments = db.relationship("Payment", backref="apartment", lazy=True)

    def get_short_address(self):
        """Generate short address from components"""
        if self.full_address:
            return self.full_address
        parts = [self.street_name, self.house_number]
        if self.floor:
            parts.append(f"Floor {self.floor}")
        parts.append(self.city)
        return " ".join(filter(None, parts))

    def get_current_contract_periods(self):
        """Get currently active contract periods for this apartment"""
        today = date.today()
        return [cp for cp in self.contract_periods
                if cp.status == "active" and
                cp.start_date <= today and
                (cp.end_date is None or cp.end_date >= today)]

    def get_current_tenants(self):
        """Get current tenants through active contract periods"""
        current_tenants = []
        for cp in self.get_current_contract_periods():
            for ct in cp.contract_tenants:
                if ct.is_active():
                    current_tenants.append(ct.tenant)
        return list(set(current_tenants))  # Remove duplicates

    def to_dict(self, include_contract_periods=False, include_tenants=False, include_landlord=False):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal to float
        if result.get("rent"):
            result["rent"] = float(result["rent"])
        if result.get("area"):
            result["area"] = float(result["area"])

        # Add computed fields
        result["short_address"] = self.get_short_address()

        # Add related data if requested
        if include_landlord and self.landlord:
            result["landlord"] = self.landlord.to_dict(include_apartments=False)

        if include_contract_periods and self.contract_periods:
            result["contract_periods"] = [cp.to_dict(include_apartment=False) for cp in self.contract_periods]
            result["current_contract_periods"] = [cp.to_dict(include_apartment=False) for cp in self.get_current_contract_periods()]

        if include_tenants:
            current_tenants = self.get_current_tenants()
            result["tenants"] = [tenant.to_dict(include_contracts=False) for tenant in current_tenants]

        return result

    def __repr__(self):
        return f"<Apartment {self.id}: {self.get_short_address()}>"


class Tenant(db.Model):
    __tablename__ = "tenants"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    passport_id = db.Column(db.String(50), nullable=True)
    gender = db.Column(db.String(10), nullable=True)

    # Single birth date field
    date_of_birth = db.Column(db.Date, nullable=True)

    # Financial information for refunds only
    refund_iban = db.Column(db.String(255), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contract_assignments = db.relationship("ContractTenant", backref="tenant", lazy=True, cascade="all, delete-orphan")

    def get_current_contract_assignments(self):
        """Get current active contract assignments for this tenant"""
        today = date.today()
        return [ca for ca in self.contract_assignments if ca.is_active()]

    def get_current_apartments(self):
        """Get apartments this tenant is currently living in"""
        apartments = []
        for assignment in self.get_current_contract_assignments():
            if assignment.contract_period and assignment.contract_period.apartment:
                apartments.append(assignment.contract_period.apartment)
        return list(set(apartments))  # Remove duplicates

    def get_primary_apartment(self):
        """Get primary apartment if tenant has one"""
        for assignment in self.get_current_contract_assignments():
            if assignment.is_primary and assignment.contract_period and assignment.contract_period.apartment:
                return assignment.contract_period.apartment
        # If no primary, return first current apartment
        current_apts = self.get_current_apartments()
        return current_apts[0] if current_apts else None

    def to_dict(self, include_contracts=False, include_current_assignments=False):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("date_of_birth"):
            result["date_of_birth"] = result["date_of_birth"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        if include_current_assignments:
            current_assignments = self.get_current_contract_assignments()
            result["current_contracts"] = [
                {
                    "contract_period_id": assignment.contract_period_id,
                    "apartment_id": assignment.contract_period.apartment_id,
                    "apartment_address": assignment.contract_period.apartment.get_short_address(),
                    "is_primary": assignment.is_primary,
                    "rent_share_percentage": float(assignment.rent_share_percentage) if assignment.rent_share_percentage else 100.0,
                    "move_in_date": assignment.move_in_date.isoformat() if assignment.move_in_date else None,
                    "move_out_date": assignment.move_out_date.isoformat() if assignment.move_out_date else None,
                    "monthly_rent": float(assignment.contract_period.monthly_rent) if assignment.contract_period.monthly_rent else 0,
                    "security_deposit": float(assignment.contract_period.security_deposit) if assignment.contract_period.security_deposit else 0,
                    "status": assignment.contract_period.status
                }
                for assignment in current_assignments
            ]

        return result

    def __repr__(self):
        return f"<Tenant {self.id}: {self.name}>"


class ContractPeriod(db.Model):
    """Contract periods for apartments - tracks different rental periods"""
    __tablename__ = "contract_periods"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    contract_number = db.Column(db.String(50), unique=True, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    monthly_rent = db.Column(db.Numeric(10, 2), nullable=False)
    security_deposit = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.Enum("active", "completed", "terminated", "pending", "future"), default="active")
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(100), nullable=True)

    # Relationships
    contract_tenants = db.relationship("ContractTenant", backref="contract_period", lazy=True, cascade="all, delete-orphan")
    payments = db.relationship("Payment", backref="contract_period", lazy=True)

    def is_active(self, check_date=None):
        """Check if contract is active on given date (default: today)"""
        if check_date is None:
            check_date = date.today()
        return (self.status == "active" and
                self.start_date <= check_date and
                (self.end_date is None or self.end_date >= check_date))

    def get_tenants(self):
        """Get all tenants in this contract period"""
        return [ct.tenant for ct in self.contract_tenants]

    def get_primary_tenant(self):
        """Get the primary tenant for this contract period"""
        for ct in self.contract_tenants:
            if ct.is_primary:
                return ct.tenant
        # If no primary marked, return first tenant
        return self.contract_tenants[0].tenant if self.contract_tenants else None

    def to_dict(self, include_apartment=True, include_tenants=True):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("start_date"):
            result["start_date"] = result["start_date"].isoformat()
        if result.get("end_date"):
            result["end_date"] = result["end_date"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal to float
        if result.get("monthly_rent"):
            result["monthly_rent"] = float(result["monthly_rent"])
        if result.get("security_deposit"):
            result["security_deposit"] = float(result["security_deposit"])

        if include_apartment and self.apartment:
            result["apartment"] = self.apartment.to_dict(include_contract_periods=False, include_tenants=False)

        if include_tenants and self.contract_tenants:
            result["tenants"] = [
                {
                    "tenant_id": ct.tenant_id,
                    "tenant_name": ct.tenant.name,
                    "is_primary": ct.is_primary,
                    "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0,
                    "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None,
                    "move_out_date": ct.move_out_date.isoformat() if ct.move_out_date else None
                }
                for ct in self.contract_tenants
            ]

        return result

    def __repr__(self):
        return f"<ContractPeriod {self.id}: {self.contract_number}>"


class ContractTenant(db.Model):
    """Association between contract periods and tenants with additional details"""
    __tablename__ = "contract_tenants"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)
    move_in_date = db.Column(db.Date, nullable=False)
    move_out_date = db.Column(db.Date, nullable=True)
    rent_share_percentage = db.Column(db.Numeric(5, 2), default=100.00)  # Percentage of rent this tenant pays
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def is_active(self, check_date=None):
        """Check if tenant is active in this contract on given date"""
        if check_date is None:
            check_date = date.today()
        return (self.move_in_date <= check_date and
                (self.move_out_date is None or self.move_out_date >= check_date))

    def get_monthly_rent_share(self):
        """Calculate tenant's share of monthly rent"""
        if self.contract_period and self.contract_period.monthly_rent:
            return float(self.contract_period.monthly_rent) * (float(self.rent_share_percentage) / 100)
        return 0

    def __repr__(self):
        return f"<ContractTenant {self.id}: Contract {self.contract_period_id} - Tenant {self.tenant_id}>"


class Payment(db.Model):
    __tablename__ = "payments"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)

    # Link to contract period (preferred)
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=True)

    # Keep apartment_id for backward compatibility
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=True)

    # Payment period
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)

    # Payment details
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_date = db.Column(db.DateTime, nullable=True)
    payment_method = db.Column(db.String(50), default="bank_transfer")

    # Payment type
    payment_type = db.Column(db.Enum("rent", "deposit", "other"), default="rent")
    deposit_payment = db.Column(db.Boolean, default=False)  # Track if this is a deposit payment

    # Notes
    notes = db.Column(db.Text, nullable=True)

    # Tenant-specific payment data (JSON)
    tenant_payments = db.Column(db.Text, nullable=True)  # JSON string mapping tenant_id to payment details

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def is_paid(self):
        """Check if payment has been made"""
        return self.payment_date is not None

    def get_tenant_payments_dict(self):
        """Parse tenant payments JSON"""
        if self.tenant_payments:
            try:
                return json.loads(self.tenant_payments)
            except:
                return {}
        return {}

    def to_dict(self, include_contract_period=True):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("payment_date"):
            result["payment_date"] = result["payment_date"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal to float
        if result.get("amount"):
            result["amount"] = float(result["amount"])

        # Add computed fields
        result["is_paid"] = self.is_paid()

        # Parse tenant payments
        if self.tenant_payments:
            result["tenant_payments_parsed"] = self.get_tenant_payments_dict()

        if include_contract_period and self.contract_period:
            result["contract_period"] = self.contract_period.to_dict(include_tenants=True, include_apartment=True)

        return result

    def __repr__(self):
        status = "PAID" if self.is_paid() else "OUTSTANDING"
        return f"<Payment {self.id}: {self.month}/{self.year} - {status}>"


class Contract(db.Model):
    """Contract files storage"""
    __tablename__ = "contracts"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=True)
    file_path = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=True)
    file_type = db.Column(db.String(50), nullable=True)
    uploaded_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        return result

    def __repr__(self):
        return f"<Contract {self.id}: {self.file_name}>"


class ContractTemplate(db.Model):
    """Contract templates for generating documents"""
    __tablename__ = "contract_templates"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    is_default = db.Column(db.Boolean, default=False)
    language = db.Column(db.String(10), default="en")
    version = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        return result

    def __repr__(self):
        default_str = " (DEFAULT)" if self.is_default else ""
        return f"<ContractTemplate {self.id}: {self.name}{default_str}>"
