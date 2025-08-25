# models/models.py - FIXED VERSION with circular reference prevention
from datetime import date
from flask_bcrypt import Bcrypt
from extentions import db, bcrypt
from datetime import datetime
import json


class Landlord(db.Model):
    __tablename__ = "landlords"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(100), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    iban = db.Column(db.String(100), nullable=True)
    company_address = db.Column(db.String(500), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship - NO backref here to avoid conflict
    # apartments will be accessible via backref from Apartment model

    def to_dict(self, include_apartments=True):
        """Convert to dictionary with optional related data"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Convert date objects to string format
        if self.created_at:
            result["created_at"] = self.created_at.isoformat()
        if self.updated_at:
            result["updated_at"] = self.updated_at.isoformat()

        # Add apartments count
        result["apartments_count"] = len(self.apartments) if self.apartments else 0

        if include_apartments and self.apartments:
            result["apartments"] = [apt.to_dict(include_landlord=False, include_tenants=False) for apt in self.apartments]

        return result

    def __repr__(self):
        return f'<Landlord {self.id}: {self.company_name}>'


class Apartment(db.Model):
    __tablename__ = "apartments"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)

    # Address component fields
    street_name = db.Column(db.String(100), nullable=False, default="Unknown Street")
    house_number = db.Column(db.String(20), nullable=False, default="1")
    zip_code = db.Column(db.String(20), nullable=False, default="00000")
    city = db.Column(db.String(50), nullable=False, default="Tel Aviv")
    state = db.Column(db.String(50), nullable=True)  # Optional for international addresses
    country = db.Column(db.String(50), nullable=False, default="Israel")
    building = db.Column(db.String(50), nullable=True)  # Optional (building name/number)
    floor = db.Column(db.String(10), nullable=True)     # Optional (floor number)
    side = db.Column(db.String(10), nullable=True)      # Optional (A, B, left, right, etc.)

    # Full address - computed and stored for performance and search optimization
    full_address = db.Column(db.String(500), nullable=True)  # Computed address stored in DB

    rooms = db.Column(db.Integer, nullable=False)
    size = db.Column(db.Float, nullable=False)
    maxOccupancy = db.Column(db.Integer, nullable=False, default=1)

    # Foreign key to landlords table
    landlord_id = db.Column(db.Integer, db.ForeignKey("landlords.id"), nullable=True)

    # Date fields
    moveInDate = db.Column(db.Date, nullable=True)
    contractEndDate = db.Column(db.Date, nullable=True)

    # Financial fields
    rent = db.Column(db.Float, nullable=False)
    deposit = db.Column(db.Float, nullable=False)
    managementFee = db.Column(db.Numeric(5, 2), nullable=True, default=0.00)
    rentCost = db.Column(db.Numeric(10, 2), nullable=True, default=0.00)

    # Status and model
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False)
    model = db.Column(db.String(50), nullable=True, default="management")  # Management or Rental model

    # Gender preference field for apartments
    genderPreference = db.Column(db.String(20), nullable=True, default="mixed")  # 'mixed', 'men_only', 'women_only'

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships - WITH backref to create landlord.apartments automatically
    tenants = db.relationship("Tenant", backref="apartment", lazy=True)
    landlord = db.relationship("Landlord", backref="apartments", lazy=True)

    def __init__(self, **kwargs):
        """Initialize apartment and compute full address"""
        super().__init__(**kwargs)
        self.update_full_address()

    def update_full_address(self):
        """Update the stored full_address field based on components"""
        parts = [
            self.street_name,
            self.house_number,
            self.zip_code,
            self.city,
            self.state,
            self.country,
            self.building,
            self.floor,
            self.side
        ]
        # Filter out None/empty values and join with commas
        self.full_address = ", ".join(filter(lambda x: x and str(x).strip(), parts))

    @property
    def address(self):
        """Property to get full address (for compatibility)"""
        if not self.full_address:
            self.update_full_address()
        return self.full_address

    def get_short_address(self):
        """Get a shorter version of the address for display"""
        parts = [self.street_name, self.house_number, self.city]
        return ", ".join(filter(lambda x: x and str(x).strip(), parts))

    def get_street_address(self):
        """Get just the street address part"""
        parts = [self.street_name, self.house_number]
        if self.building:
            parts.append(f"Building {self.building}")
        if self.floor:
            parts.append(f"Floor {self.floor}")
        if self.side:
            parts.append(f"Side {self.side}")
        return ", ".join(filter(None, parts))

    def get_location_info(self):
        """Get location information (city, state, country)"""
        parts = [self.city]
        if self.state:
            parts.append(self.state)
        parts.append(self.country)
        return ", ".join(parts)

    def to_dict(self, include_landlord=True, include_tenants=True, include_contract_periods=True):
        """Convert to dictionary with optional related data to prevent circular references"""
        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}

        # Add computed addresses
        result["address"] = self.address  # Full computed address
        result["short_address"] = self.get_short_address()
        result["street_address"] = self.get_street_address()
        result["location_info"] = self.get_location_info()

        # Add address components for frontend
        result["address_components"] = {
            "street_name": self.street_name,
            "house_number": self.house_number,
            "zip_code": self.zip_code,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "building": self.building,
            "floor": self.floor,
            "side": self.side
        }

        # Convert date objects to string format
        if self.moveInDate:
            result["moveInDate"] = self.moveInDate.isoformat()
        if self.contractEndDate:
            result["contractEndDate"] = self.contractEndDate.isoformat()
        if self.created_at:
            result["created_at"] = self.created_at.isoformat()
        if self.updated_at:
            result["updated_at"] = self.updated_at.isoformat()

        # Add tenants data if requested
        if include_tenants and self.tenants:
            result["tenants"] = [
                tenant.to_dict(include_apartment=False, include_contracts=False) if hasattr(tenant, 'to_dict') else {
                    'id': tenant.id,
                    'name': tenant.name,
                    'email': tenant.email,
                    'phone': tenant.phone
                }
                for tenant in self.tenants
            ]

        # Add landlord data if requested and available
        if include_landlord and self.landlord:
            result["landlord"] = self.landlord.to_dict(include_apartments=False) if hasattr(self.landlord, 'to_dict') else {
                'id': self.landlord.id,
                'name': self.landlord.name,
                'company_name': self.landlord.company_name,
                'email': self.landlord.email,
                'phone': self.landlord.phone
            }

        # Add contract periods if requested and available
        if include_contract_periods and hasattr(self, 'contract_periods') and self.contract_periods:
            result["contract_periods"] = [
                cp.to_dict(include_apartment=False) if hasattr(cp, 'to_dict') else {'id': cp.id}
                for cp in self.contract_periods
            ]

        return result

    def __repr__(self):
        return f'<Apartment {self.id}: {self.get_short_address()}>'


class Tenant(db.Model):
    __tablename__ = "tenants"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    bornOn = db.Column(db.String(50), nullable=True)
    refundIban = db.Column(db.String(50), nullable=True)

    # Keep apartment_id for backward compatibility
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_apartment=True, include_contracts=True):
        """Convert to dictionary with optional related data"""
        # Split name into first and last name for frontend
        name_parts = self.name.split(" ", 1) if self.name else ["", ""]
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        result = {
            "id": self.id,
            "name": self.name,
            "firstName": first_name,
            "lastName": last_name,
            "email": self.email,
            "phone": self.phone,
            "bornOn": self.bornOn,
            "refundIban": self.refundIban,
            "apartment_id": self.apartment_id,
        }

        # Convert date objects to string format
        if self.created_at:
            result["created_at"] = self.created_at.isoformat()
        if self.updated_at:
            result["updated_at"] = self.updated_at.isoformat()

        # Add apartment data if requested and available
        if include_apartment and self.apartment:
            result["apartment"] = {
                'id': self.apartment.id,
                'address': self.apartment.address,
                'short_address': self.apartment.get_short_address()
            }

        return result

    def __repr__(self):
        return f'<Tenant {self.id}: {self.name}>'



class ContractPeriod(db.Model):
    """Contract periods for apartments - tracks different rental periods"""
    __tablename__ = "contract_periods"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    contract_number = db.Column(db.String(50), unique=True, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    monthly_rent = db.Column(db.Numeric(10, 2), nullable=False)
    security_deposit = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.Enum('active', 'completed', 'terminated', 'pending'), default='active')
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(80), nullable=True)

    # Relationships
    contract_tenants = db.relationship("ContractTenant", backref="contract_period", lazy=True, cascade="all, delete-orphan")
    payments = db.relationship("Payment", backref="contract_period", lazy=True)

    def to_dict(self, include_apartment=True, include_tenants=True):
        """Convert to dictionary with optional related data"""
        result = {
            "id": self.id,
            "apartment_id": self.apartment_id,
            "contract_number": self.contract_number,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "monthly_rent": float(self.monthly_rent) if self.monthly_rent else 0,
            "security_deposit": float(self.security_deposit) if self.security_deposit else 0,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "is_current": self.is_current_contract(),
            "duration_days": self.get_duration_days(),
            "payments_count": len(self.payments) if self.payments else 0
        }

        if include_tenants:
            result["tenants"] = [
                ct.to_dict(include_contract=False)
                for ct in self.contract_tenants
            ]

        if include_apartment and self.apartment:
            result["apartment_address"] = self.apartment.address

        return result

    def is_current_contract(self):
        """Check if this contract is currently active"""
        today = date.today()
        return (self.start_date <= today and
                (self.end_date is None or self.end_date >= today) and
                self.status == 'active')

    def get_duration_days(self):
        """Get the duration of the contract in days"""
        if not self.start_date:
            return 0
        end_date = self.end_date or date.today()
        return (end_date - self.start_date).days

    def get_tenants_list(self):
        """Get list of tenant names for this contract"""
        return [ct.tenant.name for ct in self.contract_tenants if ct.tenant]


class ContractTenant(db.Model):
    """Junction table linking tenants to contract periods"""
    __tablename__ = "contract_tenants"
    __table_args__ = (
        db.UniqueConstraint('contract_period_id', 'tenant_id', name='unique_contract_tenant'),
        {'extend_existing': True}
    )

    id = db.Column(db.Integer, primary_key=True)
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)
    move_in_date = db.Column(db.Date, nullable=True)
    move_out_date = db.Column(db.Date, nullable=True)
    rent_share_percentage = db.Column(db.Numeric(5, 2), default=100.00)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    tenant = db.relationship("Tenant", backref="contract_assignments", lazy=True)

    def to_dict(self, include_tenant=True, include_contract=True):
        """Convert to dictionary with optional related data"""
        result = {
            "id": self.id,
            "contract_period_id": self.contract_period_id,
            "tenant_id": self.tenant_id,
            "is_primary": self.is_primary,
            "move_in_date": self.move_in_date.isoformat() if self.move_in_date else None,
            "move_out_date": self.move_out_date.isoformat() if self.move_out_date else None,
            "rent_share_percentage": float(self.rent_share_percentage) if self.rent_share_percentage else 100.0,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

        if include_tenant and self.tenant:
            result["tenant"] = self.tenant.to_dict(include_apartment=False, include_contracts=False)

        if include_contract and self.contract_period:
            result["contract_number"] = self.contract_period.contract_number
            result["contract_status"] = self.contract_period.status

        return result



class User(db.Model):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)  # Store hashed password
    role = db.Column(db.String(20), nullable=False, default="user")  # User roles
    is_approved = db.Column(db.Boolean, nullable=False, default=False)

    def set_password(self, password):
        """Hashes and sets the password"""
        self.password = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        """Checks if password matches the hashed password"""
        return bcrypt.check_password_hash(self.password, password)

    def to_dict(self):
        """Convert User object to a dictionary"""
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "is_approved": self.is_approved,
        }


class Payment(db.Model):
    """
    Updated Payment model that supports contract periods and both individual and batch payments.
    """
    __tablename__ = "payments"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)

    # NEW: Link to contract period
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=True)

    # Core payment fields
    month = db.Column(db.String(50), nullable=False)  # Month name or unique identifier
    year = db.Column(db.Integer, nullable=False, default=lambda: datetime.utcnow().year)
    status = db.Column(db.String(50), nullable=False, default="not_paid")

    # Legacy batch payment fields
    tenants = db.Column(db.Text, nullable=True)  # JSON string for batch payments
    internet = db.Column(db.Float, nullable=True, default=0.0)
    electricity = db.Column(db.Float, nullable=True, default=0.0)
    other = db.Column(db.Float, nullable=True, default=0.0)
    extraPayments = db.Column(db.Text, nullable=True)  # JSON string

    # Common payment fields
    paymentDate = db.Column(db.DateTime, nullable=True)
    paymentMethod = db.Column(db.String(50), nullable=True, default="bank_transfer")
    notes = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Individual payment fields (new)
    amount = db.Column(db.Float, nullable=True)  # For individual payments
    tenant_name = db.Column(db.String(255), nullable=True)  # For individual payments
    payment_type = db.Column(db.String(50), nullable=True, default="rent")  # rent, deposit, utilities, other

    def to_dict(self, include_apartment=True, include_contract=True):
        """Convert to dictionary with optional related data to prevent circular references"""
        # Determine if this is an individual payment
        is_individual = bool(hasattr(self, 'amount') and self.amount and
                           hasattr(self, 'tenant_name') and self.tenant_name)

        result = {
            "id": self.id,
            "apartment_id": self.apartment_id,
            "contract_period_id": self.contract_period_id,
            "month": self.month,
            "year": self.year,
            "status": self.status,
            "paymentDate": self.paymentDate.isoformat() if self.paymentDate else None,
            "paymentMethod": getattr(self, 'paymentMethod', None) or "bank_transfer",
            "notes": getattr(self, 'notes', None) or "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "isIndividual": is_individual
        }

        # Add contract information if requested and available
        if include_contract and self.contract_period:
            result["contract_info"] = {
                "contract_number": self.contract_period.contract_number,
                "start_date": self.contract_period.start_date.isoformat(),
                "end_date": self.contract_period.end_date.isoformat() if self.contract_period.end_date else None,
                "tenants": self.contract_period.get_tenants_list()
            }

        # Add apartment info if requested and available
        if include_apartment and self.apartment:
            result["apartment_address"] = self.apartment.address

        if is_individual:
            # Individual payment
            amount_value = getattr(self, 'amount', 0) or 0
            tenant_name_value = getattr(self, 'tenant_name', '') or ''
            payment_type_value = getattr(self, 'payment_type', 'rent') or 'rent'

            result.update({
                "amount": float(amount_value),
                "tenant_name": tenant_name_value,
                "payment_type": payment_type_value,
                "amountPaid": float(amount_value),
                "tenant_names": [tenant_name_value] if tenant_name_value else []
            })
        else:
            # Batch payment (legacy format)
            try:
                tenants_data = json.loads(self.tenants) if self.tenants else []
                total_paid = sum(float(t.get("amountPaid", 0)) for t in tenants_data)
                tenant_names = [t.get("name", "") for t in tenants_data if t.get("name")]

                result.update({
                    "tenants": tenants_data,
                    "amountPaid": total_paid,
                    "tenant_names": tenant_names,
                    "internet": float(self.internet) if self.internet is not None else 0.0,
                    "electricity": float(self.electricity) if self.electricity is not None else 0.0,
                    "other": float(self.other) if self.other is not None else 0.0,
                })

                # Parse extra payments
                try:
                    extra_payments_str = getattr(self, 'extraPayments', None)
                    extra_payments = json.loads(extra_payments_str) if extra_payments_str else {}
                    result["extraPayments"] = extra_payments
                except:
                    result["extraPayments"] = {
                        "internet": result["internet"],
                        "electricity": result["electricity"],
                        "other": result["other"]
                    }
            except Exception as e:
                # Fallback for malformed data
                result.update({
                    "tenants": [],
                    "amountPaid": 0.0,
                    "tenant_names": [],
                    "internet": 0.0,
                    "electricity": 0.0,
                    "other": 0.0,
                    "extraPayments": {}
                })

        return result


class Contract(db.Model):
    """Legacy contract files table - kept for document storage"""
    __tablename__ = "contracts"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(100), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)
    uploaded_by = db.Column(db.Integer, nullable=True)

    # NEW: Link to contract period for better organization
    contract_period_id = db.Column(db.Integer, db.ForeignKey("contract_periods.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "apartment_id": self.apartment_id,
            "contract_period_id": self.contract_period_id,
            "fileName": self.file_name,
            "fileSize": self.file_size,
            "fileType": self.file_type,
            "uploadDate": self.upload_date.isoformat() if self.upload_date else None,
            "notes": self.notes,
        }


class ContractTemplate(db.Model):
    __tablename__ = "contract_templates"
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    file_name = db.Column(db.String(255), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(80), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "has_file": bool(self.file_path and self.file_name)
        }
