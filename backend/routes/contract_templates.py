# routes/contract_templates.py
import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file, g
from werkzeug.utils import secure_filename
from models.models import ContractTemplate, Apartment
from extentions import db
from .auth import token_required, role_required
import json
from utils.logging_helpers import log_with_user

# Create a blueprint for contract template routes
contract_templates_bp = Blueprint("contract_templates_bp", __name__)


# Make sure the templates directory exists
def ensure_templates_dir():
    templates_dir = os.path.join(current_app.root_path, "uploads", "templates")
    if not os.path.exists(templates_dir):
        os.makedirs(templates_dir)
    return templates_dir


# Helper function to check allowed file extensions
def allowed_file(filename):
    ALLOWED_EXTENSIONS = {"docx"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_size_mb(size_bytes):
    """Convert bytes to MB for display"""
    return round(size_bytes / (1024 * 1024), 2)


@contract_templates_bp.route("/templates", methods=["GET"])
@token_required
def get_templates():
    """
    Get all contract templates
    """
    try:
        # Query all templates
        templates = ContractTemplate.query.all()
        templates_data = [template.to_dict() for template in templates]
        return jsonify(templates_data), 200
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error fetching contract templates: {e}")
        return jsonify(
            {"message": "Error fetching contract templates", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates/<int:template_id>", methods=["GET"])
@token_required
def get_template(template_id):
    """
    Get a specific contract template
    """
    try:
        template = ContractTemplate.query.get(template_id)
        if not template:
            return jsonify({"message": "Template not found"}), 404
        return jsonify(template.to_dict()), 200
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error fetching contract template: {e}")
        return jsonify(
            {"message": "Error fetching contract template", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates", methods=["POST"])
@token_required
def add_template():
    """
    Add a new contract template (metadata only, file upload is separate)
    """
    try:
        data = request.get_json()
        name = data.get("name")
        description = data.get("description", "")
        is_default = data.get("isDefault", False)

        if not name:
            return jsonify({"message": "Template name is required"}), 400

        # Check if a template with this name already exists
        existing_template = ContractTemplate.query.filter_by(name=name).first()
        if existing_template:
            return jsonify({"message": "A template with this name already exists"}), 400

        # If this is the first template or marked as default, update others
        if is_default or ContractTemplate.query.count() == 0:
            # Clear default flag on all other templates if this one is default
            ContractTemplate.query.update({"is_default": False})
            is_default = True

        # Create new template record in database
        template = ContractTemplate(
            name=name,
            description=description,
            is_default=is_default,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            created_by=g.user.get("sub") if hasattr(g, "user") else None,
        )

        db.session.add(template)
        db.session.commit()

        return jsonify(
            {
                "message": "Contract template created successfully",
                "template": template.to_dict(),
            }
        ), 201
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error creating contract template: {e}")
        db.session.rollback()
        return jsonify(
            {"message": "Error creating contract template", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates/upload", methods=["POST"])
@token_required
def upload_template():
    """
    Upload a contract template file
    """
    try:
        # Check if file is included
        if "file" not in request.files:
            return jsonify({"message": "No file provided"}), 400

        file = request.files["file"]
        if not file or file.filename == "":
            return jsonify({"message": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"message": "Only DOCX files are allowed"}), 400

        # Check file size (reduced limit for better reliability)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB (reduced from larger sizes)

        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_FILE_SIZE:
            return jsonify({
                "message": f"File size ({get_file_size_mb(file_size)}MB) exceeds maximum allowed size (10MB)"
            }), 413

        if file_size == 0:
            return jsonify({"message": "Cannot upload empty file"}), 400

        # Get form data
        name = request.form.get("name")
        description = request.form.get("description", "")
        is_default = request.form.get("isDefault") in ["true", "True", "1"]

        if not name:
            return jsonify({"message": "Template name is required"}), 400

        # Check if a template with this name already exists
        existing_template = ContractTemplate.query.filter_by(name=name).first()
        if existing_template:
            return jsonify({"message": "A template with this name already exists"}), 400

        # If this is the first template or marked as default, update others
        if is_default or ContractTemplate.query.count() == 0:
            # Clear default flag on all other templates if this one is default
            ContractTemplate.query.update({"is_default": False})
            is_default = True

        # Save the file
        templates_dir = ensure_templates_dir()
        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({"message": "Invalid filename"}), 400

        file_path = os.path.join(templates_dir, f"{uuid.uuid4().hex}_{filename}")

        try:
            # Save file in chunks for better handling of larger files
            with open(file_path, 'wb') as f:
                chunk_size = 8192  # 8KB chunks
                while True:
                    chunk = file.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)

            # Verify file was saved successfully
            if not os.path.exists(file_path):
                return jsonify({"message": "Failed to save file"}), 500

            actual_file_size = os.path.getsize(file_path)

        except Exception as save_error:
            log_with_user(current_app.logger, 'error', f"Error saving template file: {save_error}")
            # Clean up partially saved file
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            return jsonify({"message": "Failed to save template file"}), 500

        # Create new template record in database
        template = ContractTemplate(
            name=name,
            description=description,
            file_path=file_path,
            file_name=filename,
            file_size=actual_file_size,
            is_default=is_default,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            created_by=g.user.get("sub") if hasattr(g, "user") else None,
        )

        db.session.add(template)
        db.session.commit()

        current_app.logger.info(f"Successfully uploaded template: {name} ({get_file_size_mb(actual_file_size)}MB)")

        return jsonify(
            {
                "message": "Contract template uploaded successfully",
                "template": template.to_dict(),
            }
        ), 201
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error uploading contract template: {e}")
        db.session.rollback()
        return jsonify(
            {"message": "Error uploading contract template", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates/<int:template_id>", methods=["PUT"])
@token_required
def update_template(template_id):
    """
    Update a contract template's metadata
    """
    try:
        template = ContractTemplate.query.get(template_id)
        if not template:
            return jsonify({"message": "Template not found"}), 404

        data = request.get_json()
        name = data.get("name")
        description = data.get("description")
        is_default = data.get("isDefault")

        if name and name != template.name:
            # Check if another template with this name exists
            existing_template = ContractTemplate.query.filter(
                ContractTemplate.name == name, ContractTemplate.id != template_id
            ).first()
            if existing_template:
                return jsonify(
                    {"message": "Another template with this name already exists"}
                ), 400
            template.name = name

        if description is not None:
            template.description = description

        if is_default is not None and is_default and not template.is_default:
            # If setting this as default, clear other defaults
            ContractTemplate.query.filter(ContractTemplate.id != template_id).update(
                {"is_default": False}
            )
            template.is_default = True
        elif is_default is not None:
            template.is_default = is_default

        template.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(
            {
                "message": "Contract template updated successfully",
                "template": template.to_dict(),
            }
        ), 200
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error updating contract template: {e}")
        db.session.rollback()
        return jsonify(
            {"message": "Error updating contract template", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates/<int:template_id>/default", methods=["PUT"])
@token_required
def set_default_template(template_id):
    """
    Set a template as the default
    """
    try:
        template = ContractTemplate.query.get(template_id)
        if not template:
            return jsonify({"message": "Template not found"}), 404

        # Clear default flag on all templates
        ContractTemplate.query.update({"is_default": False})

        # Set this template as default
        template.is_default = True
        template.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(
            {
                "message": "Default template updated successfully",
                "template": template.to_dict(),
            }
        ), 200
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error setting default template: {e}")
        db.session.rollback()
        return jsonify(
            {"message": "Error setting default template", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates/<int:template_id>", methods=["DELETE"])
@token_required
def delete_template(template_id):
    """
    Delete a contract template
    """
    try:
        template = ContractTemplate.query.get(template_id)
        if not template:
            return jsonify({"message": "Template not found"}), 404

        # Check if this is the only template
        is_only_template = ContractTemplate.query.count() == 1

        # If this is the default template and not the only one, set another as default
        if template.is_default and not is_only_template:
            # Find another template to set as default
            other_template = ContractTemplate.query.filter(
                ContractTemplate.id != template_id
            ).first()
            if other_template:
                other_template.is_default = True

        # Delete the file if it exists
        if template.file_path and os.path.exists(template.file_path):
            try:
                os.remove(template.file_path)
                current_app.logger.info(f"Deleted template file: {template.file_path}")
            except Exception as file_error:
                log_with_user(current_app.logger, 'error', f"Error deleting template file: {file_error}")

        # Delete from database
        db.session.delete(template)
        db.session.commit()

        return jsonify({"message": "Contract template deleted successfully"}), 200
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error deleting contract template: {e}")
        db.session.rollback()
        return jsonify(
            {"message": "Error deleting contract template", "error": str(e)}
        ), 500


@contract_templates_bp.route("/templates/<int:template_id>/download", methods=["GET"])
@token_required
def download_template(template_id):
    """
    Download a contract template file
    """
    try:
        template = ContractTemplate.query.get(template_id)
        if not template:
            return jsonify({"message": "Template not found"}), 404

        if not template.file_path or not os.path.exists(template.file_path):
            return jsonify({"message": "Template file not found"}), 404

        return send_file(
            template.file_path, download_name=template.file_name, as_attachment=True
        )
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error downloading template: {e}")
        return jsonify({"message": "Error downloading template", "error": str(e)}), 500


@contract_templates_bp.route("/createContract", methods=["POST"])
@token_required
def create_contract_with_template():
    """
    Create a contract using a specific template or the default template
    """
    try:
        data = request.get_json()
        apartment_id = data.get("apartmentId")
        template_id = data.get("templateId")  # Optional: specific template to use

        if not apartment_id:
            return jsonify({"message": "Apartment ID is required"}), 400

        # Retrieve the apartment
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get requested template or default template
        template = None
        if template_id:
            template = ContractTemplate.query.get(template_id)
            if not template:
                return jsonify({"message": "Template not found"}), 404
        else:
            # Get default template
            template = ContractTemplate.query.filter_by(is_default=True).first()
            if not template:
                # If no default, get the first available template
                template = ContractTemplate.query.first()

        if (
            not template
            or not template.file_path
            or not os.path.exists(template.file_path)
        ):
            return jsonify({"message": "No valid contract template found"}), 404

        # Call the existing contract generation logic but with the specified template
        from routes.documents import (
            format_dates,
            get_financial_details,
            format_tenants,
            build_db_data,
            generate_filename,
            update_rental_agreement,
        )

        tenants_list = apartment.tenants
        if not tenants_list:
            return jsonify({"message": "No tenants linked to apartment"}), 400

        # Get dates, financial details, and tenants
        today, start_date, end_date = format_dates(apartment)
        rent_amount, security_deposit = get_financial_details(apartment)
        formatted_tenants = format_tenants(tenants_list)

        # Build data dictionary
        db_data = build_db_data(
            apartment,
            rent_amount,
            security_deposit,
            start_date,
            end_date,
            today,
            formatted_tenants,
        )

        # Generate filename
        filename = generate_filename(apartment, tenants_list)

        # Create the contract document using the selected template
        from io import BytesIO

        buffer = BytesIO()
        update_rental_agreement(
            template.file_path, buffer, db_data
        )  # Use template.file_path
        buffer.seek(0)

        return send_file(
            buffer,
            download_name=filename,
            as_attachment=True,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error generating contract: {e}")
        return jsonify({"message": "Error generating contract", "error": str(e)}), 500
