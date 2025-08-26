# init_apartment.py - Comprehensive Version with Multiple Apartments, Tenants, and Contract History
from models.models import Apartment, Tenant, User, Payment, Landlord, ContractPeriod, ContractTenant
from extentions import db
from flask import current_app
from datetime import date, datetime, timedelta
from sqlalchemy import inspect, text
import json
import random


def ensure_db_schema():
    """Ensure that the database schema matches our model definitions."""
    try:
        inspector = inspect(db.engine)

        # Check apartments table for new address columns and gender preference
        if "apartments" in inspector.get_table_names():
            existing_columns = [
                col["name"] for col in inspector.get_columns("apartments")
            ]

            # Define new address columns and gender preference that might be missing
            new_columns = {
                "street_name": "VARCHAR(100) NOT NULL DEFAULT 'Unknown Street'",
                "house_number": "VARCHAR(20) NOT NULL DEFAULT '1'",
                "zip_code": "VARCHAR(20) NOT NULL DEFAULT '00000'",
                "city": "VARCHAR(50) NOT NULL DEFAULT 'Tel Aviv'",
                "state": "VARCHAR(50) NULL",
                "country": "VARCHAR(50) NOT NULL DEFAULT 'Israel'",
                "building": "VARCHAR(50) NULL",
                "floor": "VARCHAR(10) NULL",
                "side": "VARCHAR(10) NULL",
                "full_address": "VARCHAR(500) NULL",
                "genderPreference": "VARCHAR(20) NULL DEFAULT 'mixed'"
            }

            # Add missing columns
            for column_name, column_type in new_columns.items():
                if column_name not in existing_columns:
                    try:
                        sql = f"ALTER TABLE apartments ADD COLUMN {column_name} {column_type}"
                        with db.engine.begin() as conn:
                            conn.execute(text(sql))
                        current_app.logger.info(
                            f"Added missing column '{column_name}' to apartments table"
                        )
                    except Exception as e:
                        current_app.logger.error(f"Error adding column {column_name}: {e}")

        # Check payments table columns
        if "payments" in inspector.get_table_names():
            existing_columns = [
                col["name"] for col in inspector.get_columns("payments")
            ]

            # Define required columns that might be missing
            required_columns = {
                "paymentDate": "DATETIME NULL",
                "paymentMethod": "VARCHAR(50) NULL DEFAULT 'bank_transfer'",
                "extraPayments": "TEXT NULL",
                "notes": "TEXT NULL",
                "year": "INT NULL",
            }

            # Add missing columns
            for column_name, column_type in required_columns.items():
                if column_name not in existing_columns:
                    try:
                        sql = f"ALTER TABLE apartments ADD COLUMN {column_name} {column_type}"
                        with db.engine.begin() as conn:
                            conn.execute(text(sql))
                        current_app.logger.info(
                            f"Added missing column '{column_name}' to payments table"
                        )
                    except Exception as e:
                        current_app.logger.error(f"Error adding column {column_name}: {e}")

        # Make sure the database tables exist
        db.create_all()
        current_app.logger.info("Database schema check completed")

    except Exception as e:
        current_app.logger.error(f"Error ensuring database schema: {e}")


def ensure_landlords_exist():
    """Create multiple landlords for variety"""
    landlords_data = [
        {
            "company_name": "Prime Properties Ltd",
            "name": "Sarah Cohen",
            "email": "sarah@primeproperties.co.il",
            "phone": "03-1234567",
            "iban": "IL620108000000099999999",
            "company_address": "Rothschild Blvd 45, Tel Aviv",
            "notes": "Established property management company specializing in Tel Aviv apartments"
        },
        {
            "company_name": "Tel Aviv Rentals",
            "name": "David Levy",
            "email": "david@telavivrentals.com",
            "phone": "03-9876543",
            "iban": "IL720108000000088888888",
            "company_address": "Dizengoff St 120, Tel Aviv",
            "notes": "Modern rental management with focus on young professionals"
        },
        {
            "company_name": "Golden Coast Properties",
            "name": "Rachel Goldberg",
            "email": "rachel@goldencoast.co.il",
            "phone": "03-5555555",
            "iban": "IL820108000000077777777",
            "company_address": "Ben Yehuda St 75, Tel Aviv",
            "notes": "Luxury apartment rentals near the beach"
        },
        {
            "company_name": "City Center Homes",
            "name": "Michael Stern",
            "email": "michael@citycenter.co.il",
            "phone": "03-2222222",
            "iban": "IL920108000000066666666",
            "company_address": "King George St 32, Tel Aviv",
            "notes": "Affordable housing solutions in central locations"
        }
    ]

    for landlord_data in landlords_data:
        existing_landlord = Landlord.query.filter_by(
            company_name=landlord_data["company_name"]
        ).first()

        if not existing_landlord:
            landlord = Landlord(**landlord_data)
            db.session.add(landlord)
            current_app.logger.info(f"Created landlord: {landlord_data['company_name']}")

    db.session.commit()


