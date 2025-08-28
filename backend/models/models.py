# models/models.py - Complete Fixed Database Models
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

    # Location fields
    full_address = db.Column(db.String(500), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    street_name = db.Column(db.String(100), nullable=True)
    house_number = db.Column(db.String(20), nullable=True)
    building = db.Column(db.String(50), nullable=True)
    floor = db.Column(db.String(10), nullable=True)
    side = db.Column(db.String(10), nullable=True)
    zip_code = db.Column(db.String(20), nullable=True)
    city = db.Column(db.String(50), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    country = db.Column(db.String(50), default="Israel")

    # Property model and financial information
    model = db.Column(db.String(20), default="rental")  # 'management' or 'rental'
    rent = db.Column(db.Numeric(10, 2), nullable=False, default=1000.00)
    deposit = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)

    # NEW FIELDS - Management Fee and Rent Cost
    managementFee = db.Column(db.Numeric(10, 2), nullable=True, default=0.00)  # For management model - percentage or fixed amount
    rentCost = db.Column(db.Numeric(10, 2), nullable=True, default=0.00)      # For rental model - what we pay to landlord

    # Property details
    rooms = db.Column(db.Integer, default=1)
    bedrooms = db.Column(db.Integer, default=1)
    bathrooms = db.Column(db.Integer, default=1)
    area = db.Column(db.Numeric(10, 2), nullable=True)
    maxOccupancy = db.Column(db.Integer, default=4)
    genderPreference = db.Column(db.String(20), default="mixed")

    # Status and notes
    status = db.Column(db.String(20), default="vacant")
    notes = db.Column(db.Text, nullable=True)

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
        if self.address:
            return self.address
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
        """Convert to dictionary with optional related data - UPDATED to include new financial fields"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()
        if result.get("moveInDate"):
            result["moveInDate"] = result["moveInDate"].isoformat()
        if result.get("contractEndDate"):
            result["contractEndDate"] = result["contractEndDate"].isoformat()

        # Convert Decimal to float - INCLUDING NEW FINANCIAL FIELDS
        if result.get("rent"):
            result["rent"] = float(result["rent"])
        if result.get("deposit"):
            result["deposit"] = float(result["deposit"])
        if result.get("managementFee"):
            result["managementFee"] = float(result["managementFee"])
        if result.get("rentCost"):
            result["rentCost"] = float(result["rentCost"])
        if result.get("area"):
            result["area"] = float(result["area"])

        # Ensure new financial fields are always present with default values
        if "managementFee" not in result or result["managementFee"] is None:
            result["managementFee"] = 0.0
        if "rentCost" not in result or result["rentCost"] is None:
            result["rentCost"] = 0.0
        if "model" not in result or result["model"] is None:
            result["model"] = "rental"

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
            result["current_tenant_count"] = len(current_tenants)
            result["is_full"] = len(current_tenants) >= self.maxOccupancy

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
        return [ca for ca in self.contract_assignments if ca.is_active()]

    def get_current_apartments(self):
        """Get apartments this tenant is currently living in"""
        apartments = []
        for assignment in self.get_current_contract_assignments():
            if assignment.contract_period and assignment.contract_period.apartment:
                apartments.append(assignment.contract_period.apartment)
        return list(set(apartments))  # Remove duplicates

    @property
    def current_contracts(self):
        """
        Property to return current contracts in the format expected by frontend
        This matches the structure from your tenant data
        """
        current_assignments = self.get_current_contract_assignments()
        contracts = []

        for assignment in current_assignments:
            if assignment.contract_period and assignment.contract_period.apartment:
                contract = assignment.contract_period
                apartment = contract.apartment

                contract_info = {
                    "apartment_address": apartment.address if apartment else f"Apartment ID {contract.apartment_id}",
                    "apartment_id": contract.apartment_id,
                    "contract_period_id": contract.id,
                    "is_primary": assignment.is_primary,
                    "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else 0.0,
                    "move_in_date": assignment.move_in_date.isoformat() if assignment.move_in_date else None,
                    "move_out_date": assignment.move_out_date.isoformat() if assignment.move_out_date else None,
                    "rent_share_percentage": float(assignment.rent_share_percentage) if assignment.rent_share_percentage else 0.0,
                    "security_deposit": float(contract.security_deposit) if contract.security_deposit else 0.0,
                    "status": contract.status
                }
                contracts.append(contract_info)

        return contracts

    def to_dict(self, include_contracts=True, include_historical=False, include_current_assignments=None):
        """
        Convert to dictionary with enhanced contract information
        FIXED: Added include_current_assignments parameter to maintain compatibility
        """
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("date_of_birth"):
            result["date_of_birth"] = result["date_of_birth"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Handle legacy parameter name mapping
        if include_current_assignments is not None:
            include_contracts = include_current_assignments

        # FIXED: Include current contracts using the property
        if include_contracts:
            result["current_contracts"] = self.current_contracts

        # Include historical contracts if requested
        if include_historical:
            historical_assignments = [ca for ca in self.contract_assignments if not ca.is_active()]
            historical_contracts = []

            for assignment in historical_assignments:
                if assignment.contract_period and assignment.contract_period.apartment:
                    contract = assignment.contract_period
                    apartment = contract.apartment

                    historical_info = {
                        "apartment_address": apartment.address if apartment else f"Apartment ID {contract.apartment_id}",
                        "move_in_date": assignment.move_in_date.isoformat() if assignment.move_in_date else None,
                        "move_out_date": assignment.move_out_date.isoformat() if assignment.move_out_date else None,
                        "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else 0.0,
                        "rent_share_percentage": float(assignment.rent_share_percentage) if assignment.rent_share_percentage else 0.0,
                    }
                    historical_contracts.append(historical_info)

            result["historical_contracts"] = historical_contracts

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
        """
        FIXED: Check if this contract assignment is currently active
        An assignment is active if:
        1. There's no move_out_date (or it's in the future)
        2. The associated contract period is active
        3. The move_in_date is in the past or today
        """
        if check_date is None:
            check_date = date.today()

        # Check if moved out
        if self.move_out_date and self.move_out_date <= check_date:
            return False

        # Check if moved in yet
        if self.move_in_date and self.move_in_date > check_date:
            return False

        # Check if contract period is active
        if self.contract_period and not self.contract_period.is_active(check_date):
            return False

        return True

    def to_dict(self):
        """Convert to dictionary"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("move_in_date"):
            result["move_in_date"] = result["move_in_date"].isoformat()
        if result.get("move_out_date"):
            result["move_out_date"] = result["move_out_date"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal to float
        if result.get("rent_share_percentage"):
            result["rent_share_percentage"] = float(result["rent_share_percentage"])

        # Add tenant and contract info
        if self.tenant:
            result["tenant"] = {
                "id": self.tenant.id,
                "name": self.tenant.name,
                "email": self.tenant.email,
                "phone": self.tenant.phone
            }

        if self.contract_period:
            result["contract_period"] = {
                "id": self.contract_period.id,
                "contract_number": self.contract_period.contract_number,
                "start_date": self.contract_period.start_date.isoformat() if self.contract_period.start_date else None,
                "end_date": self.contract_period.end_date.isoformat() if self.contract_period.end_date else None,
                "monthly_rent": float(self.contract_period.monthly_rent) if self.contract_period.monthly_rent else 0.0,
                "status": self.contract_period.status
            }

        # Add computed fields
        result["is_current"] = self.is_active()

        return result

    def __repr__(self):
        tenant_name = self.tenant.name if self.tenant else f"Tenant {self.tenant_id}"
        contract_num = self.contract_period.contract_number if self.contract_period else f"Contract {self.contract_period_id}"
        return f"<ContractTenant {self.id}: {tenant_name} -> {contract_num}>"


class Payment(db.Model):
    """Payment records for rent and other charges"""
    __tablename__ = "payments"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)

    # Foreign keys
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=True)

    # Payment details
    month = db.Column(db.Integer, nullable=False)  # 1-12
    year = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_date = db.Column(db.Date, nullable=True)  # Null if unpaid
    payment_method = db.Column(db.String(50), nullable=True)
    payment_type = db.Column(db.Enum("rent", "deposit", "utilities", "other"), default="rent")

    # Additional charges
    internet = db.Column(db.Numeric(8, 2), default=0.00)
    electricity = db.Column(db.Numeric(8, 2), default=0.00)
    other = db.Column(db.Numeric(8, 2), default=0.00)

    # Tenant-specific payment details (JSON)
    tenant_payments = db.Column(db.Text, nullable=True)  # JSON string
    tenants = db.Column(db.Text, nullable=True)  # Legacy field
    extraPayments = db.Column(db.Text, default="{}")  # Legacy field

    # Status and notes
    status = db.Column(db.String(20), default="outstanding")  # outstanding, paid, partial
    notes = db.Column(db.Text, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def is_paid(self):
        """Check if payment is fully paid"""
        return self.payment_date is not None and self.status == "paid"

    def get_tenant_payments(self):
        """Get tenant payment details as dictionary"""
        if self.tenant_payments:
            try:
                return json.loads(self.tenant_payments)
            except json.JSONDecodeError:
                return {}
        return {}

    def set_tenant_payments(self, payments_dict):
        """Set tenant payment details from dictionary"""
        self.tenant_payments = json.dumps(payments_dict)

    def to_dict(self, include_contract_period=True):
        """Convert to dictionary"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("payment_date"):
            result["payment_date"] = result["payment_date"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal to float
        numeric_fields = ["amount", "internet", "electricity", "other"]
        for field in numeric_fields:
            if result.get(field):
                result[field] = float(result[field])

        # Parse JSON fields
        result["tenant_payments_data"] = self.get_tenant_payments()

        # Add computed fields
        result["is_paid"] = self.is_paid()
        result["month_year"] = f"{result['year']}-{str(result['month']).zfill(2)}"

        # Include contract period info
        if include_contract_period and self.contract_period:
            result["contract_period"] = {
                "id": self.contract_period.id,
                "contract_number": self.contract_period.contract_number,
                "apartment_address": self.contract_period.apartment.address if self.contract_period.apartment else None
            }

        return result

    def __repr__(self):
        status = "PAID" if self.is_paid() else "OUTSTANDING"
        return f"<Payment {self.id}: {self.month}/{self.year} - €{self.amount} ({status})>"


class Contract(db.Model):
    """File-based contracts (PDFs, Word docs, etc.)"""
    __tablename__ = "contracts"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    mime_type = db.Column(db.String(100), nullable=True)
    contract_type = db.Column(db.String(50), default="rental_agreement")
    description = db.Column(db.Text, nullable=True)
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
