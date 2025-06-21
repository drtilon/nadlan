
from flask import Flask
from config import Config
from extentions import db
from sqlalchemy import text
import sys

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

def migrate():
    with app.app_context():
        try:
            # Add new columns to payments table
            with db.engine.connect() as conn:
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN amount FLOAT NULL"))
                    print("✅ Added amount column")
                except Exception as e:
                    print(f"Amount column: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN tenant_name VARCHAR(255) NULL"))
                    print("✅ Added tenant_name column")
                except Exception as e:
                    print(f"Tenant_name column: {e}")
                
                try:
                    conn.execute(text("ALTER TABLE payments ADD COLUMN payment_type VARCHAR(50) NULL DEFAULT 'rent'"))
                    print("✅ Added payment_type column")
                except Exception as e:
                    print(f"Payment_type column: {e}")
                
                # Remove unique constraint to allow multiple payments per month
                try:
                    conn.execute(text("ALTER TABLE payments DROP CONSTRAINT _apartment_month_year_uc"))
                    print("✅ Removed unique constraint")
                except Exception as e:
                    print(f"Constraint removal: {e}")
                
                conn.commit()
            
            print("✅ Migration completed!")
        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