def generate_comprehensive_apartments():
    """Generate multiple apartments with realistic data"""

    # Ensure landlords exist first
    ensure_landlords_exist()
    landlords = Landlord.query.all()

    if not landlords:
        current_app.logger.error("No landlords found, cannot create apartments")
        return

    # Define comprehensive apartment data with mixed management models
    apartments_data = [
        {
            "street_name": "Rothschild Boulevard", "house_number": "45", "building": "A", "floor": "3", "side": "East",
            "city": "Tel Aviv", "zip_code": "64364", "rooms": 2, "size": 65.0, "rent": 3800.0, "deposit": 7600.0,
            "status": "occupied", "genderPreference": "mixed", "maxOccupancy": 2,
            "notes": "Beautifully renovated apartment in the heart of Tel Aviv with balcony",
            "model": "management", "managementFee": 8.0, "rentCost": 0.0
        },
        {
            "street_name": "Dizengoff Street", "house_number": "120", "building": "B", "floor": "5", "side": "West",
            "city": "Tel Aviv", "zip_code": "64165", "rooms": 3, "size": 80.0, "rent": 4500.0, "deposit": 9000.0,
            "status": "occupied", "genderPreference": "mixed", "maxOccupancy": 3,
            "notes": "Modern apartment near Dizengoff Center with parking space",
            "model": "rental", "managementFee": 0.0, "rentCost": 3900.0
        },
        {
            "street_name": "Ben Yehuda Street", "house_number": "75", "building": "", "floor": "2", "side": "",
            "city": "Tel Aviv", "zip_code": "63343", "rooms": 1, "size": 45.0, "rent": 2900.0, "deposit": 5800.0,
            "status": "vacant", "genderPreference": "mixed", "maxOccupancy": 1,
            "notes": "Cozy studio apartment close to the beach",
            "model": "management", "managementFee": 10.0, "rentCost": 0.0
        },
        {
            "street_name": "King George Street", "house_number": "32", "building": "C", "floor": "4", "side": "North",
            "city": "Tel Aviv", "zip_code": "64077", "rooms": 4, "size": 110.0, "rent": 5200.0, "deposit": 10400.0,
            "status": "occupied", "genderPreference": "women_only", "maxOccupancy": 4,
            "notes": "Spacious family apartment with 2 bathrooms",
            "model": "rental", "managementFee": 0.0, "rentCost": 4600.0
        },
        {
            "street_name": "Allenby Street", "house_number": "88", "building": "", "floor": "1", "side": "",
            "city": "Tel Aviv", "zip_code": "65111", "rooms": 2, "size": 70.0, "rent": 3200.0, "deposit": 6400.0,
            "status": "contract_sent", "genderPreference": "mixed", "maxOccupancy": 2,
            "notes": "Ground floor apartment with private entrance",
            "model": "management", "managementFee": 12.0, "rentCost": 0.0
        },
        {
            "street_name": "Shenkin Street", "house_number": "15", "building": "D", "floor": "6", "side": "South",
            "city": "Tel Aviv", "zip_code": "65251", "rooms": 3, "size": 95.0, "rent": 4800.0, "deposit": 9600.0,
            "status": "occupied", "genderPreference": "men_only", "maxOccupancy": 3,
            "notes": "Penthouse apartment with amazing city views",
            "model": "rental", "managementFee": 0.0, "rentCost": 4200.0
        },
        {
            "street_name": "Bialik Street", "house_number": "22", "building": "", "floor": "3", "side": "East",
            "city": "Tel Aviv", "zip_code": "63124", "rooms": 2, "size": 60.0, "rent": 3500.0, "deposit": 7000.0,
            "status": "vacant", "genderPreference": "mixed", "maxOccupancy": 2,
            "notes": "Charming apartment in historic neighborhood",
            "model": "management", "managementFee": 9.0, "rentCost": 0.0
        },
        {
            "street_name": "Nahalat Binyamin", "house_number": "67", "building": "E", "floor": "2", "side": "West",
            "city": "Tel Aviv", "zip_code": "65101", "rooms": 1, "size": 40.0, "rent": 2600.0, "deposit": 5200.0,
            "status": "occupied", "genderPreference": "mixed", "maxOccupancy": 1,
            "notes": "Compact apartment perfect for students",
            "model": "rental", "managementFee": 0.0, "rentCost": 2200.0
        }
    ]

    # Create apartments
    created_apartments = []
    for i, apt_data in enumerate(apartments_data):
        # Check if apartment already exists
        existing = Apartment.query.filter_by(
            street_name=apt_data["street_name"],
            house_number=apt_data["house_number"],
            city=apt_data["city"]
        ).first()

        if not existing:
            # Add random landlord and dates
            apt_data["landlord_id"] = random.choice(landlords).id

            # Set move-in dates for occupied apartments
            if apt_data["status"] == "occupied":
                move_in_date = datetime.now() - timedelta(days=random.randint(30, 700))
                apt_data["moveInDate"] = move_in_date.date()
                apt_data["contractEndDate"] = (move_in_date + timedelta(days=365)).date()

            # Add financial model data
            apt_data["state"] = "Tel Aviv"
            apt_data["country"] = "Israel"

            apartment = Apartment(**apt_data)
            apartment.update_full_address()

            db.session.add(apartment)
            db.session.flush()  # Get ID immediately
            created_apartments.append(apartment)

            current_app.logger.info(f"Created apartment: {apartment.street_name} {apartment.house_number}")

    db.session.commit()
    return created_apartments


