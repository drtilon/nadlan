# final_init_apartment.py - Complete working initialization with fixed models

from models.models import (
    Apartment,
    Tenant,
    User,
    Payment,
    Landlord,
    ContractPeriod,
    ContractTenant,
)
from extentions import db
from flask import current_app
from datetime import date, datetime, timedelta
from sqlalchemy import inspect, text, func
import json


def ensure_db_schema():
    """Ensure database schema exists and is up to date"""
    try:
        current_app.logger.info("🔧 Ensuring database schema...")

        # Create all tables
        db.create_all()

        # Check if managementFee and rentCost columns exist, add them if they don't
        inspector = db.inspect(db.engine)
        apartment_columns = [col["name"] for col in inspector.get_columns("apartments")]

        if "managementFee" not in apartment_columns:
            current_app.logger.info(
                "Adding managementFee column to apartments table..."
            )
            db.session.execute(
                text(
                    "ALTER TABLE apartments ADD COLUMN managementFee NUMERIC(10, 2) DEFAULT 0.00"
                )
            )

        if "rentCost" not in apartment_columns:
            current_app.logger.info("Adding rentCost column to apartments table...")
            db.session.execute(
                text(
                    "ALTER TABLE apartments ADD COLUMN rentCost NUMERIC(10, 2) DEFAULT 0.00"
                )
            )

        db.session.commit()
        current_app.logger.info("✅ Database schema updated successfully")

    except Exception as e:
        current_app.logger.error(f"❌ Schema setup failed: {e}")
        db.session.rollback()
        raise


def check_if_demo_data_exists():
    """Check if our demo data already exists"""
    demo_apartment = Apartment.query.filter_by(
        street_name="HaYarkon Street", house_number="123"
    ).first()
    if demo_apartment:
        current_app.logger.info("Demo data already exists. Skipping creation.")
        return True
    return False


def create_demo_landlord():
    """Create a sample landlord"""
    landlord = Landlord(
        name="Prime Properties Management",
        email="info@primeproperties.co.il",
        phone="+972-3-555-0123",
        company_name="Prime Properties Ltd.",
        iban="IL620108000000012345678",
        company_address="15 Rothschild Blvd, Tel Aviv-Yafo, 6688101, Israel",
    )

    db.session.add(landlord)
    db.session.flush()
    return landlord


def create_demo_apartment(landlord):
    """Create one apartment with complete details"""
    apartment = Apartment(
        street_name="HaYarkon Street",
        house_number="123",
        building="Building A",
        floor="5",
        side="East",
        city="Tel Aviv-Yafo",
        zip_code="6340506",
        full_address="123 HaYarkon Street, Building A, Floor 5, Tel Aviv-Yafo",
        rent=7500.00,
        deposit=15000.00,
        managementFee=500.00,
        rentCost=6800.00,
        rooms=4,
        area=95.5,
        maxOccupancy=4,
        genderPreference="mixed",
        status="occupied",
        notes="Premium apartment with sea view - DEMO DATA",
        landlord_id=landlord.id,
    )

    db.session.add(apartment)
    db.session.flush()
    return apartment


