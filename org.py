#!/usr/bin/env python3
import os
import shutil
import re
from pathlib import Path

# Where each component should go
MAPPING = {
    "ApartmentCard.jsx": "apartment",
    "ApartmentDetailsDialog.jsx": "apartment",
    "ApartmentDetailsForm.jsx": "apartment",
    "ApartmentForm.jsx": "apartment",
    "ApartmentList.jsx": "apartment",
    "TenantDetails.jsx": "tenant",
    "TenantFormDialog.jsx": "tenant",
    "TenantSelector.jsx": "tenant",
    "TenantsPanel.jsx": "tenant",
    "EnhancedTenantForm.jsx": "tenant",
    "LandlordDetails.jsx": "landlord",
    "LandlordsPanel.jsx": "landlord",
    "EnhancedLandlordForm.jsx": "landlord",
    "ContractExtensionDialog.jsx": "contract",
    "ContractGeneratorDialog.jsx": "contract",
    "ContractGenerator.jsx": "contract",
    "ContractManager.jsx": "contract",
    "ContractManagementDialog.jsx": "contract",
    "ContractTemplatesManager.jsx": "contract",
    "PaymentScreen.jsx": "payment",
    "NetEarningsSection.jsx": "payment",
    "AdminPanel.jsx": "admin",
    "UsersList.jsx": "admin",
    "UserAnalyticsPanel.jsx": "admin",
    "PasswordChangeDialog.jsx": "admin",
    "LoginPage.jsx": "auth",
    "RegisterPage.jsx": "auth",
    "MainLayout.jsx": "layout",
    "ModelSelection.jsx": "layout",
    "AnalyticsPanel.jsx": "analytics",
    "LogsViewer.jsx": "analytics",
}


def organize():
    src = Path("frontend/src")
    components = src / "components"

    print("🚀 Organizing components...")

    # Create backup
    if components.exists():
        shutil.copytree(components, "backup-components", dirs_exist_ok=True)
        print("✅ Backup created")

    # Create folders
    folders = set(MAPPING.values())
    for folder in folders:
        (components / folder).mkdir(exist_ok=True)

    # Move files
    moved = {}
    for file, folder in MAPPING.items():
        src_file = components / file
        if src_file.exists():
            dst_file = components / folder / file
            shutil.move(str(src_file), str(dst_file))
            moved[file] = folder
            print(f"📦 {file} → {folder}/")

    # Move remaining files to common
    for jsx_file in components.glob("*.jsx"):
        dst = components / "common" / jsx_file.name
        shutil.move(str(jsx_file), str(dst))
        moved[jsx_file.name] = "common"
        print(f"📦 {jsx_file.name} → common/")

    # Fix imports
    print("\n🔧 Fixing imports...")
    for file_path in src.rglob("*.js*"):
        if "node_modules" in str(file_path) or "backup" in str(file_path):
            continue

        try:
            with open(file_path, "r") as f:
                content = f.read()

            original = content

            for filename, folder in moved.items():
                component_name = filename.replace(".jsx", "")

                # Calculate relative path
                rel_path = (
                    os.path.relpath(
                        components / folder / component_name, file_path.parent
                    )
                    .replace("\\", "/")
                    .replace(".jsx", "")
                )

                if not rel_path.startswith("."):
                    rel_path = "./" + rel_path

                # Fix various import patterns
                patterns = [
                    rf"from\s+['\"]\./{component_name}['\"]",
                    rf"from\s+['\"]\./{filename}['\"]",
                    rf"from\s+['\"][^'\"]*{component_name}['\"]",
                ]

                for pattern in patterns:
                    content = re.sub(pattern, f"from '{rel_path}'", content)

            if content != original:
                with open(file_path, "w") as f:
                    f.write(content)
                print(f"🔄 Fixed {file_path}")

        except Exception as e:
            print(f"❌ Error with {file_path}: {e}")

    print(f"\n✅ Done! Moved {len(moved)} files")
    print("💾 Backup saved to backup-components/")


if __name__ == "__main__":
    organize()
