from ..auth import token_required, role_required
from extentions import db
from models.models import User
from flask import Blueprint, request, jsonify, current_app, g
from activity_logger import ActivityLogger

adminPanel_bp = Blueprint("adminPanel_bp", __name__)


@adminPanel_bp.route("/approve_user/<int:user_id>", methods=["PUT"])
@token_required
@role_required("admin")
def approve_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    # Track original status for logging
    original_status = user.is_approved
    
    # Update status
    user.is_approved = True
    db.session.commit()
    
    # Log user approval
    ActivityLogger.log_user_action(
        action="approve",
        user_id=user_id,
        details={
            "username": user.username,
            "original_status": original_status,
            "new_status": True,
            "approved_by": g.user.get("sub", "unknown")
        }
    )
    
    return jsonify({"message": f"User '{user.username}' approved."}), 200


@adminPanel_bp.route("/pending-users", methods=["GET"])
@token_required
@role_required("admin")
def pending_users():
    pending = User.query.filter_by(is_approved=False).all()
    return jsonify([user.to_dict() for user in pending]), 200


# GET /auth/users - Return all users (admin only)
@adminPanel_bp.route("/users", methods=["GET"])
@token_required
@role_required("admin")
def get_all_users():
    try:
        users = User.query.all()
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching users: {e}")
        return jsonify({"message": "Error fetching users", "error": str(e)}), 500


# PUT /auth/users/<user_id> - Update a user's role (or other fields if needed)
@adminPanel_bp.route("/users/<int:user_id>", methods=["PUT"])
@token_required
@role_required("admin")
def update_user(user_id):
    try:
        data = request.get_json()
        if not data or "role" not in data:
            return jsonify({"message": "No role provided"}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        # Track original role for logging
        original_role = user.role
        
        # Update role
        user.role = data["role"]
        db.session.commit()
        
        # Log role change
        ActivityLogger.log_user_action(
            action="update_role",
            user_id=user_id,
            details={
                "username": user.username,
                "original_role": original_role,
                "new_role": data["role"],
                "updated_by": g.user.get("sub", "unknown")
            }
        )
        
        return jsonify(
            {"message": "User updated successfully", "user": user.to_dict()}
        ), 200
    except Exception as e:
        current_app.logger.error(f"Error updating user: {e}")
        db.session.rollback()
        
        # Log failure
        ActivityLogger.log_user_action(
            action="update_role",
            user_id=user_id,
            details={
                "error": str(e),
                "attempted_role": data.get("role") if data else None
            },
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error updating user", "error": str(e)}), 500


# DELETE /auth/users/<user_id> - Delete a user
@adminPanel_bp.route("/users/<int:user_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        # Capture user data for logging
        user_data = {
            "id": user.id,
            "username": user.username,
            "role": user.role
        }
        
        db.session.delete(user)
        db.session.commit()
        
        # Log user deletion
        ActivityLogger.log_user_action(
            action="delete",
            user_id=user_id,
            details={
                "deleted_user": user_data,
                "deleted_by": g.user.get("sub", "unknown")
            }
        )
        
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        current_app.logger.error(f"Error deleting user: {e}")
        db.session.rollback()
        
        # Log failure
        ActivityLogger.log_user_action(
            action="delete",
            user_id=user_id,
            details={"error": str(e)},
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error deleting user", "error": str(e)}), 500


@adminPanel_bp.route("/users/<int:user_id>/change-password", methods=["PUT"])
@token_required
@role_required("admin")
def change_user_password(user_id):
    try:
        data = request.get_json()
        if not data or "password" not in data:
            return jsonify({"message": "No password provided"}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        # Set the new password
        user.set_password(data["password"])
        db.session.commit()

        current_app.logger.info(f"Password changed for user: {user.username}")
        
        # Log password change (don't include the actual password!)
        ActivityLogger.log_user_action(
            action="change_password",
            user_id=user_id,
            details={
                "username": user.username,
                "changed_by": g.user.get("sub", "unknown"),
                "admin_reset": True
            }
        )
        
        return jsonify({"message": "Password changed successfully"}), 200
    except Exception as e:
        current_app.logger.error(f"Error changing password: {e}")
        db.session.rollback()
        
        # Log failure
        ActivityLogger.log_user_action(
            action="change_password",
            user_id=user_id,
            details={
                "error": str(e),
                "admin_reset": True
            },
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error changing password", "error": str(e)}), 500
