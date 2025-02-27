from models.models import Apartment, Tenant, User
from extentions import db
from flask import current_app


def ensure_default_apartment_exists():
    default_address = "Default Apartment Address"
    existing_apartment = Apartment.query.filter_by(address=default_address).first()

    if not existing_apartment:
        # Create the default apartment
        default_apartment = Apartment(
            address=default_address,
            rooms=3,
            size=100.0,
            landlordName="Default Landlord",
            landlordEmail="landlord@example.com",
            landlordPhone="1234567890",
            moveInDate=None,  # or use date.today()
            contractEndDate=None,
            rent=1200.00,
            deposit=1200.00,
            notes="Default apartment created on startup",
            IBAN="DEFAULTIBAN",
            status="available",
            managementFee=0.00,
            rentCost=0.00,
        )
        db.session.add(default_apartment)
        db.session.commit()
        current_app.logger.info("Default apartment created.")

        # Create two default tenants for the newly created apartment
        tenant1 = Tenant(
            name="Default Tenant 1",
            email="tenant1@example.com",
            phone="1111111111",
            apartment_id=default_apartment.id,
        )
        tenant2 = Tenant(
            name="Default Tenant 2",
            email="tenant2@example.com",
            phone="2222222222",
            apartment_id=default_apartment.id,
        )
        db.session.add_all([tenant1, tenant2])
        db.session.commit()
        current_app.logger.info("Two default tenants created for the apartment.")

    else:
        current_app.logger.info("Default apartment already exists.")
        # Check the number of tenants in the existing apartment
        num_tenants = len(existing_apartment.tenants)
        if num_tenants < 2:
            tenants_needed = 2 - num_tenants
            for i in range(tenants_needed):
                tenant = Tenant(
                    name=f"Default Tenant {num_tenants + i + 1}",
                    email=f"default_tenant{num_tenants + i + 1}@example.com",
                    phone="0000000000",
                    apartment_id=existing_apartment.id,
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
