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
    managementFee = db.Column(db.Float, nullable=True, default=0.0)  # ✅ Add this
    rentCost = db.Column(db.Float, nullable=True, default=0.0)  # ✅ Add this

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
