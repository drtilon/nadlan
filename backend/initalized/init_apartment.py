from models.models import Apartment, Tenant, User
from extentions import db
from flask import current_app
from datetime import date


def ensure_default_apartment_exists(new_tenants_data=None):
    default_address = "Default Apartment Address"
    default_apartment = Apartment.query.filter_by(address=default_address).first()

    if not default_apartment:
        # Create the default apartment with all attributes
        default_apartment = Apartment(
            address=default_address,
            rooms=3,
            size=100.0,
            landlordCompanyName="Default Company Name",
            landlordName="Default Landlord",
            landlordEmail="landlord@example.com",
            landlordPhone="1234567890",
            landlordIban="DEFAULTIBAN",
            landlordCompanyAddress="Default Company Address",
            moveInDate=None,
            contractEndDate=None,
            rent=1200.00,
            rentInSentance="One thousand and two hundred",
            deposit=100.00,
            notes="Default apartment created on startup",
            status="vacant",
            managementFee=0.00,
            rentCost=0.00,
            model="management",
        )
        db.session.add(default_apartment)
        db.session.commit()
        current_app.logger.info("Default apartment created.")
    else:
        current_app.logger.info("Default apartment already exists.")
        updated = False

        if default_apartment.status == "available":
            default_apartment.status = "vacant"
            updated = True
            current_app.logger.info(
                "Updated default apartment status from 'available' to 'vacant'."
            )
        if not default_apartment.model:
            default_apartment.model = "management"
            updated = True
            current_app.logger.info("Added missing model field to default apartment.")

        default_attrs = {
            "rooms": 3,
            "size": 100.0,
            "landlordCompanyName": "Default Company Name",
            "landlordName": "Default Landlord",
            "landlordEmail": "landlord@example.com",
            "landlordPhone": "1234567890",
            "landlordIban": "DEFAULTIBAN",
            "landlordCompanyAddress": "Default Company Address",
            "moveInDate": None,
            "contractEndDate": None,
            "rent": 1200.00,
            "rentInSentance": "One thousand and two hundred",
            "deposit": 100.00,
            "notes": "Default apartment created on startup",
            "status": "vacant",
            "managementFee": 0.00,
            "rentCost": 0.00,
            "model": "management",
        }
        for attr, default_value in default_attrs.items():
            if getattr(default_apartment, attr, None) is None:
                setattr(default_apartment, attr, default_value)
                updated = True
                current_app.logger.info(
                    f"Set missing attribute '{attr}' to default value."
                )
        if updated:
            db.session.commit()

    # Tenant handling: add tenant(s) to the default apartment.
    if new_tenants_data:
        # Create tenants using provided tenant data
        for tenant_data in new_tenants_data:
            tenant = Tenant(
                name=tenant_data.get("name", "Default Tenant"),
                email=tenant_data.get("email"),
                phone=tenant_data.get("phone"),
                bornOn=tenant_data.get("bornOn", "1970-01-01"),
                refundIban=tenant_data.get("refundIban", "DEFAULT_REFUND_IBAN"),
                apartment_id=default_apartment.id,
            )
            db.session.add(tenant)
        db.session.commit()
        current_app.logger.info("New tenant data added for the default apartment.")
    else:
        # Ensure the default apartment has at least two tenants.
        current_tenants = default_apartment.tenants or []
        num_tenants = len(current_tenants)
        if num_tenants < 2:
            tenants_needed = 2 - num_tenants
            for i in range(tenants_needed):
                tenant = Tenant(
                    name=f"Default Tenant {num_tenants + i + 1}",
                    email=f"default_tenant{num_tenants + i + 1}@example.com",
                    phone="0000000000",
                    bornOn="1970-01-01",
                    refundIban="DEFAULT_REFUND_IBAN",
                    apartment_id=default_apartment.id,
                )
                db.session.add(tenant)
            db.session.commit()
            current_app.logger.info(
                "Added missing default tenant(s) for the default apartment."
            )
        else:
            current_app.logger.info(
                "Default apartment already has two or more tenants."
            )