def create_demo_tenants():
    """Create 10 different tenants"""
    tenants_data = [
        {
            "name": "Sarah Cohen",
            "email": "sarah.cohen@demo.com",
            "phone": "+972-50-111-1111",
            "passport_id": "123456789",
            "gender": "female",
        },
        {
            "name": "David Levi",
            "email": "david.levi@demo.com",
            "phone": "+972-52-222-2222",
            "passport_id": "234567890",
            "gender": "male",
        },
        {
            "name": "Maya Goldstein",
            "email": "maya.goldstein@demo.com",
            "phone": "+972-54-333-3333",
            "passport_id": "345678901",
            "gender": "female",
        },
        {
            "name": "Michael Brown",
            "email": "michael.brown@demo.com",
            "phone": "+972-50-444-4444",
            "passport_id": "456789012",
            "gender": "male",
        },
        {
            "name": "Rachel Green",
            "email": "rachel.green@demo.com",
            "phone": "+972-52-555-5555",
            "passport_id": "567890123",
            "gender": "female",
        },
        {
            "name": "Jonathan Miller",
            "email": "jonathan.miller@demo.com",
            "phone": "+972-54-666-6666",
            "passport_id": "678901234",
            "gender": "male",
        },
        {
            "name": "Emma Wilson",
            "email": "emma.wilson@demo.com",
            "phone": "+972-50-777-7777",
            "passport_id": "789012345",
            "gender": "female",
        },
        {
            "name": "Daniel Garcia",
            "email": "daniel.garcia@demo.com",
            "phone": "+972-52-888-8888",
            "passport_id": "890123456",
            "gender": "male",
        },
        {
            "name": "Sophia Martinez",
            "email": "sophia.martinez@demo.com",
            "phone": "+972-54-999-9999",
            "passport_id": "901234567",
            "gender": "female",
        },
        {
            "name": "Alexander Davis",
            "email": "alexander.davis@demo.com",
            "phone": "+972-50-000-0000",
            "passport_id": "012345678",
            "gender": "male",
        },
    ]

    tenants = []
    for tenant_data in tenants_data:
        tenant = Tenant(
            name=tenant_data["name"],
            email=tenant_data["email"],
            phone=tenant_data["phone"],
            passport_id=tenant_data["passport_id"],
            gender=tenant_data["gender"],
            date_of_birth=date(1990, 1, 1),  # Set a default birth date
            refund_iban=f"IL620108000000{len(tenants):09d}",  # Generate unique IBAN
        )
        tenants.append(tenant)
        db.session.add(tenant)

    db.session.flush()
    return tenants


