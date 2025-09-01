# models/models.py - FIXED VERSION - Relationship conflict resolved
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

        # Convert datetime fields to ISO format strings
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal fields to float for JSON serialization
        for field in ["rent", "deposit", "managementFee", "rentCost", "area"]:
            if result.get(field) is not None:
                result[field] = float(result[field])

        # Add related data if requested
        if include_contract_periods and self.contract_periods:
            result["contract_periods"] = [cp.to_dict(include_apartment=False, include_tenants=True) for cp in self.contract_periods]

        if include_tenants:
            result["current_tenants"] = [tenant.to_dict() for tenant in self.get_current_tenants()]

        if include_landlord and self.landlord:
            result["landlord"] = self.landlord.to_dict()

        return result

    def __repr__(self):
        return f"<Apartment {self.id}: {self.get_short_address()}>"
    def get_latest_contract_number(self):
        """Get the latest active contract number for this apartment"""
        current_contracts = self.get_current_contract_periods()
        if current_contracts:
            # Get the most recent contract (by start_date)
            latest_contract = max(current_contracts, key=lambda c: c.start_date)
            return latest_contract.contract_number

        # Fallback to the most recent contract even if not active
        from sqlalchemy import desc
        latest_contract = (
            db.session.query(ContractPeriod)
            .filter_by(apartment_id=self.id)
            .order_by(desc(ContractPeriod.start_date))
            .first()
        )

        return latest_contract.contract_number if latest_contract else None



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
                    "rent_share_percentage": float(assignment.rent_share_percentage) if assignment.rent_share_percentage else 100.0
                }

                contracts.append(contract_info)

        return contracts

    def to_dict(self, include_contracts=True, include_historical_contracts=False):
        """Convert to dictionary with optional contract data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert datetime fields to ISO format strings
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()
        if result.get("date_of_birth"):
            result["date_of_birth"] = result["date_of_birth"].isoformat()

        # Add current contracts
        if include_contracts:
            result["current_contracts"] = self.current_contracts

        # Add historical contracts if requested
        if include_historical_contracts:
            all_assignments = self.contract_assignments
            historical_contracts = []

            for assignment in all_assignments:
                if assignment.contract_period:
                    contract = assignment.contract_period
                    apartment = contract.apartment if contract else None

                    historical_contract = {
                        "contract_period_id": contract.id if contract else None,
                        "contract_number": contract.contract_number if contract else "Unknown",
                        "apartment_address": apartment.address if apartment else f"Apartment ID {contract.apartment_id if contract else 'Unknown'}",
                        "apartment_id": contract.apartment_id if contract else None,
                        "start_date": contract.start_date.isoformat() if contract and contract.start_date else None,
                        "end_date": contract.end_date.isoformat() if contract and contract.end_date else None,
                        "move_in_date": assignment.move_in_date.isoformat() if assignment.move_in_date else None,
                        "move_out_date": assignment.move_out_date.isoformat() if assignment.move_out_date else None,
                        "is_primary": assignment.is_primary,
                        "rent_share_percentage": float(assignment.rent_share_percentage) if assignment.rent_share_percentage else 100.0,
                        "monthly_rent": float(contract.monthly_rent) if contract and contract.monthly_rent else 0.0,
                        "is_active": assignment.is_active()
                    }

                    historical_contracts.append(historical_contract)

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
        3. The move_in_date has passed
        """
        if check_date is None:
            check_date = date.today()

        # Check if tenant has moved out
        if self.move_out_date and self.move_out_date <= check_date:
            return False

        # Check if tenant has moved in yet
        if self.move_in_date and self.move_in_date > check_date:
            return False

        # Check if the contract period itself is active
        if self.contract_period:
            return self.contract_period.is_active(check_date)

        return False

    def to_dict(self, include_tenant=True, include_contract_period=True):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects to ISO format strings
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

        if include_tenant and self.tenant:
            result["tenant"] = {
                "id": self.tenant.id,
                "name": self.tenant.name,
                "email": self.tenant.email,
                "phone": self.tenant.phone
            }

        if include_contract_period and self.contract_period:
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
    payment_date = db.Column(db.Date, nullable=True)
    payment_method = db.Column(db.String(50), nullable=True)
    payment_type = db.Column(db.String(50), default="rent")

    # Additional charges
    internet = db.Column(db.Numeric(10, 2), default=0.00)
    electricity = db.Column(db.Numeric(10, 2), default=0.00)
    other = db.Column(db.Numeric(10, 2), default=0.00)

    # JSON fields for complex data
    tenant_payments = db.Column(db.Text, nullable=True)  # JSON string
    extraPayments = db.Column(db.Text, default="{}")    # JSON string

    # Status and metadata
    status = db.Column(db.String(20), default="outstanding")
    notes = db.Column(db.Text, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_apartment=True, include_contract_period=True):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert datetime and date objects to ISO format strings
        if result.get("payment_date"):
            result["payment_date"] = result["payment_date"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal fields to float
        for field in ["amount", "internet", "electricity", "other"]:
            if result.get(field) is not None:
                result[field] = float(result[field])

        # Parse JSON fields
        if result.get("tenant_payments"):
            try:
                result["tenant_payments"] = json.loads(result["tenant_payments"])
            except:
                result["tenant_payments"] = []

        if result.get("extraPayments"):
            try:
                result["extraPayments"] = json.loads(result["extraPayments"])
            except:
                result["extraPayments"] = {}

        if include_apartment and self.apartment:
            result["apartment"] = self.apartment.to_dict(include_contract_periods=False, include_tenants=False)

        if include_contract_period and self.contract_period:
            result["contract_period"] = self.contract_period.to_dict(include_apartment=False, include_tenants=False)

        return result

    def __repr__(self):
        return f"<Payment {self.id}: {self.year}-{self.month:02d} - ₪{self.amount}>"


class Contract(db.Model):
    """File contracts for apartments - FIXED VERSION"""
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

    # FIXED: Remove the conflicting relationship - Apartment already has backref
    # apartment = db.relationship("Apartment", backref="contracts")  # REMOVED THIS LINE

    def to_dict(self):
        """Convert to dictionary - FIXED to match frontend expectations"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert datetime fields to ISO format
        created_at_iso = result.get("created_at").isoformat() if result.get("created_at") else None
        updated_at_iso = result.get("updated_at").isoformat() if result.get("updated_at") else None

        # Get file extension from filename for fileType
        file_extension = "Unknown"
        if result.get("file_name"):
            parts = result["file_name"].rsplit('.', 1)
            if len(parts) > 1:
                file_extension = parts[1].upper()

        # Map backend field names to frontend expected names
        frontend_result = {
            "id": result.get("id"),
            "fileName": result.get("file_name", "Unknown"),  # Frontend expects fileName
            "fileSize": result.get("file_size", 0),  # Frontend expects fileSize
            "fileType": file_extension,  # Frontend expects fileType (file extension)
            "uploadDate": created_at_iso,  # Frontend expects uploadDate
            "notes": result.get("description") or "No notes",  # Frontend expects notes
            "apartmentId": result.get("apartment_id"),
            "mimeType": result.get("mime_type"),
            "filePath": result.get("file_path"),
            "contractType": result.get("contract_type", "rental_agreement"),
            "createdAt": created_at_iso,
            "updatedAt": updated_at_iso
        }

        return frontend_result

    def get_file_size_mb(self):
        """Get file size in MB"""
        if self.file_size:
            return round(self.file_size / (1024 * 1024), 2)
        return 0

    def get_file_extension(self):
        """Get file extension from filename"""
        if self.file_name and '.' in self.file_name:
            return self.file_name.rsplit('.', 1)[1].lower()
        return None

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

class UnassignedPayment(db.Model):
    """Temporary storage for CSV payments that haven't been assigned to tenants yet"""
    __tablename__ = "unassigned_payments"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)

    # Original CSV data
    name_from_csv = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_date = db.Column(db.Date, nullable=True)
    description = db.Column(db.Text, nullable=True)
    csv_line = db.Column(db.Integer, nullable=True)  # Line number from CSV for reference

    # Matching info
    matched_tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=True)
    matched_apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=True)
    similarity_score = db.Column(db.Float, nullable=True)

    # Status
    status = db.Column(db.String(20), default="unassigned")  # unassigned, matched, assigned, rejected

    # Processing info
    processed_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_by = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # Additional CSV fields that might be useful
    reference = db.Column(db.String(500), nullable=True)  # Transaction reference from CSV
    sender = db.Column(db.String(255), nullable=True)     # Alternative to name_from_csv

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tenant = db.relationship("Tenant", backref="unassigned_payments", lazy=True)
    apartment = db.relationship("Apartment", backref="unassigned_payments", lazy=True)

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date/datetime objects
        if result.get("payment_date"):
            result["payment_date"] = result["payment_date"].isoformat()
        if result.get("processed_at"):
            result["processed_at"] = result["processed_at"].isoformat()
        if result.get("created_at"):
            result["created_at"] = result["created_at"].isoformat()
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()

        # Convert Decimal to float
        if result.get("amount"):
            result["amount"] = float(result["amount"])
        if result.get("similarity_score"):
            result["similarity_score"] = float(result["similarity_score"])

        # Add tenant info if matched
        if self.tenant:
            result["tenant_name"] = self.tenant.name
            result["tenant_email"] = self.tenant.email

        # Add apartment info if matched
        if self.apartment:
            result["apartment_address"] = self.apartment.get_short_address()

        return result

    def __repr__(self):
        return f"<UnassignedPayment {self.id}: {self.name_from_csv} - ${self.amount} ({self.status})>"