def ensure_new_apartment_exists(new_tenants_data=None):
    new_address = "New Apartment Address"
    new_apartment = Apartment.query.filter_by(address=new_address).first()

    if not new_apartment:
        # Create the new apartment with all attributes
        new_apartment = Apartment(
            address=new_address,
            rooms=3,
            size=100.0,
            landlordCompanyName="New Company Name",
            landlordName="New Landlord",
            landlordEmail="newlandlord@example.com",
            landlordPhone="0987654321",
            landlordIban="NEWIBAN",
            landlordCompanyAddress="New Company Address",
            moveInDate=None,
            contractEndDate=None,
            rent=1500.00,
            rentInSentance="One thousand five hundred",
            deposit=200.00,
            notes="New apartment created on startup",
            status="vacant",
            managementFee=0.00,
            rentCost=0.00,
            model="management",
        )
        db.session.add(new_apartment)
        db.session.commit()
        current_app.logger.info("New apartment created.")
    else:
        current_app.logger.info("New apartment already exists.")
        updated = False

        if new_apartment.status == "available":
            new_apartment.status = "vacant"
            updated = True
            current_app.logger.info(
                "Updated new apartment status from 'available' to 'vacant'."
            )
        if not new_apartment.model:
            new_apartment.model = "management"
            updated = True
            current_app.logger.info("Added missing model field to new apartment.")

        default_attrs = {
            "rooms": 3,
            "size": 100.0,
            "landlordCompanyName": "New Company Name",
            "landlordName": "New Landlord",
            "landlordEmail": "newlandlord@example.com",
            "landlordPhone": "0987654321",
            "landlordIban": "NEWIBAN",
            "landlordCompanyAddress": "New Company Address",
            "moveInDate": None,
            "contractEndDate": None,
            "rent": 1500.00,
            "rentInSentance": "One thousand five hundred",
            "deposit": 200.00,
            "notes": "New apartment created on startup",
            "status": "vacant",
            "managementFee": 0.00,
            "rentCost": 0.00,
            "model": "management",
        }
        for attr, default_value in default_attrs.items():
            if getattr(new_apartment, attr, None) is None:
                setattr(new_apartment, attr, default_value)
                updated = True
                current_app.logger.info(
                    f"Set missing attribute '{attr}' to default value."
                )
        if updated:
            db.session.commit()

    # Tenant handling: add tenant(s) to the new apartment.
    if new_tenants_data:
        # Create tenants using provided tenant data
        for tenant_data in new_tenants_data:
            tenant = Tenant(
                name=tenant_data.get("name", "New Apartment Tenant"),
                email=tenant_data.get("email"),
                phone=tenant_data.get("phone"),
                bornOn=tenant_data.get("bornOn", "1970-01-01"),
                refundIban=tenant_data.get("refundIban", "DEFAULT_REFUND_IBAN"),
                apartment_id=new_apartment.id,
            )
            db.session.add(tenant)
        db.session.commit()
        current_app.logger.info("New tenant data added for the new apartment.")
    else:
        # Ensure the new apartment has at least four tenants.
        current_tenants = new_apartment.tenants or []
        num_tenants = len(current_tenants)
        if num_tenants < 4:
            tenants_needed = 4 - num_tenants
            for i in range(tenants_needed):
                tenant = Tenant(
                    name=f"New Apartment Tenant {num_tenants + i + 1}",
                    email=f"new_apartment_tenant{num_tenants + i + 1}@example.com",
                    phone="0000000000",
                    bornOn="1970-01-01",
                    refundIban="DEFAULT_REFUND_IBAN",
                    apartment_id=new_apartment.id,
                )
                db.session.add(tenant)
            db.session.commit()
            current_app.logger.info(
                "Added missing default tenant(s) for the new apartment."
            )
        else:
            current_app.logger.info("New apartment already has four or more tenants.")
