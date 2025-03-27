from flask import Flask
from config import Config
from extentions import db
from models.models import Tenant
from collections import defaultdict

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)


def deduplicate_tenants():
    """
    This script finds duplicate tenants by name and removes duplicates,
    giving priority to tenants that are assigned to apartments.
    """
    with app.app_context():
        print("Starting tenant deduplication process...")

        # Get all tenants
        tenants = Tenant.query.all()
        print(f"Found {len(tenants)} total tenants in database")

        # Group tenants by name
        tenant_groups = defaultdict(list)
        for tenant in tenants:
            tenant_groups[tenant.name].append(tenant)

        duplicates_found = sum(
            1 for name, group in tenant_groups.items() if len(group) > 1
        )
        print(f"Found {duplicates_found} tenant names with multiple entries")

        # Track tenants to delete
        tenants_to_delete = []

        # Process each group of tenants with the same name
        for name, group in tenant_groups.items():
            if len(group) <= 1:
                continue  # No duplicates for this name

            print(f"\nProcessing duplicates for tenant: {name}")
            print(f"  Found {len(group)} entries")

            # Check if any are assigned to apartments
            assigned_tenants = [t for t in group if t.apartment_id is not None]
            unassigned_tenants = [t for t in group if t.apartment_id is None]

            print(f"  - {len(assigned_tenants)} assigned to apartments")
            print(f"  - {len(unassigned_tenants)} not assigned to any apartment")

            # If there are assigned tenants, keep those and delete unassigned ones
            if assigned_tenants:
                print(f"  - Keeping {len(assigned_tenants)} assigned tenant(s)")
                tenants_to_delete.extend(unassigned_tenants)
            # If all are unassigned, keep just one (the one with the most data)
            else:
                # Sort by which tenant has the most non-null fields
                def count_filled_fields(tenant):
                    fields = [
                        tenant.email,
                        tenant.phone,
                        tenant.bornOn,
                        tenant.refundIban,
                    ]
                    return sum(1 for f in fields if f is not None and f != "")

                unassigned_tenants.sort(key=count_filled_fields, reverse=True)

                # Keep the first one (has most data), delete the rest
                tenant_to_keep = unassigned_tenants[0]
                tenants_to_delete.extend(unassigned_tenants[1:])
                print(
                    f"  - All duplicates unassigned, keeping tenant ID {tenant_to_keep.id} with most data"
                )

        # Report findings before taking action
        print(f"\nSummary: Found {len(tenants_to_delete)} duplicate tenants to remove")

        # Confirm deletion
        if tenants_to_delete:
            confirmation = input("Proceed with deletion? (yes/no): ")
            if confirmation.lower() == "yes":
                # Delete the duplicate tenants
                for tenant in tenants_to_delete:
                    print(f"Deleting tenant: {tenant.name} (ID: {tenant.id})")
                    db.session.delete(tenant)

                # Commit the changes
                db.session.commit()
                print(
                    f"Successfully deleted {len(tenants_to_delete)} duplicate tenants"
                )
            else:
                print("Deletion canceled")
        else:
            print("No duplicate tenants to delete")


if __name__ == "__main__":
    deduplicate_tenants()
