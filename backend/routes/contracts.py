import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file, g
from werkzeug.utils import secure_filename
from models.models import Apartment
from extentions import db
from .auth import token_required, role_required
import json

# Define new model for Contract
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from models.models import Contract

# Create a blueprint for contract management routes
contracts_bp = Blueprint("contracts_bp", __name__)


# Make sure the upload directory exists
def ensure_upload_dir():
    upload_dir = os.path.join(current_app.root_path, "uploads", "contracts")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    return upload_dir


# Helper function to check allowed file extensions
def allowed_file(filename):
    ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "txt", "jpg", "jpeg", "png"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_size_mb(size_bytes):
    """Convert bytes to MB for display"""
    return round(size_bytes / (1024 * 1024), 2)


@contracts_bp.route("/contracts/<int:apartment_id>", methods=["GET"])
@token_required
def get_contracts(apartment_id):
    """
    Get all contracts for a specific apartment
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get all contracts for this apartment
        contracts = Contract.query.filter_by(apartment_id=apartment_id).all()

        # Convert contracts to dict format
        contracts_data = [contract.to_dict() for contract in contracts]

        return jsonify(contracts_data), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching contracts: {e}")
        return jsonify({"message": "Error fetching contracts", "error": str(e)}), 500


@contracts_bp.route("/upload", methods=["POST"])
@token_required
def upload_contract():
    """
    Upload one or more contract files for an apartment
    """
    try:
        # Check if files are included in the request
        if "files" not in request.files:
            return jsonify({"message": "No files provided"}), 400

        # Get apartment ID from form data
        apartment_id = request.form.get("apartmentId")
        if not apartment_id:
            return jsonify({"message": "Apartment ID is required"}), 400

        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get notes from form data
        notes = request.form.get("notes", "")

        # Get user ID from token (if available)
        user_id = getattr(g, "user_id", None)

        # Ensure upload directory exists
        upload_dir = ensure_upload_dir()

        # Process each uploaded file
        files = request.files.getlist("files")
        uploaded_contracts = []

        # Maximum file size in bytes (50MB per file)
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

        # Maximum total upload size (100MB for all files combined)
        MAX_TOTAL_SIZE = 100 * 1024 * 1024  # 100MB

        # Check total size of all files
        total_size = sum(len(file.read()) for file in files)
        for file in files:
            file.seek(0)  # Reset file pointer after reading

        if total_size > MAX_TOTAL_SIZE:
            return jsonify({
                "message": f"Total file size ({get_file_size_mb(total_size)}MB) exceeds maximum allowed size (100MB)"
            }), 413

        for file in files:
            if file and file.filename and allowed_file(file.filename):
                # Check individual file size
                file.seek(0, os.SEEK_END)  # Seek to end
                file_size = file.tell()    # Get position (file size)
                file.seek(0)               # Reset to beginning

                if file_size > MAX_FILE_SIZE:
                    return jsonify({
                        "message": f"File '{file.filename}' ({get_file_size_mb(file_size)}MB) exceeds maximum file size (50MB)"
                    }), 413

                # Secure the filename and generate a unique name
                original_filename = secure_filename(file.filename)
                filename_parts = os.path.splitext(original_filename)
                unique_filename = (
                    f"{filename_parts[0]}_{uuid.uuid4().hex}{filename_parts[1]}"
                )

                # Create file path
                file_path = os.path.join(upload_dir, unique_filename)

                try:
                    # Save the file
                    file.save(file_path)

                    # Verify file was saved successfully
                    if not os.path.exists(file_path):
                        current_app.logger.error(f"File was not saved successfully: {file_path}")
                        continue

                    # Get actual file size after saving
                    actual_file_size = os.path.getsize(file_path)
                    file_extension = os.path.splitext(original_filename)[1].lstrip(".")

                    # Create contract record in database
                    contract = Contract(
                        apartment_id=apartment_id,
                        file_path=file_path,
                        file_name=original_filename,
                        file_size=actual_file_size,
                        file_type=file_extension,
                        notes=notes,
                        uploaded_by=user_id,
                    )

                    db.session.add(contract)
                    uploaded_contracts.append(contract)

                    current_app.logger.info(f"Successfully saved file: {original_filename} ({get_file_size_mb(actual_file_size)}MB)")

                except Exception as file_error:
                    current_app.logger.error(f"Error saving file {original_filename}: {file_error}")
                    # Clean up partially saved file if it exists
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except:
                            pass
                    continue

            elif file and file.filename:
                return jsonify({"message": f"Invalid file type: {file.filename}. Allowed types: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG"}), 400

        if not uploaded_contracts:
            return jsonify({"message": "No valid files were uploaded"}), 400

        # Commit changes to database
        db.session.commit()

        return jsonify(
            {
                "message": f"{len(uploaded_contracts)} contract(s) uploaded successfully",
                "contracts": [contract.to_dict() for contract in uploaded_contracts],
            }
        ), 201

    except Exception as e:
        current_app.logger.error(f"Error uploading contracts: {e}")
        db.session.rollback()
        return jsonify({"message": "Error uploading contracts", "error": str(e)}), 500


@contracts_bp.route("/download/<int:contract_id>", methods=["GET"])
@token_required
def download_contract(contract_id):
    """
    Download a specific contract file
    """
    try:
        # Find the contract in the database
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Check if file exists
        if not os.path.exists(contract.file_path):
            return jsonify({"message": "Contract file not found on server"}), 404

        # Return the file
        return send_file(
            contract.file_path, download_name=contract.file_name, as_attachment=True
        )

    except Exception as e:
        current_app.logger.error(f"Error downloading contract: {e}")
        return jsonify({"message": "Error downloading contract", "error": str(e)}), 500


@contracts_bp.route("/contracts/<int:contract_id>", methods=["DELETE"])
@token_required
def delete_contract(contract_id):
    """
    Delete a specific contract
    """
    try:
        # Find the contract in the database
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # First delete the file from storage
        if os.path.exists(contract.file_path):
            try:
                os.remove(contract.file_path)
                current_app.logger.info(f"Deleted file: {contract.file_path}")
            except Exception as file_error:
                current_app.logger.error(f"Error deleting file {contract.file_path}: {file_error}")
                # Continue with database deletion even if file deletion fails

        # Then delete the database record
        db.session.delete(contract)
        db.session.commit()

        return jsonify({"message": "Contract deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting contract: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting contract", "error": str(e)}), 500


# Optional: Update contract details
@contracts_bp.route("/contracts/<int:contract_id>", methods=["PUT"])
@token_required
def update_contract(contract_id):
    """
    Update contract metadata (notes)
    """
    try:
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Find the contract in the database
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Update notes field
        if "notes" in data:
            contract.notes = data["notes"]

        # Commit changes
        db.session.commit()

        return jsonify(
            {"message": "Contract updated successfully", "contract": contract.to_dict()}
        ), 200

    except Exception as e:
        current_app.logger.error(f"Error updating contract: {e}")
        db.session.rollback()
        return jsonify({"message": "Error updating contract", "error": str(e)}), 500


# Get contract details
@contracts_bp.route("/contracts/details/<int:contract_id>", methods=["GET"])
@token_required
def get_contract_details(contract_id):
    """
    Get detailed information about a specific contract
    """
    try:
        # Find the contract in the database
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Get apartment details
        apartment = Apartment.query.get(contract.apartment_id)

        # Create extended contract details
        contract_details = contract.to_dict()
        contract_details["apartment"] = {
            "id": apartment.id,
            "address": apartment.address,
        }

        return jsonify(contract_details), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contract details: {e}")
        return jsonify(
            {"message": "Error getting contract details", "error": str(e)}
        ), 500


# Search contracts across all apartments
@contracts_bp.route("/contracts/search", methods=["GET"])
@token_required
def search_contracts():
    """
    Search for contracts across all apartments based on filename or notes
    """
    try:
        query = request.args.get("q", "")
        if not query:
            return jsonify([]), 200

        # Search for contracts matching the query
        contracts = Contract.query.filter(
            (Contract.file_name.ilike(f"%{query}%"))
            | (Contract.notes.ilike(f"%{query}%"))
        ).all()

        # Convert contracts to dict format
        contracts_data = []
        for contract in contracts:
            contract_dict = contract.to_dict()

            # Add apartment address
            apartment = Apartment.query.get(contract.apartment_id)
            contract_dict["apartmentAddress"] = (
                apartment.address if apartment else "Unknown"
            )

            contracts_data.append(contract_dict)

        return jsonify(contracts_data), 200

    except Exception as e:
        current_app.logger.error(f"Error searching contracts: {e}")
        return jsonify({"message": "Error searching contracts", "error": str(e)}), 500
