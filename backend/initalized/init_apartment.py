from models.models import Apartment, Tenant, User
from extentions import db
from flask import current_app
from datetime import date


def ensure_default_apartment_exists(new_tenants_data=None):
    default_address = "Default Apartment Address"
    existing_apartment = Apartment.query.filter_by(address=default_address).first()

    if not existing_apartment:
        # Create the default apartment
        default_apartment = Apartment(
            address=default_address,
            rooms=3,
            size=100.0,
            landlordCompanyName="Default Company Name",  # Provide a default value here.
            landlordName="Default Landlord",
            landlordEmail="landlord@example.com",
            landlordPhone="1234567890",
            moveInDate=None,
            contractEndDate=None,
            rent=1200.00,
            rentInSentance=1200.00,
            deposit=1200.00,
            notes="Default apartment created on startup",
            landlordIban="DEFAULTIBAN",
            landlordCompanyAddress="Default Company Address",
            status="vacant",
            managementFee=0.00,
            rentCost=0.00,
            model="management",
        )
        db.session.add(default_apartment)
        db.session.commit()
        current_app.logger.info("Default apartment created.")

        # Add tenant(s) using the provided new tenant data if available,
        # otherwise add two default tenants.
        if new_tenants_data:
            new_tenants = []
            for tenant_data in new_tenants_data:
                tenant = Tenant(
                    name=tenant_data.get("name", "Default Tenant"),
                    email=tenant_data.get("email"),
                    phone=tenant_data.get("phone"),
                    bornOn=tenant_data.get("bornOn"),
                    refundIban=tenant_data.get("refundIban"),
                    apartment_id=default_apartment.id,
                )
                new_tenants.append(tenant)
            db.session.add_all(new_tenants)
            db.session.commit()
            current_app.logger.info("New tenant data added for the default apartment.")
        else:
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

        # Update the apartment status if it's "available"
        if existing_apartment.status == "available":
            existing_apartment.status = "vacant"
            db.session.commit()
            current_app.logger.info(
                "Updated default apartment status from 'available' to 'vacant'."
            )

        # Add model if it's missing
        if not existing_apartment.model:
            existing_apartment.model = "management"
            db.session.commit()
            current_app.logger.info("Added missing model field to default apartment.")

        # If new tenant data is provided, add those tenants
        if new_tenants_data:
            for tenant_data in new_tenants_data:
                tenant = Tenant(
                    name=tenant_data.get("name", "Default Tenant"),
                    email=tenant_data.get("email"),
                    phone=tenant_data.get("phone"),
                    bornOn=tenant_data.get("bornOn"),
                    refundIban=tenant_data.get("refundIban"),
                    apartment_id=existing_apartment.id,
                )
                db.session.add(tenant)
            db.session.commit()
            current_app.logger.info(
                "New tenant data added to the existing default apartment."
            )
        else:
            # Check the number of tenants in the existing apartment
            tenants = existing_apartment.tenants
            num_tenants = len(tenants)

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
