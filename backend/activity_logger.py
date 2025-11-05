# activity_logger.py - FIXED VERSION with proper IP tracking and readable messages
import logging
from datetime import datetime
from flask import g, request
import json
import traceback

logger = logging.getLogger('activity')

class ActivityLogger:
    """Logs user activities with proper user attribution and IP addresses"""

    @staticmethod
    def _get_real_ip():
        """
        Get the real IP address, handling proxies (nginx, Docker, etc.)
        Checks X-Forwarded-For and X-Real-IP headers first
        """
        # Check for proxy headers first
        if request.headers.get('X-Forwarded-For'):
            # X-Forwarded-For can be a comma-separated list, get the first one
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        else:
            # Fallback to remote_addr
            return request.remote_addr if hasattr(request, 'remote_addr') else 'unknown'

    @staticmethod
    def _get_user_info():
        """Extract user information from Flask's global context"""
        user = getattr(g, 'user', None)
        user_info = {
            'id': 'system',
            'username': 'system',
            'role': 'system'
        }

        if user:
            if isinstance(user, dict):
                user_info = {
                    'id': user.get('id') or user.get('sub', 'unknown'),
                    'username': user.get('username') or user.get('sub', 'unknown'),
                    'role': user.get('role', 'unknown')
                }
            else:
                user_info = {
                    'id': getattr(user, 'id', 'unknown'),
                    'username': getattr(user, 'username', 'unknown'),
                    'role': getattr(user, 'role', 'unknown')
                }

        return user_info

    @staticmethod
    def _format_message(action, entity_type, entity_id, details):
        """Create human-readable message from log components"""
        user_info = ActivityLogger._get_user_info()
        username = user_info['username']

        entity_names = {
            'apartment': 'Apartment',
            'tenant': 'Tenant',
            'user': 'User',
            'payment': 'Payment',
            'contract': 'Contract',
            'landlord': 'Landlord',
            'auth': 'Authentication'
        }

        entity_name = entity_names.get(entity_type, entity_type.title())

        # Build message based on action
        if action == 'create':
            message = f"{username} created {entity_name}"
            if entity_id:
                message += f" (ID: {entity_id})"

        elif action == 'update':
            message = f"{username} updated {entity_name}"
            if entity_id:
                message += f" (ID: {entity_id})"

        elif action == 'delete':
            message = f"{username} deleted {entity_name}"
            if entity_id:
                message += f" (ID: {entity_id})"

        elif action == 'login':
            if details and details.get('success', True):
                message = f"{username} logged in successfully"
            else:
                message = f"Failed login attempt for {username}"

        elif action == 'logout':
            message = f"{username} logged out"

        elif action == 'approve':
            message = f"{username} approved {entity_name}"
            if details and details.get('username'):
                message += f" '{details['username']}'"

        elif action == 'update_role':
            message = f"{username} changed {entity_name} role"
            if details:
                if details.get('username'):
                    message += f" for '{details['username']}'"
                if details.get('original_role') and details.get('new_role'):
                    message += f" from '{details['original_role']}' to '{details['new_role']}'"

        elif action == 'change_password':
            message = f"{username} changed password for {entity_name}"
            if details and details.get('username'):
                message += f" '{details['username']}'"

        elif action == 'view':
            message = f"{username} viewed {entity_name}"
            if entity_id:
                message += f" (ID: {entity_id})"

        elif action == 'export':
            message = f"{username} exported {entity_name} data"

        elif action == 'import':
            message = f"{username} imported {entity_name} data"

        else:
            message = f"{username} performed '{action}' on {entity_name}"
            if entity_id:
                message += f" (ID: {entity_id})"

        # Add important details
        if details:
            important_details = []

            if details.get('contract_number'):
                important_details.append(f"Contract: {details['contract_number']}")
            if details.get('apartment_address'):
                important_details.append(f"Address: {details['apartment_address']}")
            if details.get('tenant_name'):
                important_details.append(f"Tenant: {details['tenant_name']}")
            if details.get('amount'):
                important_details.append(f"Amount: {details['amount']}")
            if details.get('reason'):
                important_details.append(f"Reason: {details['reason']}")

            if important_details:
                message += " | " + " | ".join(important_details)

        return message

    @staticmethod
    def log_activity(action, entity_type, entity_id=None, details=None, status="success", error=None):
        """Log a user activity with user info and IP address"""
        try:
            user_info = ActivityLogger._get_user_info()
            ip_address = ActivityLogger._get_real_ip()
            formatted_message = ActivityLogger._format_message(action, entity_type, entity_id, details)

            log_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': action,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'user': user_info,
                'ip_address': ip_address,  # Now gets real IP behind proxies
                'status': status,
                'message': formatted_message,
                'details': details or {}
            }

            if error:
                log_entry['error'] = str(error)
                log_entry['stack_trace'] = traceback.format_exc()
                log_entry['message'] += f" | ERROR: {str(error)}"

            log_message = json.dumps(log_entry)

            if status == "success":
                logger.info(f"USER ACTIVITY: {log_message}")
            else:
                logger.error(f"USER ACTIVITY ERROR: {log_message}")

            return True
        except Exception as e:
            logger.error(f"Error in activity logger: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    @staticmethod
    def log_login(username, success=True, details=None):
        """Log login attempts"""
        action = "login"
        status = "success" if success else "failed"
        if details is None:
            details = {}
        details['success'] = success

        ActivityLogger.log_activity(
            action=action,
            entity_type="auth",
            entity_id=username,
            details=details,
            status=status
        )

    @staticmethod
    def log_logout(username, details=None):
        """Log user logout"""
        ActivityLogger.log_activity(
            action="logout",
            entity_type="auth",
            entity_id=username,
            details=details
        )

    @staticmethod
    def log_apartment_action(action, apartment_id, details=None, success=True, error=None):
        """Log apartment-related actions"""
        status = "success" if success else "failed"
        ActivityLogger.log_activity(
            action=action,
            entity_type="apartment",
            entity_id=apartment_id,
            details=details,
            status=status,
            error=error
        )

    @staticmethod
    def log_tenant_action(action, tenant_id, details=None, success=True, error=None):
        """Log tenant-related actions"""
        status = "success" if success else "failed"
        ActivityLogger.log_activity(
            action=action,
            entity_type="tenant",
            entity_id=tenant_id,
            details=details,
            status=status,
            error=error
        )

    @staticmethod
    def log_payment_action(action, payment_id, apartment_id=None, details=None, success=True, error=None):
        """Log payment-related actions"""
        status = "success" if success else "failed"
        if details is None:
            details = {}
        details['apartment_id'] = apartment_id

        ActivityLogger.log_activity(
            action=action,
            entity_type="payment",
            entity_id=payment_id,
            details=details,
            status=status,
            error=error
        )

    @staticmethod
    def log_contract_action(action, contract_id=None, apartment_id=None, details=None, success=True, error=None):
        """Log contract-related actions"""
        status = "success" if success else "failed"
        if details is None:
            details = {}
        details['apartment_id'] = apartment_id

        ActivityLogger.log_activity(
            action=action,
            entity_type="contract",
            entity_id=contract_id,
            details=details,
            status=status,
            error=error
        )

    @staticmethod
    def log_landlord_action(action, landlord_id, details=None, success=True, error=None):
        """Log landlord-related actions"""
        status = "success" if success else "failed"
        ActivityLogger.log_activity(
            action=action,
            entity_type="landlord",
            entity_id=landlord_id,
            details=details,
            status=status,
            error=error
        )

    @staticmethod
    def log_user_action(action, user_id, details=None, success=True, error=None):
        """Log user management actions"""
        status = "success" if success else "failed"
        ActivityLogger.log_activity(
            action=action,
            entity_type="user",
            entity_id=user_id,
            details=details,
            status=status,
            error=error
        )


def configure_activity_logger(app):
    """Kept for backward compatibility"""
    app.logger.info("Activity logger will use root logger configuration")
