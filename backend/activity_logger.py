# activity_logger.py
import logging
from datetime import datetime
from flask import g, request
import json
import traceback

# Configure logger
logger = logging.getLogger('activity')
logger.setLevel(logging.INFO)

class ActivityLogger:
    """
    A utility class for logging user activities throughout the application.
    Tracks user actions in a standardized format for auditing and monitoring.
    """
    
    @staticmethod
    def log_activity(action, entity_type, entity_id=None, details=None, status="success", error=None):
        """
        Log a user activity
        
        Args:
            action (str): The action performed (e.g., "create", "update", "delete")
            entity_type (str): The type of entity affected (e.g., "apartment", "tenant", "user")
            entity_id (int/str, optional): ID of the affected entity
            details (dict, optional): Additional details about the action
            status (str): Outcome of the action - "success" or "failed"
            error (Exception, optional): Exception if the action failed
        """
        try:
            # Get user information from Flask global context
            user = getattr(g, 'user', None)
            user_info = None
            
            if user:
                # Handle different user object structures
                if isinstance(user, dict):
                    user_info = {
                        'id': user.get('id', user.get('sub', 'unknown')),
                        'username': user.get('sub', user.get('username', 'unknown')),
                        'role': user.get('role', 'unknown')
                    }
                else:
                    # Assuming it's a User model instance
                    user_info = {
                        'id': getattr(user, 'id', 'unknown'),
                        'username': getattr(user, 'username', 'unknown'),
                        'role': getattr(user, 'role', 'unknown')
                    }
            
            # Build the log entry
            log_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': action,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'user': user_info,
                'ip_address': request.remote_addr if hasattr(request, 'remote_addr') else None,
                'status': status,
                'details': details or {}
            }
            
            # Add error information if provided
            if error:
                log_entry['error'] = str(error)
                log_entry['stack_trace'] = traceback.format_exc()
            
            # Convert to string for logging
            log_message = json.dumps(log_entry)
            
            # Log at appropriate level
            if status == "success":
                logger.info(f"USER ACTIVITY: {log_message}")
            else:
                logger.error(f"USER ACTIVITY ERROR: {log_message}")
                
            return True
        except Exception as e:
            # Don't let logging errors affect application flow
            logger.error(f"Error in activity logger: {str(e)}")
            return False
    
    @staticmethod
    def log_login(username, success=True, details=None):
        """Log login attempts"""
        action = "login"
        status = "success" if success else "failed"
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
        ActivityLogger.log_activity(
            action=action,
            entity_type="payment",
            entity_id=payment_id,
            details={
                'apartment_id': apartment_id,
                **(details or {})
            },
            status=status,
            error=error
        )
    
    @staticmethod
    def log_contract_action(action, contract_id=None, apartment_id=None, details=None, success=True, error=None):
        """Log contract-related actions"""
        status = "success" if success else "failed"
        ActivityLogger.log_activity(
            action=action,
            entity_type="contract",
            entity_id=contract_id,
            details={
                'apartment_id': apartment_id,
                **(details or {})
            },
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

# Configure file handler
def configure_activity_logger(app):
    """
    Configure the activity logger with a file handler
    
    Args:
        app: Flask application instance
    """
    try:
        # Get log directory from app config
        log_dir = app.config.get('LOG_DIRECTORY', 'logs')
        
        # Create a file handler for activity logs
        import os
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        file_handler = logging.FileHandler(os.path.join(log_dir, 'activity.log'))
        file_handler.setLevel(logging.INFO)
        
        # Create formatter
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s')
        file_handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(file_handler)
        
        app.logger.info("Activity logger configured successfully")
        
    except Exception as e:
        app.logger.error(f"Error configuring activity logger: {e}")
