# routes/contracts.py - COMPLETE FIXED VERSION with correct frontend mapping
import os
import uuid
import mimetypes
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, send_file, g
from werkzeug.utils import secure_filename
from models.models import Apartment, Contract
from extentions import db
from .auth import token_required, role_required

# Create a blueprint for contract management routes
contracts_bp = Blueprint("contracts_bp", __name__)


def ensure_upload_dir():
    """Make sure the upload directory exists"""
    upload_dir = os.path.join(current_app.root_path, "uploads", "contracts")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def allowed_file(filename):
    """Helper function to check allowed file extensions"""
    ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "xls", "xlsx"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_size_mb(size_bytes):
    """Convert bytes to MB for display"""
    if not size_bytes:
        return 0
    return round(size_bytes / (1024 * 1024), 2)


def get_contract_type_from_filename(filename):
    """Determine contract type based on filename"""
    filename_lower = filename.lower()
    if any(word in filename_lower for word in ['lease', 'rental', 'rent']):
        return 'rental_agreement'
    elif any(word in filename_lower for word in ['insurance', 'policy']):
        return 'insurance'
    elif any(word in filename_lower for word in ['utility', 'electric', 'water', 'gas']):
        return 'utility'
    elif any(word in filename_lower for word in ['maintenance', 'repair']):
        return 'maintenance'
    else:
        return 'other'


def format_contract_for_frontend(contract):
    """Format contract data for frontend consumption - FIXED"""
    if not contract:
        return None

    # Get file extension for fileType
    file_extension = "Unknown"
    if contract.file_name and '.' in contract.file_name:
        file_extension = contract.file_name.rsplit('.', 1)[1].upper()

    return {
        "id": contract.id,
        "fileName": contract.file_name or "Unknown",
        "fileSize": contract.file_size or 0,
        "fileType": file_extension,  # Frontend expects file extension
        "uploadDate": contract.created_at.isoformat() if contract.created_at else None,
        "notes": contract.description or "No notes",
        "apartmentId": contract.apartment_id,
        "mimeType": contract.mime_type,
        "filePath": contract.file_path,
        "contractType": contract.contract_type or "rental_agreement",
        "createdAt": contract.created_at.isoformat() if contract.created_at else None,
        "updatedAt": contract.updated_at.isoformat() if contract.updated_at else None
    }


@contracts_bp.route("/contracts/<int:apartment_id>", methods=["GET"])
@token_required
def get_contracts(apartment_id):
    """Get all contracts for a specific apartment"""
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get all contracts for this apartment, ordered by creation date (newest first)
        contracts = Contract.query.filter_by(apartment_id=apartment_id).order_by(Contract.created_at.desc()).all()

        # Convert contracts to frontend format
        contracts_data = [format_contract_for_frontend(contract) for contract in contracts]

        return jsonify(contracts_data), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching contracts for apartment {apartment_id}: {e}")
        return jsonify({"message": "Error fetching contracts", "error": str(e)}), 500