def generate_tenants_and_contracts(apartments):
    """Generate tenants and contract histories for apartments"""

    # Realistic tenant names and data
    tenant_names = [
        ("Alex Johnson", "alex.johnson@gmail.com", "050-1234567"),
        ("Maya Cohen", "maya.cohen@gmail.com", "052-9876543"),
        ("Daniel Smith", "daniel.smith@yahoo.com", "053-5555555"),
        ("Noa Levy", "noa.levy@outlook.com", "054-1111111"),
        ("Tom Wilson", "tom.wilson@gmail.com", "055-2222222"),
        ("Sara Goldstein", "sara.goldstein@gmail.com", "056-3333333"),
        ("Michael Brown", "michael.brown@hotmail.com", "057-4444444"),
        ("Yael Davis", "yael.davis@gmail.com", "058-6666666"),
        ("John Miller", "john.miller@gmail.com", "059-7777777"),
        ("Rachel Green", "rachel.green@gmail.com", "050-8888888"),
        ("David Taylor", "david.taylor@gmail.com", "052-9999999"),
        ("Lisa Anderson", "lisa.anderson@gmail.com", "053-0000000"),
        ("Ben Cohen", "ben.cohen@gmail.com", "054-1212121"),
        ("Emma Wilson", "emma.wilson@gmail.com", "055-3434343"),
        ("Ryan Martinez", "ryan.martinez@gmail.com", "056-5656565"),
        ("Sophie Johnson", "sophie.johnson@gmail.com", "057-7878787"),
        ("Jake Thompson", "jake.thompson@gmail.com", "058-9090909"),
        ("Anna Rosenberg", "anna.rosenberg@gmail.com", "059-1313131")
    ]

    # Create unassigned tenants (available for selection)
    unassigned_tenants = []
    for i in range(6):  # Create 6 unassigned tenants
        name, email, phone = tenant_names[-(i+1)]  # Take from end of list
        tenant = Tenant(
            name=name,
            email=email,
            phone=phone,
            bornOn=f"19{random.randint(85, 99)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
            refundIban=f"IL{random.randint(10, 99)}0108000000{random.randint(111111111, 999999999)}",
            apartment_id=None  # Not assigned to any apartment
        )
        db.session.add(tenant)
        unassigned_tenants.append(tenant)

    # Create tenants and contracts for occupied apartments
    tenant_index = 0
    for apartment in apartments:
        if apartment.status in ["occupied", "contract_sent"]:
            # Create current tenants
            current_tenants = []
            num_tenants = random.randint(1, min(apartment.maxOccupancy, 3))

            for i in range(num_tenants):
                if tenant_index < len(tenant_names) - 6:  # Save last 6 for unassigned
                    name, email, phone = tenant_names[tenant_index]
                    tenant = Tenant(
                        name=name,
                        email=email,
                        phone=phone,
                        apartment_id=apartment.id,
                        bornOn=f"19{random.randint(85, 99)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                        refundIban=f"IL{random.randint(10, 99)}0108000000{random.randint(111111111, 999999999)}"
                    )
                    db.session.add(tenant)
                    db.session.flush()
                    current_tenants.append(tenant)
                    tenant_index += 1

            if current_tenants:
                create_contract_history(apartment, current_tenants)
                create_payment_history(apartment, current_tenants)

    db.session.commit()
    current_app.logger.info(f"Created {len(unassigned_tenants)} unassigned tenants and contract histories")


