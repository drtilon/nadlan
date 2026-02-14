# backend/routes/health.py
from flask import Blueprint, jsonify
from extentions import db
from sqlalchemy import text
import time
from datetime import datetime, timezone

health_bp = Blueprint("health", __name__)


@health_bp.route("/health")
def health_check():
    """Simple health check endpoint for Docker health checks"""
    return jsonify(
        {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat(), "service": "flask_backend"}
    ), 200


@health_bp.route("/auth/health")
def auth_health_check():
    """Health check endpoint for auth service with database check"""
    try:
        # Test database connection
        db.session.execute(text("SELECT 1"))
        return jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "auth",
                "database": "connected",
            }
        ), 200
    except Exception as e:
        return jsonify(
            {
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "auth",
                "database": "disconnected",
                "error": str(e),
            }
        ), 500


@health_bp.route("/ping")
def ping():
    """Simple ping endpoint"""
    return jsonify({"message": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}), 200
