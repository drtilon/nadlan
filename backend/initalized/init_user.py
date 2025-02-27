from models.models import User
from extentions import db
from flask import current_app


def ensure_admin_user_exists():
    admin_username = "admin"
    admin_password = "admin123"  # Change this in production!

    existing_admin = User.query.filter_by(username=admin_username).first()
    if not existing_admin:
        admin_user = User(username=admin_username, role="admin", is_approved=True)
        admin_user.set_password(admin_password)
        db.session.add(admin_user)
        db.session.commit()
        current_app.logger.info(f"Admin user '{admin_username}' created.")
    else:
        current_app.logger.info(f"Admin user '{admin_username}' already exists.")