def create_contract_history(apartment, current_tenants):
    """Create contract history with multiple periods for realistic data"""

    # Create historical contract (completed)
    if random.choice([True, False]):  # 50% chance of having history
        historical_start = datetime.now() - timedelta(days=random.randint(600, 1000))
        historical_end = historical_start + timedelta(days=365)

        historical_contract = ContractPeriod(
            apartment_id=apartment.id,
            contract_number=f"HIST-{apartment.id}-{historical_start.strftime('%Y%m')}-{random.randint(1000, 9999)}",
            start_date=historical_start.date(),
            end_date=historical_end.date(),
            monthly_rent=apartment.rent * random.uniform(0.8, 0.95),  # Historical rent was lower
            security_deposit=apartment.deposit,
            status="completed",
            notes="Historical contract - previous tenants",
            created_by="system_init"
        )
        db.session.add(historical_contract)
        db.session.flush()

    # Create current contract
    current_start = apartment.moveInDate or (datetime.now() - timedelta(days=random.randint(30, 200))).date()
    current_end = apartment.contractEndDate or (datetime.now() + timedelta(days=random.randint(30, 300))).date()

    # Determine status based on apartment status and end date
    if apartment.status == "contract_sent":
        contract_status = "pending"
    elif current_end < date.today():
        contract_status = "completed"
    else:
        contract_status = "active"

    current_contract = ContractPeriod(
        apartment_id=apartment.id,
        contract_number=f"CURR-{apartment.id}-{current_start.strftime('%Y%m')}-{random.randint(1000, 9999)}",
        start_date=current_start,
        end_date=current_end,
        monthly_rent=apartment.rent,
        security_deposit=apartment.deposit,
        status=contract_status,
        notes=f"Current contract for {len(current_tenants)} tenant(s)",
        created_by="system_init"
    )
    db.session.add(current_contract)
    db.session.flush()

    # Assign current tenants to the current contract
    for i, tenant in enumerate(current_tenants):
        rent_share = 100.0 / len(current_tenants)  # Equal split

        contract_tenant = ContractTenant(
            contract_period_id=current_contract.id,
            tenant_id=tenant.id,
            is_primary=(i == 0),  # First tenant is primary
            move_in_date=current_start,
            rent_share_percentage=rent_share,
            created_at=datetime.utcnow()
        )
        db.session.add(contract_tenant)