def create_demo_contract_periods(apartment, tenants):
    """Create 3 past contract periods with different tenant combinations"""
    contracts = []

    # Contract 1: January 2024 - December 2024 (3 tenants)
    contract1 = ContractPeriod(
        apartment_id=apartment.id,
        contract_number=f"DEMO-2024-{apartment.id:03d}",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        monthly_rent=7000.00,
        security_deposit=14000.00,
        status="completed",
        notes="DEMO: First year contract - 3 tenants",
    )
    db.session.add(contract1)
    db.session.flush()

    # Contract 1 tenant assignments
    tenant_assignments_1 = [
        ContractTenant(
            contract_period_id=contract1.id,
            tenant_id=tenants[0].id,  # Sarah Cohen
            rent_share_percentage=40.0,
            is_primary=True,
            move_in_date=date(2024, 1, 1),
            move_out_date=date(2024, 12, 31),
        ),
        ContractTenant(
            contract_period_id=contract1.id,
            tenant_id=tenants[1].id,  # David Levi
            rent_share_percentage=35.0,
            is_primary=False,
            move_in_date=date(2024, 1, 1),
            move_out_date=date(2024, 12, 31),
        ),
        ContractTenant(
            contract_period_id=contract1.id,
            tenant_id=tenants[2].id,  # Maya Goldstein
            rent_share_percentage=25.0,
            is_primary=False,
            move_in_date=date(2024, 1, 1),
            move_out_date=date(2024, 12, 31),
        ),
    ]
    db.session.add_all(tenant_assignments_1)
    contracts.append(contract1)

    # Contract 2: January 2025 - June 2025 (4 tenants)
    contract2 = ContractPeriod(
        apartment_id=apartment.id,
        contract_number=f"DEMO-2025-{apartment.id:03d}-A",
        start_date=date(2025, 1, 1),
        end_date=date(2025, 6, 30),
        monthly_rent=7200.00,
        security_deposit=14400.00,
        status="completed",
        notes="DEMO: Second contract - 4 tenants",
    )
    db.session.add(contract2)
    db.session.flush()

    # Contract 2 tenant assignments
    tenant_assignments_2 = [
        ContractTenant(
            contract_period_id=contract2.id,
            tenant_id=tenants[3].id,  # Michael Brown
            rent_share_percentage=30.0,
            is_primary=True,
            move_in_date=date(2025, 1, 1),
            move_out_date=date(2025, 6, 30),
        ),
        ContractTenant(
            contract_period_id=contract2.id,
            tenant_id=tenants[4].id,  # Rachel Green
            rent_share_percentage=25.0,
            is_primary=False,
            move_in_date=date(2025, 1, 1),
            move_out_date=date(2025, 6, 30),
        ),
        ContractTenant(
            contract_period_id=contract2.id,
            tenant_id=tenants[5].id,  # Jonathan Miller
            rent_share_percentage=25.0,
            is_primary=False,
            move_in_date=date(2025, 1, 1),
            move_out_date=date(2025, 6, 30),
        ),
        ContractTenant(
            contract_period_id=contract2.id,
            tenant_id=tenants[6].id,  # Emma Wilson
            rent_share_percentage=20.0,
            is_primary=False,
            move_in_date=date(2025, 1, 1),
            move_out_date=date(2025, 6, 30),
        ),
    ]
    db.session.add_all(tenant_assignments_2)
    contracts.append(contract2)

    # Contract 3: July 2025 - Present (3 tenants, ongoing with some outstanding payments)
    contract3 = ContractPeriod(
        apartment_id=apartment.id,
        contract_number=f"DEMO-2025-{apartment.id:03d}-B",
        start_date=date(2025, 7, 1),
        end_date=date(2026, 6, 30),
        monthly_rent=7500.00,
        security_deposit=15000.00,
        status="active",
        notes="DEMO: Current active contract - 3 tenants",
    )
    db.session.add(contract3)
    db.session.flush()

    # Contract 3 tenant assignments
    tenant_assignments_3 = [
        ContractTenant(
            contract_period_id=contract3.id,
            tenant_id=tenants[7].id,  # Daniel Garcia
            rent_share_percentage=40.0,
            is_primary=True,
            move_in_date=date(2025, 7, 1),
        ),
        ContractTenant(
            contract_period_id=contract3.id,
            tenant_id=tenants[8].id,  # Sophia Martinez
            rent_share_percentage=35.0,
            is_primary=False,
            move_in_date=date(2025, 7, 1),
        ),
        ContractTenant(
            contract_period_id=contract3.id,
            tenant_id=tenants[9].id,  # Alexander Davis
            rent_share_percentage=25.0,
            is_primary=False,
            move_in_date=date(2025, 7, 1),
        ),
    ]
    db.session.add_all(tenant_assignments_3)
    contracts.append(contract3)

    db.session.flush()
    return contracts


