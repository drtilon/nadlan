# initalized/init_landlord.py
from models.models import Landlord
from extentions import db
from flask import current_app


def ensure_default_landlords_exist():
    """
    Ensures that default landlords exist in the database.
    Creates them if they don't exist.
    """
    # Create the first default landlord
    default_landlord_name = "Default Company Name"
    default_landlord = Landlord.query.filter_by(
        company_name=default_landlord_name
    ).first()

    if not default_landlord:
        # Create the default landlord with all attributes
        default_landlord = Landlord(
            company_name=default_landlord_name,
            name="Default Landlord",
            email="landlord@example.com",
            phone="1234567890",
            iban="DEFAULT_IBAN_NUMBER",
            company_address="Default Company Address",
            notes="Default landlord created on startup",
        )
        db.session.add(default_landlord)
        db.session.commit()
        current_app.logger.info("Default landlord created.")
    else:
        current_app.logger.info("Default landlord already exists.")

    # Create a second landlord for demonstration
    second_landlord_name = "Second Company Name"
    second_landlord = Landlord.query.filter_by(
        company_name=second_landlord_name
    ).first()

    if not second_landlord:
        second_landlord = Landlord(
            company_name=second_landlord_name,
            name="Second Landlord",
            email="second_landlord@example.com",
            phone="0987654321",
            iban="SECOND_IBAN_NUMBER",
            company_address="Second Company Address",
            notes="Second landlord created on startup for demonstration",
        )
        db.session.add(second_landlord)
        db.session.commit()
        current_app.logger.info("Second landlord created.")
    else:
        current_app.logger.info("Second landlord already exists.")
