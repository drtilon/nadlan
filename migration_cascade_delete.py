# migration_cascade_delete.py
from flask import Flask
from config import Config
from extentions import db
from sqlalchemy import text
import sys

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)


def add_cascade_delete():
    """
    Add CASCADE DELETE to foreign key constraints for better data management.
    """
    with app.app_context():
        try:
            print("Starting cascade delete migration...")

            with db.engine.connect() as conn:
                # Begin a transaction
                trans = conn.begin()

                # First, get the current foreign key constraint name for contracts table
                print("Getting current foreign key constraint information...")

                # Check existing foreign key constraints
                fk_info = conn.execute(
                    text("""
                    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'contracts'
                    AND REFERENCED_TABLE_NAME = 'apartments'
                """)
                ).fetchall()

                if fk_info:
                    for fk in fk_info:
                        constraint_name = fk[0]
                        print(f"Found foreign key constraint: {constraint_name}")

                        # Drop the existing foreign key constraint
                        print(f"Dropping existing constraint: {constraint_name}")
                        conn.execute(
                            text(
                                f"ALTER TABLE contracts DROP FOREIGN KEY {constraint_name}"
                            )
                        )

                        # Add the new foreign key constraint with CASCADE DELETE
                        print("Adding new constraint with CASCADE DELETE...")
                        conn.execute(
                            text("""
                            ALTER TABLE contracts 
                            ADD CONSTRAINT contracts_apartment_fk 
                            FOREIGN KEY (apartment_id) 
                            REFERENCES apartments(id) 
                            ON DELETE CASCADE
                        """)
                        )

                        print(
                            "✅ Successfully updated contracts foreign key with CASCADE DELETE"
                        )

                # Also check and update payments table if needed
                print("Checking payments table foreign key constraints...")

                payments_fk_info = conn.execute(
                    text("""
                    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'payments'
                    AND REFERENCED_TABLE_NAME = 'apartments'
                """)
                ).fetchall()

                if payments_fk_info:
                    for fk in payments_fk_info:
                        constraint_name = fk[0]
                        print(
                            f"Found payments foreign key constraint: {constraint_name}"
                        )

                        # Drop the existing foreign key constraint
                        print(
                            f"Dropping existing payments constraint: {constraint_name}"
                        )
                        conn.execute(
                            text(
                                f"ALTER TABLE payments DROP FOREIGN KEY {constraint_name}"
                            )
                        )

                        # Add the new foreign key constraint with CASCADE DELETE
                        print("Adding new payments constraint with CASCADE DELETE...")
                        conn.execute(
                            text("""
                            ALTER TABLE payments 
                            ADD CONSTRAINT payments_apartment_fk 
                            FOREIGN KEY (apartment_id) 
                            REFERENCES apartments(id) 
                            ON DELETE CASCADE
                        """)
                        )

                        print(
                            "✅ Successfully updated payments foreign key with CASCADE DELETE"
                        )

                # Check tenants table as well
                print("Checking tenants table foreign key constraints...")

                tenants_fk_info = conn.execute(
                    text("""
                    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'tenants'
                    AND REFERENCED_TABLE_NAME = 'apartments'
                """)
                ).fetchall()

                if tenants_fk_info:
                    for fk in tenants_fk_info:
                        constraint_name = fk[0]
                        print(
                            f"Found tenants foreign key constraint: {constraint_name}"
                        )

                        # For tenants, we might want SET NULL instead of CASCADE DELETE
                        # This preserves tenant records when apartments are deleted
                        print(
                            f"Dropping existing tenants constraint: {constraint_name}"
                        )
                        conn.execute(
                            text(
                                f"ALTER TABLE tenants DROP FOREIGN KEY {constraint_name}"
                            )
                        )

                        print("Adding new tenants constraint with SET NULL...")
                        conn.execute(
                            text("""
                            ALTER TABLE tenants 
                            ADD CONSTRAINT tenants_apartment_fk 
                            FOREIGN KEY (apartment_id) 
                            REFERENCES apartments(id) 
                            ON DELETE SET NULL
                        """)
                        )

                        print(
                            "✅ Successfully updated tenants foreign key with SET NULL"
                        )

                # Commit the transaction
                trans.commit()
                print("✅ Cascade delete migration completed successfully!")
                return True

        except Exception as e:
            print(f"❌ Migration error: {e}")
            if "trans" in locals():
                trans.rollback()
            return False


def verify_constraints():
    """
    Verify that the foreign key constraints are properly set up.
    """
    with app.app_context():
        try:
            print("\nVerifying foreign key constraints...")

            with db.engine.connect() as conn:
                # Check all foreign key constraints
                constraints = conn.execute(
                    text("""
                    SELECT 
                        kcu.TABLE_NAME,
                        kcu.COLUMN_NAME,
                        kcu.CONSTRAINT_NAME,
                        kcu.REFERENCED_TABLE_NAME,
                        kcu.REFERENCED_COLUMN_NAME,
                        rc.DELETE_RULE,
                        rc.UPDATE_RULE
                    FROM information_schema.KEY_COLUMN_USAGE kcu
                    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc 
                        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                    WHERE kcu.TABLE_SCHEMA = DATABASE()
                    AND kcu.REFERENCED_TABLE_NAME = 'apartments'
                    ORDER BY kcu.TABLE_NAME
                """)
                ).fetchall()

                print("\nCurrent foreign key constraints referencing apartments:")
                print("Table -> Column -> Constraint -> Delete Rule")
                print("-" * 60)

                for constraint in constraints:
                    table_name = constraint[0]
                    column_name = constraint[1]
                    constraint_name = constraint[2]
                    delete_rule = constraint[5]

                    print(
                        f"{table_name} -> {column_name} -> {constraint_name} -> {delete_rule}"
                    )

                print("\n✅ Verification completed!")
                return True

        except Exception as e:
            print(f"❌ Verification error: {e}")
            return False


if __name__ == "__main__":
    print("Foreign Key Cascade Delete Migration")
    print("=" * 50)

    # Run migration
    if add_cascade_delete():
        # Verify the migration
        if verify_constraints():
            print("\n🎉 Migration completed successfully!")
        else:
            print("\n❌ Migration verification failed!")
            sys.exit(1)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)
