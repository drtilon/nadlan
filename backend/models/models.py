from datetime import date
from flask_bcrypt import Bcrypt
from extentions import db, bcrypt
from datetime import datetime


class Apartment(db.Model):
    __tablename__ = "apartments"
    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(255), nullable=False)
    rooms = db.Column(db.Integer, nullable=False)
    size = db.Column(db.Float, nullable=False)
    landlordCompanyName = db.Column(db.String(255), nullable=False)
    landlordName = db.Column(db.String(255), nullable=False)
    landlordEmail = db.Column(db.String(255), nullable=False)
    landlordPhone = db.Column(db.String(255), nullable=False)
    landlordIban = db.Column(db.String(255), nullable=False)
    landlordCompanyAddress = db.Column(db.String(255), nullable=False)
    moveInDate = db.Column(db.Date, nullable=True)
    contractEndDate = db.Column(db.Date, nullable=True)
    rent = db.Column(db.Float, nullable=False)
    rentInSentance = db.Column(db.String(255), nullable=False)
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
    __tablename__ = "payments"
    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)
    month = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(50), nullable=False, default="not_paid")
    tenants = db.Column(db.Text, nullable=True)  # stored as JSON
    internet = db.Column(db.Float, nullable=True, default=0.0)
    electricity = db.Column(db.Float, nullable=True, default=0.0)
    other = db.Column(db.Float, nullable=True, default=0.0)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    # New fields for payment history
    paymentDate = db.Column(db.DateTime, nullable=True)
    paymentMethod = db.Column(db.String(50), nullable=True, default="bank_transfer")
    extraPayments = db.Column(db.Text, nullable=True)  # stored as JSON
    notes = db.Column(db.Text, nullable=True)
    year = db.Column(db.Integer, nullable=True)  # Store the year for historical records


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
