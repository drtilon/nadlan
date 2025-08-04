# routes/landlords.py
from flask import Blueprint, jsonify, g, current_app, request, Response
from models.models import Landlord, Apartment
from extentions import db
from typing import Tuple, List, Dict, Any
from .auth import token_required, role_required
from pydantic import BaseModel, ValidationError, EmailStr, Field, validator
from datetime import datetime
from activity_logger import ActivityLogger


# Create a Pydantic model for landlord data validation
class LandlordData(BaseModel):
    company_name: str
    name: str
    email: str
    phone: str
    iban: str
    company_address: str
    notes: str = None


landlords_bp = Blueprint("landlords_bp", __name__)


@landlords_bp.route("/landlords/list", methods=["GET"])
@token_required
def list_landlords() -> Tuple[Response, int]:
    """
    Returns a list of all landlords in the system.
    """
    try:
        # Query all landlords from the database
        landlords = Landlord.query.all()

        # Convert to dictionary format
        landlords_data = [landlord.to_dict() for landlord in landlords]

        # For non-admin users, remove sensitive information
        role = g.user.get("role", "limited")
        if role != "admin":
            for landlord in landlords_data:
                landlord.pop("email", None)
                landlord.pop("phone", None)
                landlord.pop("iban", None)
                landlord.pop("notes", None)
        
        # Log this activity
        ActivityLogger.log_activity(
            action="list",
            entity_type="landlord",
            details={"count": len(landlords_data)}
        )

        return jsonify(landlords_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing landlords: {e}")
        return jsonify({"message": "Error listing landlords", "error": str(e)}), 500


@landlords_bp.route("/landlords/add", methods=["POST"])
@token_required
@role_required("admin")
def add_landlord() -> Tuple[Response, int]:
    """
    Adds a new landlord to the system.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Validate request data
        try:
            landlord_data = LandlordData(**data)
        except ValidationError as e:
            # Log validation failure
            ActivityLogger.log_landlord_action(
                action="create",
                landlord_id=None,
                details={"error": "Validation error", "validation_errors": str(e.errors())},
                success=False
            )
            return jsonify({"message": "Invalid data", "errors": e.errors()}), 400

        # Create and add landlord to database
        landlord = Landlord(
            company_name=landlord_data.company_name,
            name=landlord_data.name,
            email=landlord_data.email,
            phone=landlord_data.phone,
            iban=landlord_data.iban,
            company_address=landlord_data.company_address,
            notes=landlord_data.notes,
        )
        db.session.add(landlord)
        db.session.commit()

        # Log landlord creation
        ActivityLogger.log_landlord_action(
            action="create",
            landlord_id=landlord.id,
            details={
                "company_name": landlord.company_name,
                "name": landlord.name,
                "email": landlord.email
            }
        )

        return jsonify(
            {"message": "Landlord added successfully", "id": landlord.id}
        ), 201

    except Exception as e:
        current_app.logger.error(f"Error adding landlord: {e}")
        db.session.rollback()
        
        # Log failure
        ActivityLogger.log_landlord_action(
            action="create",
            landlord_id=None,
            details={"error": str(e)},
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error adding landlord", "error": str(e)}), 500


@landlords_bp.route("/landlords/<int:landlord_id>", methods=["GET"])
@token_required
def get_landlord(landlord_id: int) -> Tuple[Response, int]:
    """
    Returns details for a specific landlord.
    """
    try:
        landlord = Landlord.query.get(landlord_id)
        if not landlord:
            return jsonify({"message": "Landlord not found"}), 404

        landlord_data = landlord.to_dict()

        # Add associated apartments for this landlord
        apartments = Apartment.query.filter_by(landlord_id=landlord_id).all()
        landlord_data["apartments"] = [
            {
                "id": apartment.id,
                "address": apartment.address,
                "status": apartment.status,
                "rent": float(apartment.rent) if apartment.rent else 0,
            }
            for apartment in apartments
        ]

        # For non-admin users, remove sensitive information
        role = g.user.get("role", "limited")
        if role != "admin":
            landlord_data.pop("email", None)
            landlord_data.pop("phone", None)
            landlord_data.pop("iban", None)
            landlord_data.pop("notes", None)

        return jsonify(landlord_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting landlord: {e}")
        return jsonify({"message": "Error getting landlord", "error": str(e)}), 500


@landlords_bp.route("/landlords/<int:landlord_id>", methods=["PUT"])
@token_required
@role_required("admin")
def update_landlord(landlord_id: int) -> Tuple[Response, int]:
    """
    Updates an existing landlord's information.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        landlord = Landlord.query.get(landlord_id)
        if not landlord:
            return jsonify({"message": "Landlord not found"}), 404

        # Capture original data for logging
        original_data = {
            "company_name": landlord.company_name,
            "name": landlord.name,
            "email": landlord.email,
            "phone": landlord.phone,
            "iban": landlord.iban,
            "company_address": landlord.company_address,
            "notes": landlord.notes
        }

        # Update landlord fields
        if "company_name" in data:
            landlord.company_name = data["company_name"]
        if "name" in data:
            landlord.name = data["name"]
        if "email" in data:
            landlord.email = data["email"]
        if "phone" in data:
            landlord.phone = data["phone"]
        if "iban" in data:
            landlord.iban = data["iban"]
        if "company_address" in data:
            landlord.company_address = data["company_address"]
        if "notes" in data:
            landlord.notes = data["notes"]

        landlord.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Prepare updated data for logging
        updated_data = {
            "company_name": landlord.company_name,
            "name": landlord.name,
            "email": landlord.email,
            "phone": landlord.phone,
            "iban": landlord.iban,
            "company_address": landlord.company_address,
            "notes": landlord.notes
        }
        
        # Find which fields changed
        changed_fields = [k for k, v in updated_data.items() if original_data.get(k) != v]
        
        # Log landlord update
        ActivityLogger.log_landlord_action(
            action="update",
            landlord_id=landlord_id,
            details={
                "changed_fields": changed_fields,
                "original": {k: original_data[k] for k in changed_fields},
                "updated": {k: updated_data[k] for k in changed_fields}
            }
        )
        
        return jsonify({"message": "Landlord updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating landlord: {e}")
        db.session.rollback()
        
        # Log failure
        ActivityLogger.log_landlord_action(
            action="update",
            landlord_id=landlord_id,
            details={"error": str(e)},
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error updating landlord", "error": str(e)}), 500


@landlords_bp.route("/landlords/<int:landlord_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_landlord(landlord_id: int) -> Tuple[Response, int]:
    """
    Deletes a landlord from the system.
    """
    try:
        landlord = Landlord.query.get(landlord_id)
        if not landlord:
            return jsonify({"message": "Landlord not found"}), 404

        # Check if there are apartments associated with this landlord
        associated_apartments = Apartment.query.filter_by(
            landlord_id=landlord_id
        ).count()
        if associated_apartments > 0:
            # Log attempted deletion with existing apartments
            ActivityLogger.log_landlord_action(
                action="delete",
                landlord_id=landlord_id,
                details={
                    "error": "Cannot delete landlord with associated apartments",
                    "apartment_count": associated_apartments
                },
                success=False
            )
            return jsonify(
                {
                    "message": "Cannot delete landlord with associated apartments",
                    "apartment_count": associated_apartments,
                }
            ), 400
            
        # Capture landlord data for logging
        landlord_data = {
            "id": landlord.id,
            "company_name": landlord.company_name,
            "name": landlord.name,
            "email": landlord.email
        }
        
        db.session.delete(landlord)
        db.session.commit()
        
        # Log successful deletion
        ActivityLogger.log_landlord_action(
            action="delete",
            landlord_id=landlord_id,
            details=landlord_data
        )
        
        return jsonify({"message": "Landlord deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting landlord: {e}")
        db.session.rollback()
        
        # Log failure
        ActivityLogger.log_landlord_action(
            action="delete",
            landlord_id=landlord_id,
            details={"error": str(e)},
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error deleting landlord", "error": str(e)}), 500


@landlords_bp.route("/landlords/search", methods=["GET"])
@token_required
def search_landlords() -> Tuple[Response, int]:
    """
    Searches for landlords based on query parameters.
    """
    try:
        query = request.args.get("q", "")
        if not query:
            return jsonify([]), 200

        # Search for landlords by name or company name
        landlords = Landlord.query.filter(
            (Landlord.name.ilike(f"%{query}%"))
            | (Landlord.company_name.ilike(f"%{query}%"))
        ).all()

        # Convert to dictionary format and filter sensitive info for non-admins
        landlords_data = []
        role = g.user.get("role", "limited")

        for landlord in landlords:
            landlord_dict = landlord.to_dict()

            if role != "admin":
                landlord_dict.pop("email", None)
                landlord_dict.pop("phone", None)
                landlord_dict.pop("iban", None)
                landlord_dict.pop("notes", None)

            landlords_data.append(landlord_dict)
        
        # Log search
        ActivityLogger.log_activity(
            action="search",
            entity_type="landlord",
            details={"query": query, "results": len(landlords_data)}
        )

        return jsonify(landlords_data), 200

    except Exception as e:
        current_app.logger.error(f"Error searching landlords: {e}")
        return jsonify({"message": "Error searching landlords", "error": str(e)}), 500


@landlords_bp.route("/landlords/<int:landlord_id>/apartments", methods=["GET"])
@token_required
def get_landlord_apartments(landlord_id: int) -> Tuple[Response, int]:
    """
    Returns all apartments for a specific landlord.
    """
    try:
        # Check if landlord exists
        landlord = Landlord.query.get(landlord_id)
        if not landlord:
            return jsonify({"message": "Landlord not found"}), 404

        # Query apartments associated with this landlord
        apartments = Apartment.query.filter_by(landlord_id=landlord_id).all()

        # Convert to simplified dictionary format
        apartments_data = [
            {
                "id": apartment.id,
                "address": apartment.address,
                "rooms": apartment.rooms,
                "size": apartment.size,
                "status": apartment.status,
                "rent": float(apartment.rent) if apartment.rent else 0,
                "moveInDate": apartment.moveInDate.isoformat()
                if apartment.moveInDate
                else None,
                "contractEndDate": apartment.contractEndDate.isoformat()
                if apartment.contractEndDate
                else None,
            }
            for apartment in apartments
        ]

        return jsonify(apartments_data), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving landlord apartments: {e}")
        return jsonify(
            {"message": "Error retrieving landlord apartments", "error": str(e)}
        ), 500
