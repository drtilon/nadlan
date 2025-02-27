from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User
from extensions import db

admin_bp = Blueprint("admin_bp", __name__)


@admin_bp.route("/approve_user", methods=["POST"])
@jwt_required()
def approve_user():
    current_user = get_jwt_identity()

    # Ensure the current user is an admin
    admin_user = User.query.filter_by(username=current_user).first()
    if not admin_user or admin_user.role != "admin":
        return jsonify({"message": "Forbidden: Admin access required"}), 403

    data = request.json
    username = data.get("username")

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    user.approved = True  # Approve the user
    db.session.commit()

    return jsonify({"message": f"User {username} has been approved."}), 200
