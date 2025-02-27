from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from auth import role_required

protected_bp = Blueprint("protected_bp", __name__)


@protected_bp.route("/", methods=["GET"])
@jwt_required()
def dashboard():
    current_user = get_jwt_identity()
    claims = get_jwt()

    return jsonify(
        {
            "message": f"Welcome {current_user}",
            "role": claims["role"],
        }
    ), 200


@protected_bp.route("/admin", methods=["GET"])
@jwt_required()
@role_required("admin")  # Only users with 'admin' role can access
def admin_dashboard():
    return jsonify({"message": "Welcome, Admin!"}), 200
