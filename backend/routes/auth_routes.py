# routes/auth_routes.py
import os
from flask import Blueprint, request, jsonify, current_app
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import timedelta
from models.models import User
from extentions import db
from .auth import token_required, role_required
from activity_logger import ActivityLogger

auth_bp = Blueprint("auth_bp", __name__)
bcrypt = Bcrypt()

# Rate limiter to prevent brute-force login attempts
limiter = Limiter(key_func=get_remote_address)


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")  # 5 login attempts per minute per IP
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        ActivityLogger.log_login(
            username=username or "unknown", 
            success=False, 
            details={"reason": "Missing username or password"}
        )
        return jsonify({"message": "Missing username or password"}), 400

    # Query the database for the user
    user = User.query.filter_by(username=username).first()
    if not user:
        ActivityLogger.log_login(
            username=username, 
            success=False, 
            details={"reason": "Invalid username"}
        )
        return jsonify({"message": "Invalid username or password"}), 401

    if not user.is_approved:
        ActivityLogger.log_login(
            username=username, 
            success=False, 
            details={"reason": "Account not approved", "user_id": user.id}
        )
        return jsonify({"message": "Your account is pending admin approval."}), 403

    # Verify password
    if user and bcrypt.check_password_hash(user.password, password):
        role = user.role  # Retrieve role from database

        # Get token expiration time from config (in hours)
        token_expiration_hours = current_app.config.get("TOKEN_EXPIRATION", 24)

        # Generate JWT tokens with the proper expiration time
        access_token = create_access_token(
            identity=username,
            additional_claims={"role": role, "id": user.id},
            expires_delta=timedelta(hours=token_expiration_hours),  # Use config value
        )
        refresh_token = create_refresh_token(identity=username)

        # Log successful login
        ActivityLogger.log_login(
            username=username, 
            success=True, 
            details={"user_id": user.id, "role": role, "ip": request.remote_addr}
        )

        return jsonify(
            {
                "message": "Login successful",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "username": username,
                    "role": role,
                    "id": user.id,
                    "is_approved": user.is_approved,
                },
            }
        ), 200

    # Log failed login attempt
    ActivityLogger.log_login(
        username=username, 
        success=False, 
        details={"reason": "Invalid password", "user_id": user.id if user else None}
    )
    return jsonify({"message": "Invalid username or password"}), 401


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "user")  # Default role is 'user'

    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    if User.query.filter_by(username=username).first():
        # Log registration attempt for existing user
        ActivityLogger.log_activity(
            action="register",
            entity_type="user",
            entity_id=username,
            details={"success": False, "reason": "User already exists"},
            status="failed"
        )
        return jsonify({"message": "User already exists"}), 409

    # For new users, is_approved is False by default (unless they're an admin)
    is_approved = True if role == "admin" else False

    new_user = User(username=username, role=role, is_approved=is_approved)
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    # Log successful registration
    ActivityLogger.log_activity(
        action="register",
        entity_type="user",
        entity_id=new_user.id,
        details={
            "username": username, 
            "role": role, 
            "is_approved": is_approved,
            "ip": request.remote_addr
        }
    )

    # Inform the user that their account is pending admin approval
    return jsonify(
        {"message": "User registered successfully. Awaiting admin approval."}
    ), 201


@auth_bp.route("/verify", methods=["GET"])
@token_required
def verify_token():
    """
    Simple endpoint to verify if the current token is valid.
    Token_required decorator will return 401 if token is invalid.
    """
    return jsonify({"message": "Token is valid", "status": "success"}), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Endpoint for client-side logout.
    Note: JWT can't be invalidated server-side without tracking, 
    but we can log the logout event.
    """
    current_user = get_jwt_identity()
    
    # Log logout event
    ActivityLogger.log_logout(username=current_user)
    
    return jsonify({"message": "Logged out successfully"}), 200