@contracts_bp.route("/upload", methods=["POST"])
@token_required
def upload_contract():
    """Upload one or more contract files for an apartment - COMPLETE FIXED VERSION"""
    try:
        # Check if files are included in the request
        if "files" not in request.files:
            return jsonify({"message": "No files provided"}), 400

        # Get apartment ID from form data
        apartment_id = request.form.get("apartmentId")
        if not apartment_id:
            return jsonify({"message": "Apartment ID is required"}), 400

        try:
            apartment_id = int(apartment_id)
        except ValueError:
            return jsonify({"message": "Invalid apartment ID"}), 400

        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get notes from form data
        notes = request.form.get("notes", "")

        # Ensure upload directory exists
        upload_dir = ensure_upload_dir()

        # Process each uploaded file
        files = request.files.getlist("files")
        uploaded_contracts = []
        errors = []

        # File size limits
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB per file
        MAX_TOTAL_SIZE = 100 * 1024 * 1024  # 100MB total

        # Check total size of all files
        total_size = 0
        valid_files = []

        for file in files:
            if file and file.filename:
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)

                if file_size == 0:
                    errors.append(f"File '{file.filename}' is empty and will be skipped")
                    continue

                if not allowed_file(file.filename):
                    errors.append(f"File '{file.filename}' has unsupported format")
                    continue

                total_size += file_size
                valid_files.append((file, file_size))

        if total_size > MAX_TOTAL_SIZE:
            return jsonify({
                "message": f"Total file size ({get_file_size_mb(total_size)}MB) exceeds maximum allowed size ({get_file_size_mb(MAX_TOTAL_SIZE)}MB)"
            }), 413

        if not valid_files:
            return jsonify({
                "message": "No valid files found. Allowed types: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG, XLS, XLSX",
                "errors": errors
            }), 400

        # Process valid files
        for file, file_size in valid_files:
            try:
                # Check individual file size
                if file_size > MAX_FILE_SIZE:
                    errors.append(f"File '{file.filename}' ({get_file_size_mb(file_size)}MB) exceeds maximum file size ({get_file_size_mb(MAX_FILE_SIZE)}MB)")
                    continue

                # Generate secure filename
                original_filename = secure_filename(file.filename)
                if not original_filename:
                    errors.append(f"Invalid filename: '{file.filename}'")
                    continue

                # Generate unique filename to avoid conflicts
                file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
                unique_filename = f"{uuid.uuid4().hex}_{original_filename}"
                file_path = os.path.join(upload_dir, unique_filename)

                # Save file in chunks for better memory handling
                with open(file_path, 'wb') as f:
                    chunk_size = 8192  # 8KB chunks
                    while True:
                        chunk = file.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)

                # Verify file was saved successfully
                if not os.path.exists(file_path):
                    errors.append(f"Failed to save file: {original_filename}")
                    continue

                actual_file_size = os.path.getsize(file_path)

                # Get MIME type
                mime_type, _ = mimetypes.guess_type(file_path)
                if not mime_type:
                    mime_type = 'application/octet-stream'

                # Determine contract type from filename
                contract_type = get_contract_type_from_filename(original_filename)

                # FIXED: Create contract with correct field names
                contract = Contract(
                    apartment_id=apartment_id,
                    file_name=original_filename,
                    file_path=file_path,
                    file_size=actual_file_size,
                    mime_type=mime_type,
                    contract_type=contract_type,  # FIXED: Use contract_type not file_type
                    description=notes if notes else f"Contract file: {original_filename}",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )

                db.session.add(contract)
                uploaded_contracts.append(contract)

                current_app.logger.info(f"Successfully processed file: {original_filename} ({get_file_size_mb(actual_file_size)}MB) for apartment {apartment_id}")

            except Exception as save_error:
                current_app.logger.error(f"Error processing file {file.filename}: {save_error}")
                # Clean up partially saved file
                if 'file_path' in locals() and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except:
                        pass
                errors.append(f"Error processing file '{file.filename}': {str(save_error)}")
                continue

        if not uploaded_contracts:
            return jsonify({
                "message": "No files were successfully uploaded",
                "errors": errors
            }), 400

        # Commit changes to database
        db.session.commit()

        # Format contracts for frontend
        contracts_data = [format_contract_for_frontend(contract) for contract in uploaded_contracts]

        response_data = {
            "message": f"{len(uploaded_contracts)} contract(s) uploaded successfully",
            "contracts": contracts_data,
        }

        if errors:
            response_data["warnings"] = errors

        return jsonify(response_data), 201

    except Exception as e:
        current_app.logger.error(f"Error uploading contracts: {e}")
        db.session.rollback()
        return jsonify({"message": "Error uploading contracts", "error": str(e)}), 500


@contracts_bp.route("/download/<int:contract_id>", methods=["GET"])
@token_required
def download_contract(contract_id):
    """Download a specific contract file"""
    try:
        # Find the contract in the database
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Check if file exists
        if not os.path.exists(contract.file_path):
            current_app.logger.error(f"Contract file not found: {contract.file_path}")
            return jsonify({"message": "Contract file not found on server"}), 404

        # Return the file
        return send_file(
            contract.file_path,
            download_name=contract.file_name,
            as_attachment=True,
            mimetype=contract.mime_type
        )

    except Exception as e:
        current_app.logger.error(f"Error downloading contract {contract_id}: {e}")
        return jsonify({"message": "Error downloading contract", "error": str(e)}), 500