def create_payment_history(apartment, tenants):
    """Create deterministic payment history - we know exactly who owes what"""

    # Define specific payment scenarios for each apartment based on address
    payment_scenarios = {
        "Rothschild Boulevard 45": {
            # GOOD PAYER - Only owes current month (December 2024)
            "unpaid_months": ["December"],
            "partial_months": [],
            "outstanding": 3800.0
        },
        "Dizengoff Street 120": {
            # MODERATE PAYER - Owes 2 full months
            "unpaid_months": ["November", "December"],
            "partial_months": ["October"],  # Paid 2000 of 4500
            "outstanding": 11500.0  # 4500 + 4500 + 2500
        },
        "King George Street 32": {
            # BAD PAYER - Owes 3 full months
            "unpaid_months": ["October", "November", "December"],
            "partial_months": [],
            "outstanding": 15600.0  # 5200 × 3
        },
        "Allenby Street 88": {
            # NEW TENANT - Contract sent, no payment history yet
            "unpaid_months": [],
            "partial_months": [],
            "outstanding": 0.0
        },
        "Shenkin Street 15": {
            # VERY BAD PAYER - Owes 4 months, some partial
            "unpaid_months": ["September", "October", "November", "December"],
            "partial_months": ["August"],  # Paid 2000 of 4800
            "outstanding": 22000.0  # 4800×4 + 2800
        },
        "Nahalat Binyamin 67": {
            # PERFECT PAYER - Student, always pays on time
            "unpaid_months": [],
            "partial_months": [],
            "outstanding": 0.0
        }
    }

    apartment_key = f"{apartment.street_name} {apartment.house_number}"
    scenario = payment_scenarios.get(apartment_key, {"unpaid_months": [], "partial_months": [], "outstanding": 0.0})

    # Create payment history for last 8 months
    months = ["May", "June", "July", "August", "September", "October", "November", "December"]
    current_year = 2024

    for i, month_name in enumerate(months):
        payment_date = datetime(current_year, 5 + i, 15)  # 15th of each month

        # Skip unpaid months (no payment record created)
        if month_name in scenario["unpaid_months"]:
            continue

        # Create tenant payment data
        tenant_data = []
        individual_rent = apartment.rent / len(tenants)

        for tenant in tenants:
            if month_name in scenario["partial_months"]:
                # Partial payment scenarios
                if apartment_key == "Dizengoff Street 120":
                    amount_paid = 2000.0 / len(tenants)  # Paid 2000 total in October
                elif apartment_key == "Shenkin Street 15":
                    amount_paid = 2000.0 / len(tenants)  # Paid 2000 total in August
                else:
                    amount_paid = individual_rent * 0.5  # 50% payment
                paid_status = False
            else:
                # Full payment
                amount_paid = individual_rent
                paid_status = True

            tenant_data.append({
                "id": tenant.id,
                "name": tenant.name,
                "amountPaid": round(amount_paid, 2),
                "amountDue": round(individual_rent, 2),
                "paid": paid_status
            })

        # Determine overall payment status
        total_paid = sum(t["amountPaid"] for t in tenant_data)
        if month_name in scenario["partial_months"]:
            status = 'partial'
        else:
            status = 'paid'

        # Create payment record
        payment = Payment(
            apartment_id=apartment.id,
            month=month_name,
            year=current_year,
            status=status,
            tenants=json.dumps(tenant_data),
            internet=80,  # Fixed amounts for consistency
            electricity=150,
            other=0,
            extraPayments="{}",
            paymentDate=payment_date,
            paymentMethod='bank_transfer',
            notes=f"Payment for {month_name} {current_year}" + (
                " - Partial payment" if month_name in scenario["partial_months"] else ""
            ),
            updated_at=datetime.utcnow()
        )
        db.session.add(payment)


def initialize_comprehensive_data():
    """Main function to initialize comprehensive apartment data"""
    try:
        current_app.logger.info("Starting comprehensive apartment data initialization...")

        # Create apartments
        apartments = generate_comprehensive_apartments()

        if apartments:
            # Create tenants and contracts
            generate_tenants_and_contracts(apartments)

            # Final commit
            db.session.commit()

            current_app.logger.info(
                f"Successfully initialized {len(apartments)} apartments with tenants, "
                f"contract histories, and payment records"
            )

            # Log summary
            total_tenants = Tenant.query.count()
            total_contracts = ContractPeriod.query.count()
            total_payments = Payment.query.count()
            unassigned_tenants = Tenant.query.filter_by(apartment_id=None).count()

            current_app.logger.info(
                f"Database summary: {len(apartments)} apartments, {total_tenants} tenants "
                f"({unassigned_tenants} unassigned), {total_contracts} contracts, {total_payments} payments"
            )

    except Exception as e:
        current_app.logger.error(f"Error in comprehensive data initialization: {e}")
        db.session.rollback()
        raise


# Main initialization function (called from your app startup)
def ensure_comprehensive_apartment_data():
    """Ensure comprehensive apartment data exists - safe to call multiple times"""

    # Only run if we don't already have sufficient data
    apartment_count = Apartment.query.count()

    if apartment_count < 5:  # If less than 5 apartments, initialize data
        current_app.logger.info("Insufficient apartment data found, initializing comprehensive dataset...")
        ensure_db_schema()
        initialize_comprehensive_data()
    else:
        current_app.logger.info(f"Found {apartment_count} apartments, skipping data initialization")


# Keep the original functions for compatibility
def ensure_default_apartment_exists(new_tenants_data=None):
    """Legacy function - now calls comprehensive initialization"""
    ensure_comprehensive_apartment_data()


def ensure_new_apartment_exists(new_tenants_data=None):
    """Legacy function - now calls comprehensive initialization"""
    ensure_comprehensive_apartment_data()
