from flask import g, request


def get_user_context():
    """Get user context string from g.user and request info."""
    user = getattr(g, 'user', None)
    if user:
        username = user.get('sub', 'unknown')
        role = user.get('role', 'unknown')
        user_str = f"user={username}(role:{role})"
    else:
        user_str = "user=anonymous"

    ip = request.headers.get('X-Forwarded-For',
         request.headers.get('X-Real-IP', request.remote_addr))
    if ip:
        # X-Forwarded-For can contain multiple IPs, take the first
        ip = ip.split(',')[0].strip()

    return f"[{user_str} ip={ip}]"


def log_with_user(logger, level, message):
    """Log a message with user context automatically prepended.

    Args:
        logger: A logger instance (e.g. current_app.logger)
        level: Log level string - 'debug', 'info', 'warning', 'error', 'critical'
        message: The log message
    """
    ctx = get_user_context()
    log_fn = getattr(logger, level, logger.error)
    log_fn(f"{ctx} {message}")