def create_demo_payments(contracts):
    """Create payment records for all contracts"""
    payments_created = 0
    total_outstanding = 0.0
    outstanding_details = []

    current_date = date.today()

    for contract in contracts:
        current_app.logger.info(
            f"Creating payments for contract {contract.contract_number}"
        )

        # Get contract tenants
        contract_tenants = ContractTenant.query.filter_by(
            contract_period_id=contract.id
        ).all()

        # Create payments for each month of the contract
        payment_date = contract.start_date.replace(day=1)

        while payment_date <= contract.end_date and payment_date <= current_date:
            # Determine payment status
            is_paid = True

            # For the current active contract, make some recent payments outstanding
            if contract.status == "active":
                if payment_date.year == 2025 and payment_date.month >= 7:
                    # Make July and August paid, September outstanding
                    if payment_date.month >= 9:
                        is_paid = False

            # Calculate tenant payments
            tenant_payments = []
            month_outstanding = 0.0

            for ct in contract_tenants:
                tenant_amount = float(contract.monthly_rent) * (
                    float(ct.rent_share_percentage) / 100.0
                )
                tenant_amount_paid = tenant_amount if is_paid else 0.0

                tenant_payments.append(
                    {
                        "tenantId": ct.tenant_id,
                        "tenantName": ct.tenant.name,
                        "amountDue": tenant_amount,
                        "amountPaid": tenant_amount_paid,
                        "isPrimary": ct.is_primary,
                    }
                )

                if not is_paid:
                    month_outstanding += tenant_amount
                    outstanding_details.append(
                        {
                            "tenant": ct.tenant.name,
                            "month": payment_date.strftime("%B %Y"),
                            "amount": tenant_amount,
                        }
                    )

            # Create payment record
            payment = Payment(
                apartment_id=contract.apartment_id,
                contract_period_id=contract.id,
                month=payment_date.month,
                year=payment_date.year,
                amount=contract.monthly_rent,
                payment_date=payment_date if is_paid else None,
                payment_method="bank_transfer" if is_paid else None,
                payment_type="rent",
                internet=0.0,
                electricity=0.0,
                other=0.0,
                tenant_payments=json.dumps(tenant_payments),
                extraPayments="{}",
                status="paid" if is_paid else "outstanding",
                notes=f"DEMO: {'PAID' if is_paid else 'OUTSTANDING'} - Rent for {payment_date.strftime('%B %Y')} - Contract {contract.contract_number}",
            )

            db.session.add(payment)
            payments_created += 1

            if not is_paid:
                total_outstanding += float(contract.monthly_rent)

            # Move to next month
            if payment_date.month == 12:
                payment_date = payment_date.replace(year=payment_date.year + 1, month=1)
            else:
                payment_date = payment_date.replace(month=payment_date.month + 1)

    db.session.flush()
    return payments_created, total_outstanding, outstanding_details


def create_admin_user():
    """Create default admin user if it doesn't exist"""
    admin_username = "admin"
    admin_password = "admin123"

    existing_admin = User.query.filter_by(username=admin_username).first()
    if not existing_admin:
        admin_user = User(username=admin_username, role="admin", is_approved=True)
        admin_user.set_password(admin_password)
        db.session.add(admin_user)
        current_app.logger.info(
            f"Created admin user (username: {admin_username}, password: {admin_password})"
        )
    else:
        current_app.logger.info(f"Admin user '{admin_username}' already exists")


def calculate_outstanding_summary():
    """Calculate detailed outstanding amounts"""
    try:
        # Get all outstanding payments
        outstanding_payments = Payment.query.filter_by(status="outstanding").all()

        total_outstanding = 0.0
        outstanding_by_tenant = {}
        outstanding_by_month = {}

        for payment in outstanding_payments:
            payment_amount = float(payment.amount)
            total_outstanding += payment_amount

            month_year = f"{payment.year}-{payment.month:02d}"
            outstanding_by_month[month_year] = (
                outstanding_by_month.get(month_year, 0) + payment_amount
            )

            # Parse tenant payments from JSON
            if payment.tenant_payments:
                try:
                    tenant_payments = json.loads(payment.tenant_payments)
                    for tenant_payment in tenant_payments:
                        tenant_name = tenant_payment.get("tenantName", "Unknown")
                        tenant_amount_due = tenant_payment.get("amountDue", 0)
                        tenant_amount_paid = tenant_payment.get("amountPaid", 0)
                        tenant_outstanding = tenant_amount_due - tenant_amount_paid

                        if tenant_outstanding > 0:
                            if tenant_name not in outstanding_by_tenant:
                                outstanding_by_tenant[tenant_name] = 0
                            outstanding_by_tenant[tenant_name] += tenant_outstanding
                except:
                    pass

        return {
            "total_outstanding": total_outstanding,
            "outstanding_by_tenant": outstanding_by_tenant,
            "outstanding_by_month": outstanding_by_month,
            "total_outstanding_payments": len(outstanding_payments),
        }

    except Exception as e:
        current_app.logger.error(f"Error calculating outstanding summary: {e}")
        return {"error": str(e)}