@contracts_bp.route("/contracts/<int:contract_id>", methods=["DELETE"])
@token_required
def delete_contract(contract_id):
    """Delete a specific contract"""
    try:
        # Find the contract in the database
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Store file info for logging
        file_name = contract.file_name
        file_path = contract.file_path

        # First delete the file from storage
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                current_app.logger.info(f"Deleted contract file: {file_path}")
            except Exception as file_error:
                current_app.logger.error(f"Error deleting contract file {file_path}: {file_error}")
                # Continue with database deletion even if file deletion fails

        # Delete from database
        db.session.delete(contract)
        db.session.commit()

        current_app.logger.info(f"Successfully deleted contract: {file_name} (ID: {contract_id})")

        return jsonify({"message": "Contract deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting contract {contract_id}: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting contract", "error": str(e)}), 500


@contracts_bp.route("/contracts/<int:contract_id>", methods=["PUT"])
@token_required
def update_contract(contract_id):
    """Update contract metadata"""
    try:
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Update allowed fields
        if 'contract_type' in data:
            valid_types = ['rental_agreement', 'insurance', 'utility', 'maintenance', 'other']
            if data['contract_type'] in valid_types:
                contract.contract_type = data['contract_type']
            else:
                return jsonify({"message": f"Invalid contract type. Must be one of: {', '.join(valid_types)}"}), 400

        if 'description' in data:
            contract.description = data['description']

        contract.updated_at = datetime.utcnow()

        db.session.commit()

        current_app.logger.info(f"Updated contract {contract_id}: {contract.file_name}")

        return jsonify({
            "message": "Contract updated successfully",
            "contract": format_contract_for_frontend(contract)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error updating contract {contract_id}: {e}")
        db.session.rollback()
        return jsonify({"message": "Error updating contract", "error": str(e)}), 500


@contracts_bp.route("/contracts/<int:contract_id>/info", methods=["GET"])
@token_required
def get_contract_info(contract_id):
    """Get detailed information about a specific contract"""
    try:
        contract = Contract.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Check if file still exists
        file_exists = os.path.exists(contract.file_path) if contract.file_path else False

        contract_info = format_contract_for_frontend(contract)
        contract_info['file_exists'] = file_exists
        contract_info['file_size_mb'] = get_file_size_mb(contract.file_size)

        # Add apartment info
        if contract.apartment_id:
            apartment = Apartment.query.get(contract.apartment_id)
            if apartment:
                contract_info['apartment'] = {
                    'id': apartment.id,
                    'address': apartment.address,
                    'number': apartment.number
                }

        return jsonify(contract_info), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contract info {contract_id}: {e}")
        return jsonify({"message": "Error getting contract information", "error": str(e)}), 500


@contracts_bp.route("/stats", methods=["GET"])
@token_required
def get_contracts_stats():
    """Get statistics about contracts"""
    try:
        total_contracts = Contract.query.count()

        # Count by contract type
        contract_types = db.session.query(
            Contract.contract_type,
            db.func.count(Contract.id).label('count')
        ).group_by(Contract.contract_type).all()

        type_stats = {contract_type: count for contract_type, count in contract_types}

        # Calculate total file size
        total_size_result = db.session.query(db.func.sum(Contract.file_size)).scalar()
        total_size_mb = get_file_size_mb(total_size_result) if total_size_result else 0

        # Recent uploads (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_uploads = Contract.query.filter(Contract.created_at >= thirty_days_ago).count()

        stats = {
            "total_contracts": total_contracts,
            "contract_types": type_stats,
            "total_storage_mb": total_size_mb,
            "recent_uploads_30_days": recent_uploads
        }

        return jsonify(stats), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contracts stats: {e}")
        return jsonify({"message": "Error getting contract statistics", "error": str(e)}), 500


# Health check endpoint for contracts service
@contracts_bp.route("/health", methods=["GET"])
def contracts_health():
    """Health check for contracts service"""
    try:
        # Check if upload directory exists and is writable
        upload_dir = ensure_upload_dir()

        # Check database connectivity
        total_contracts = Contract.query.count()

        return jsonify({
            "status": "healthy",
            "upload_dir": upload_dir,
            "upload_dir_exists": os.path.exists(upload_dir),
            "total_contracts": total_contracts,
            "timestamp": datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500
