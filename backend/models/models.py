# models/models.py - Fixed version with consistent Payment model
from datetime import date
from flask_bcrypt import Bcrypt
from extentions import db, bcrypt
from datetime import datetime
import json


class Landlord(db.Model):
    """Landlord model to store landlord details separate from apartments"""

    __tablename__ = "landlords"
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(255), nullable=False)
    iban = db.Column(db.String(255), nullable=False)
    company_address = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationship with apartments
    apartments = db.relationship("Apartment", backref="landlord", lazy=True)

    def to_dict(self):
        """Convert Landlord object to dictionary"""
        return {
            "id": self.id,
            "company_name": self.company_name,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "iban": self.iban,
            "company_address": self.company_address,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "apartment_count": len(self.apartments) if self.apartments else 0,
        }


class Apartment(db.Model):
    __tablename__ = "apartments"
    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(255), nullable=False)
    rooms = db.Column(db.Integer, nullable=False)
    size = db.Column(db.Float, nullable=False)

    # Foreign key to landlords table
    landlord_id = db.Column(db.Integer, db.ForeignKey("landlords.id"), nullable=True)

    moveInDate = db.Column(db.Date, nullable=True)
    contractEndDate = db.Column(db.Date, nullable=True)
    rent = db.Column(db.Float, nullable=False)
    deposit = db.Column(db.Float, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False)
    managementFee = db.Column(db.Numeric(5, 2), nullable=True, default=0.00)
    rentCost = db.Column(db.Numeric(10, 2), nullable=True, default=0.00)
    model = db.Column(db.String(50), nullable=True)  # Management or Rental model

    tenants = db.relationship("Tenant", backref="apartment", lazy=True)

    def to_dict(self):
        tenant_data = []
        for tenant in self.tenants:
            tenant_data.append(tenant.to_dict())

        result = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        # Convert date objects to string format
        if self.moveInDate:
            result["moveInDate"] = self.moveInDate.isoformat()
        if self.contractEndDate:
            result["contractEndDate"] = self.contractEndDate.isoformat()

        # Add tenants data if there are any
        if tenant_data:
            result["tenants"] = tenant_data

        # Add landlord data if available
        if self.landlord:
            result["landlord"] = self.landlord.to_dict()

        return result


class Tenant(db.Model):
    __tablename__ = "tenants"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    bornOn = db.Column(db.String(50), nullable=True)
    refundIban = db.Column(db.String(50), nullable=True)
    apartment_id = db.Column(
        db.Integer, db.ForeignKey("apartments.id"), nullable=True
    )  # Nullable for unassigned tenants

    def to_dict(self):
        # Split name into first and last name for frontend
        name_parts = self.name.split(" ", 1) if self.name else ["", ""]
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        return {
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


class User(db.Model):
    __tablename__ = "users"

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
    Unified Payment model that supports both individual and batch payments.
    
    For individual payments:
    - amount, tenant_name, payment_type are set
    - month might be a unique identifier for non-rent payments
    
    For batch payments (legacy):
    - tenants JSON contains multiple tenant payment details
    - amount, tenant_name, payment_type are None/empty
    - month is a standard month name
    """
    __tablename__ = "payments"
    
    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    
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
    
    def to_dict(self):
        # Determine if this is an individual payment
        is_individual = bool(hasattr(self, 'amount') and self.amount and 
                           hasattr(self, 'tenant_name') and self.tenant_name)
        
        result = {
            "id": self.id,
            "apartment_id": self.apartment_id,
            "month": self.month,
            "year": self.year,
            "status": self.status,
            "paymentDate": self.paymentDate.isoformat() if self.paymentDate else None,
            "paymentMethod": getattr(self, 'paymentMethod', None) or "bank_transfer",
            "notes": getattr(self, 'notes', None) or "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "isIndividual": is_individual
        }
        
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
    __tablename__ = "contracts"
    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(100), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)
    uploaded_by = db.Column(
        db.Integer, nullable=True
    )  # User ID who uploaded the contract

    def to_dict(self):
        return {
            "id": self.id,
            "apartment_id": self.apartment_id,
            "fileName": self.file_name,
            "fileSize": self.file_size,
            "fileType": self.file_type,
            "uploadDate": self.upload_date.isoformat() if self.upload_date else None,
            "notes": self.notes,
        }


class ContractTemplate(db.Model):
    __tablename__ = "contract_templates"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)  # Path to the template file
    file_name = db.Column(db.String(255), nullable=True)  # Original filename
    file_size = db.Column(db.Integer, nullable=True)      # File size in bytes
    is_default = db.Column(db.Boolean, default=False)     # Is this the default template
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(80), nullable=True)  # Username who created the template

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
