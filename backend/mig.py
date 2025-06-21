# payment_migration.py - Database migration for Payment table fixes
from flask import Flask
from config import Config
from extentions import db
from sqlalchemy import text
import sys

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

def migrate_payment_table():
    """
    Migrate the Payment table to support both individual and batch payments.
    This adds the new columns needed for individual payments.
    """
    with app.app_context():
        try:
            print("Starting Payment table migration...")
            
            with db.engine.connect() as conn:
                # Add new columns for individual payments if they don't exist
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN amount FLOAT NULL"))
                    print("✅ Added amount column")
                except Exception as e:
                    print(f"Amount column already exists or error: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN tenant_name VARCHAR(255) NULL"))
                    print("✅ Added tenant_name column")
                except Exception as e:
                    print(f"Tenant_name column already exists or error: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN payment_type VARCHAR(50) NULL DEFAULT 'rent'"))
                    print("✅ Added payment_type column")
                except Exception as e:
                    print(f"Payment_type column already exists or error: {e}")
                
                # Ensure month column can handle longer identifiers for individual payments
                try:
                    conn.execute(text("ALTER TABLE payments MODIFY COLUMN month VARCHAR(50) NOT NULL"))
                    print("✅ Modified month column to VARCHAR(50)")
                except Exception as e:
                    print(f"Month column modification: {e}")
                
                # Remove unique constraint if it exists (to allow multiple payments per month)
                try:
                    # First check if the constraint exists
                    constraint_check = conn.execute(text("""
                        SELECT CONSTRAINT_NAME 
                        FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE TABLE_NAME = 'payments' 
                        AND CONSTRAINT_TYPE = 'UNIQUE'
                        AND CONSTRAINT_NAME LIKE '%apartment%month%year%'
                    """)).fetchall()
                    
                    if missing_columns:
                    print(f"\n❌ Missing columns: {missing_columns}")
                    return False
                else:
                    print("\n✅ All required columns are present!")
                    return True
                    
        except Exception as e:
            print(f"❌ Verification error: {e}")
            return False

def clean_duplicate_payments():
    """
    Clean up any duplicate payments that might have been created.
    This removes duplicate batch payments for the same apartment/month/year.
    """
    with app.app_context():
        try:
            print("\nCleaning duplicate payments...")
            
            with db.engine.connect() as conn:
                # Find duplicate batch payments (same apartment_id, month, year, and month is a standard month name)
                duplicates = conn.execute(text("""
                    SELECT apartment_id, month, year, COUNT(*) as count
                    FROM payments 
                    WHERE month IN ('January', 'February', 'March', 'April', 'May', 'June',
                                   'July', 'August', 'September', 'October', 'November', 'December')
                    AND (amount IS NULL OR amount = 0)
                    GROUP BY apartment_id, month, year 
                    HAVING COUNT(*) > 1
                """)).fetchall()
                
                if duplicates:
                    print(f"Found {len(duplicates)} sets of duplicate batch payments")
                    
                    for dup in duplicates:
                        apartment_id, month, year, count = dup
                        print(f"  - Apartment {apartment_id}, {month} {year}: {count} duplicates")
                        
                        # Keep the most recent payment and delete older ones
                        conn.execute(text("""
                            DELETE p1 FROM payments p1
                            INNER JOIN payments p2 
                            WHERE p1.apartment_id = :apartment_id 
                            AND p1.month = :month 
                            AND p1.year = :year
                            AND p1.month IN ('January', 'February', 'March', 'April', 'May', 'June',
                                           'July', 'August', 'September', 'October', 'November', 'December')
                            AND (p1.amount IS NULL OR p1.amount = 0)
                            AND (p2.amount IS NULL OR p2.amount = 0)
                            AND p1.id < p2.id
                        """), {
                            'apartment_id': apartment_id,
                            'month': month,
                            'year': year
                        })
                    
                    conn.commit()
                    print("✅ Cleaned up duplicate batch payments")
                else:
                    print("✅ No duplicate batch payments found")
                    
        except Exception as e:
            print(f"❌ Error cleaning duplicates: {e}")

if __name__ == "__main__":
    print("Payment Table Migration Tool")
    print("=" * 40)
    
    # Run migration
    if migrate_payment_table():
        # Verify the migration
        if verify_payment_table():
            # Clean up duplicates
            clean_duplicate_payments()
            print("\n🎉 Migration completed successfully!")
        else:
            print("\n❌ Migration verification failed!")
            sys.exit(1)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1) constraint_check:
                        constraint_name = constraint_check[0][0]
                        conn.execute(text(f"ALTER TABLE payments DROP CONSTRAINT {constraint_name}"))
                        print(f"✅ Removed unique constraint: {constraint_name}")
                    else:
                        # Try common constraint names
                        try:
                            conn.execute(text("ALTER TABLE payments DROP CONSTRAINT _apartment_month_year_uc"))
                            print("✅ Removed unique constraint: _apartment_month_year_uc")
                        except:
                            print("No unique constraint found to remove")
                            
                except Exception as e:
                    print(f"Constraint removal: {e}")
                
                # Ensure paymentDate and paymentMethod columns exist
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN paymentDate DATETIME NULL"))
                    print("✅ Added paymentDate column")
                except Exception as e:
                    print(f"PaymentDate column already exists or error: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN paymentMethod VARCHAR(50) NULL DEFAULT 'bank_transfer'"))
                    print("✅ Added paymentMethod column")
                except Exception as e:
                    print(f"PaymentMethod column already exists or error: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN notes TEXT NULL"))
                    print("✅ Added notes column")
                except Exception as e:
                    print(f"Notes column already exists or error: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN extraPayments TEXT NULL"))
                    print("✅ Added extraPayments column")
                except Exception as e:
                    print(f"ExtraPayments column already exists or error: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN year INT NULL DEFAULT YEAR(NOW())"))
                    print("✅ Added year column")
                except Exception as e:
                    print(f"Year column already exists or error: {e}")
                
                # Update any existing rows that don't have a year set
                try:
                    conn.execute(text("UPDATE payments SET year = YEAR(NOW()) WHERE year IS NULL"))
                    print("✅ Updated NULL year values")
                except Exception as e:
                    print(f"Error updating year values: {e}")
                
                conn.commit()
            
            print("✅ Payment table migration completed successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Migration error: {e}")
            return False

def verify_payment_table():
    """
    Verify that the Payment table has the correct structure.
    """
    with app.app_context():
        try:
            print("\nVerifying Payment table structure...")
            
            with db.engine.connect() as conn:
                # Get column information
                columns = conn.execute(text("""
                    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_NAME = 'payments'
                    ORDER BY ORDINAL_POSITION
                """)).fetchall()
                
                print("\nCurrent Payment table columns:")
                for col in columns:
                    print(f"  - {col[0]}: {col[1]} (Nullable: {col[2]}, Default: {col[3]})")
                
                # Check for required columns
                required_columns = [
                    'id', 'apartment_id', 'month', 'year', 'status',
                    'amount', 'tenant_name', 'payment_type',
                    'tenants', 'paymentDate', 'paymentMethod', 'notes'
                ]
                
                existing_columns = [col[0] for col in columns]
                missing_columns = [col for col in required_columns if col not in existing_columns]
                
                if