def initialize_database():
    """Main function to initialize database with demo data (WORKING VERSION)"""
    try:
        current_app.logger.info("🚀 Starting DEMO database initialization...")

        # Step 1: Ensure database schema
        ensure_db_schema()

        # Step 2: Check if demo data already exists
        if check_if_demo_data_exists():
            outstanding_summary = calculate_outstanding_summary()
            current_app.logger.info(
                f"✅ Demo data exists. Total outstanding: ₪{outstanding_summary.get('total_outstanding', 0):,.2f}"
            )
            return {
                "success": True,
                "message": "Demo data already exists",
                "outstanding_summary": outstanding_summary,
            }

        # Step 3: Create demo landlord
        landlord = create_demo_landlord()
        current_app.logger.info("✅ Demo landlord created")

        # Step 4: Create demo apartment
        apartment = create_demo_apartment(landlord)
        current_app.logger.info("✅ Demo apartment created")

        # Step 5: Create 10 demo tenants
        tenants = create_demo_tenants()
        current_app.logger.info(f"✅ Created {len(tenants)} demo tenants")

        # Step 6: Create 3 contract periods with tenant assignments
        contracts = create_demo_contract_periods(apartment, tenants)
        current_app.logger.info(f"✅ Created {len(contracts)} demo contract periods")

        # Step 7: Create payments for all contracts
        payments_created, total_outstanding, outstanding_details = create_demo_payments(
            contracts
        )
        current_app.logger.info(f"✅ Created {payments_created} demo payment records")

        # Step 8: Create admin user
        create_admin_user()

        # Step 9: Final commit
        db.session.commit()

        # Step 10: Calculate detailed outstanding summary
        outstanding_summary = calculate_outstanding_summary()

        # Log final summary
        current_app.logger.info("=" * 60)
        current_app.logger.info(
            "🎉 DEMO DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!"
        )
        current_app.logger.info("=" * 60)
        current_app.logger.info(f"📊 DEMO DATA SUMMARY:")
        current_app.logger.info(
            f"   • Demo Apartment: 123 HaYarkon Street, Tel Aviv-Yafo"
        )
        current_app.logger.info(f"   • Demo Tenants: {len(tenants)}")
        current_app.logger.info(f"   • Demo Contract Periods: {len(contracts)}")
        current_app.logger.info(f"   • Demo Payment Records: {payments_created}")
        current_app.logger.info("=" * 60)
        current_app.logger.info(f"💰 OUTSTANDING AMOUNTS:")
        current_app.logger.info(
            f"   • Total Outstanding: ₪{outstanding_summary.get('total_outstanding', 0):,.2f}"
        )
        current_app.logger.info(
            f"   • Outstanding Payments: {outstanding_summary.get('total_outstanding_payments', 0)}"
        )

        if outstanding_summary.get("outstanding_by_tenant"):
            current_app.logger.info("   • By Tenant:")
            for tenant, amount in outstanding_summary["outstanding_by_tenant"].items():
                current_app.logger.info(f"     - {tenant}: ₪{amount:,.2f}")

        if outstanding_summary.get("outstanding_by_month"):
            current_app.logger.info("   • By Month:")
            for month, amount in outstanding_summary["outstanding_by_month"].items():
                current_app.logger.info(f"     - {month}: ₪{amount:,.2f}")

        current_app.logger.info("=" * 60)
        current_app.logger.info("🔑 DEMO LOGIN: username=admin, password=admin123")
        current_app.logger.info("=" * 60)

        return {
            "success": True,
            "message": "Demo data created successfully",
            "summary": {
                "apartments": 1,
                "tenants": len(tenants),
                "contracts": len(contracts),
                "payments": payments_created,
                "outstanding_summary": outstanding_summary,
            },
        }

    except Exception as e:
        current_app.logger.error(f"❌ Demo database initialization failed: {e}")
        db.session.rollback()
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    # For direct execution
    print("This script should be run within the Flask application context")
    print(
        "Use: from final_init_apartment import initialize_database; initialize_database()"
    )
