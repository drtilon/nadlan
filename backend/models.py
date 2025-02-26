# schemas.py
from flask_sqlalchemy import SQLAlchemy
from datetime import date

db = SQLAlchemy()


class Apartment(db.Model):
    __tablename__ = "apartments"

    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(255), nullable=False)
    rooms = db.Column(db.Integer, nullable=False)
    size = db.Column(db.Float, nullable=False)
    tenants = db.Column(db.String(255), nullable=True)
    landlordName = db.Column(db.String(255), nullable=False)
    landlordEmail = db.Column(db.String(255), nullable=False)
    landlordPhone = db.Column(db.String(50), nullable=False)
    moveInDate = db.Column(db.Date, nullable=True)
    contractEndDate = db.Column(db.Date, nullable=True)
    rent = db.Column(db.Float, nullable=False)
    deposit = db.Column(db.Float, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    IBAN = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    management_fee = db.Column(db.Float, nullable=False, default=0.0)
    rent_cost = db.Column(db.Float, nullable=False, default=0.0)

    def to_dict(self):
        return {
            "id": self.id,
            "address": self.address,
            "rooms": self.rooms,
            "size": self.size,
            "tenants": self.tenants,
            "tenantEmail": self.tenantEmail,
            "tenantPhone": self.tenantPhone,
            "landlordName": self.landlordName,
            "landlordEmail": self.landlordEmail,
            "landlordPhone": self.landlordPhone,
            "moveInDate": self.moveInDate.isoformat() if self.moveInDate else None,
            "contractEndDate": self.contractEndDate.isoformat()
            if self.contractEndDate
            else None,
            "rent": self.rent,
            "deposit": self.deposit,
            "notes": self.notes,
            "IBAN": self.IBAN,
            "status": self.status,
            "management_fee": self.management_fee,
            "rent_cost": self.rent_cost,
        }


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
