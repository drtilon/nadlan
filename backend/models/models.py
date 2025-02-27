from datetime import date
from flask_bcrypt import Bcrypt
from extentions import db, bcrypt


class Apartment(db.Model):
    __tablename__ = "apartments"
    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(255), nullable=False)
    rooms = db.Column(db.Integer, nullable=False)
    size = db.Column(db.Float, nullable=False)
    landlordName = db.Column(db.String(255), nullable=False)
    landlordEmail = db.Column(db.String(255), nullable=False)
    landlordPhone = db.Column(db.String(255), nullable=False)
    moveInDate = db.Column(db.Date, nullable=True)
    contractEndDate = db.Column(db.Date, nullable=True)
    rent = db.Column(db.Float, nullable=False)
    deposit = db.Column(db.Float, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    IBAN = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    managementFee = db.Column(db.Numeric(5, 2), nullable=True, default=0.00)
    rentCost = db.Column(db.Numeric(10, 2), nullable=True, default=0.00)

    tenants = db.relationship("Tenant", backref="apartment", lazy=True)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Tenant(db.Model):
    __tablename__ = "tenants"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
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
