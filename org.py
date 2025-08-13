#!/usr/bin/env python3
import os
import re
from pathlib import Path


def fix_actual_imports():
    src = Path("frontend/src")
    components = src / "components"

    print("🔧 Fixing imports based on actual file locations...")

    # First, scan all components and their actual locations
    component_locations = {}

    for folder in components.iterdir():
        if folder.is_dir():
            for jsx_file in folder.glob("*.jsx"):
                component_name = jsx_file.stem  # filename without extension
                component_locations[component_name] = folder.name
                print(f"📍 {component_name} is in {folder.name}/")

    print(f"\n🔧 Found {len(component_locations)} components")

    # Now fix imports in all files
    for folder in components.iterdir():
        if folder.is_dir():
            for jsx_file in folder.glob("*.jsx"):
                fix_imports_in_file(jsx_file, component_locations, folder.name)

    print("✅ All imports fixed based on actual locations!")


def fix_imports_in_file(file_path, component_locations, current_folder):
    try:
        with open(file_path, "r") as f:
            content = f.read()

        original = content

        # Find all import statements that import React components
        import_pattern = r"import\s+([^{}\s]+)\s+from\s+['\"]([^'\"]+)['\"]"
        matches = re.finditer(import_pattern, content)

        for match in matches:
            imported_component = match.group(1)
            import_path = match.group(2)

            # Skip non-component imports (utils, etc.)
            if not imported_component[0].isupper() or imported_component in [
                "React",
                "Component",
            ]:
                continue

            # Skip if already correct or is external library
            if import_path.startswith("react") or import_path.startswith("@"):
                continue

            # Find where this component actually is
            if imported_component in component_locations:
                actual_folder = component_locations[imported_component]

                # Calculate correct relative path
                if actual_folder == current_folder:
                    # Same folder
                    correct_path = f"./{imported_component}"
                else:
                    # Different folder
                    correct_path = f"../{actual_folder}/{imported_component}"

                # Replace the import if it's wrong
                if import_path != correct_path:
                    old_import = f"import {imported_component} from '{import_path}'"
                    new_import = f"import {imported_component} from '{correct_path}'"
                    content = content.replace(old_import, new_import)
                    print(
                        f"  🔄 {file_path.name}: {imported_component} {import_path} → {correct_path}"
                    )

        # Also fix utils imports
        content = re.sub(
            r"from\s+['\"]\.\.\/\.\.\/\.\.\/utils\/([^'\"]+)['\"]",
            r"from '../../utils/\1'",
            content,
        )
        content = re.sub(
            r"from\s+['\"]\.\.\/utils\/([^'\"]+)['\"]",
            r"from '../../utils/\1'",
            content,
        )

        if content != original:
            with open(file_path, "w") as f:
                f.write(content)
            print(f"  ✅ Updated {file_path.name}")

    except Exception as e:
        print(f"  ❌ Error fixing {file_path}: {e}")


if __name__ == "__main__":
    fix_actual_imports()
