# routes/logs.py
# Add this route to your backend logs.py file
import os
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, Response
from .auth import token_required, role_required
import re
from typing import List, Dict, Any, Union
import logging

logs_bp = Blueprint("logs_bp", __name__)

# Configure a file handler for our app
LOG_DIRECTORY = os.environ.get("LOG_DIRECTORY", "logs")
LOG_FILE = os.path.join(LOG_DIRECTORY, "app.log")

# Create logs directory if it doesn't exist
if not os.path.exists(LOG_DIRECTORY):
    os.makedirs(LOG_DIRECTORY)

# In-memory circular buffer for recent logs (limit to 1000 entries)
# This can be useful for viewing logs even if the file is cleared
recent_logs = []
MAX_RECENT_LOGS = 1000


def add_to_recent_logs(log_entry):
    """Add a log entry to the in-memory circular buffer"""
    global recent_logs
    recent_logs.append(log_entry)
    if len(recent_logs) > MAX_RECENT_LOGS:
        recent_logs.pop(0)  # Remove oldest log


@logs_bp.route("/logs", methods=["GET"])
@token_required
@role_required("admin")  # Only admins can view logs
def get_logs():
    """
    Retrieves application logs from both file and memory.
    Supports optional filtering by level and time range.
    """
    try:
        # Query parameters
        level = request.args.get("level", "").lower()
        hours = request.args.get("hours")

        # Collect logs from file and memory
        logs_data = collect_logs_from_file()

        # Add in-memory logs that might not be in the file yet
        for memory_log in recent_logs:
            if not any(
                file_log.get("id") == memory_log.get("id") for file_log in logs_data
            ):
                logs_data.append(memory_log)

        # Apply filters
        if level:
            logs_data = [
                log for log in logs_data if log.get("level", "").lower() == level
            ]

        if hours:
            try:
                hours_ago = datetime.now() - timedelta(hours=int(hours))
                logs_data = [
                    log
                    for log in logs_data
                    if "timestamp" in log
                    and datetime.fromisoformat(log["timestamp"]) >= hours_ago
                ]
            except (ValueError, TypeError):
                # If hours parameter is invalid, ignore it
                pass

        # Sort logs by timestamp (newest first)
        logs_data.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        return jsonify({"logs": logs_data}), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving logs: {e}")
        return jsonify({"message": "Error retrieving logs", "error": str(e)}), 500


@logs_bp.route("/logs", methods=["DELETE"])
@token_required
@role_required("admin")  # Only admins can clear logs
def clear_logs():
    """Clears all application logs."""
    try:
        # Clear the log file by truncating it
        with open(LOG_FILE, "w") as f:
            f.write("")

        # Also clear in-memory logs
        global recent_logs
        recent_logs = []

        return jsonify({"message": "Logs cleared successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error clearing logs: {e}")
        return jsonify({"message": "Error clearing logs", "error": str(e)}), 500


@logs_bp.route("/logs/search", methods=["GET"])
@token_required
@role_required("admin")
def search_logs():
    """
    Searches logs for specific patterns or keywords.
    """
    try:
        query = request.args.get("q", "")
        if not query:
            return jsonify({"message": "No search query provided"}), 400

        # Collect all logs
        logs_data = collect_logs_from_file()

        # Add in-memory logs
        for memory_log in recent_logs:
            if not any(
                file_log.get("id") == memory_log.get("id") for file_log in logs_data
            ):
                logs_data.append(memory_log)

        # Perform search
        results = []
        for log in logs_data:
            # Search in different log fields
            if (
                query.lower() in (log.get("message") or "").lower()
                or query.lower() in (log.get("logger") or "").lower()
                or query.lower() in (log.get("level") or "").lower()
            ):
                results.append(log)

        # Sort results by timestamp (newest first)
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        return jsonify({"logs": results, "count": len(results)}), 200

    except Exception as e:
        current_app.logger.error(f"Error searching logs: {e}")
        return jsonify({"message": "Error searching logs", "error": str(e)}), 500


def collect_logs_from_file() -> List[Dict[str, Any]]:
    """
    Parse and collect logs from the log file.
    Returns a list of log entry dictionaries.
    """
    logs_data = []

    try:
        if not os.path.exists(LOG_FILE):
            return []

        with open(LOG_FILE, "r") as f:
            log_lines = f.readlines()

        # Parse each line (assuming a specific log format)
        for i, line in enumerate(log_lines):
            try:
                # Handle multiline log entries (like stack traces)
                if line.strip() and re.match(
                    r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}", line
                ):
                    # This is a new log entry starting with a timestamp
                    log_entry = parse_log_line(line)
                    if log_entry:
                        log_entry["id"] = f"file_{i}"
                        logs_data.append(log_entry)
                elif logs_data and line.strip():
                    # This is a continuation of the previous log entry (like a stack trace)
                    if "message" in logs_data[-1]:
                        logs_data[-1]["message"] += "\n" + line.strip()
                    else:
                        logs_data[-1]["message"] = line.strip()
            except Exception as e:
                # Skip lines that can't be parsed
                current_app.logger.error(f"Error parsing log line: {e}")
                continue

        return logs_data

    except Exception as e:
        current_app.logger.error(f"Error collecting logs from file: {e}")
        return []


def parse_log_line(line: str) -> Dict[str, Any]:
    """
    Parse a log line into a structured dictionary.
    Assumes a format like: "YYYY-MM-DD HH:MM:SS,mmm - LEVEL - MODULE - MESSAGE"
    """
    try:
        # Example regex for a common log format
        pattern = (
            r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - (\w+) - ([^-]+) - (.*)"
        )
        match = re.match(pattern, line)

        if match:
            timestamp_str, level, logger, message = match.groups()

            # Convert timestamp string to ISO format
            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S,%f")

            return {
                "timestamp": timestamp.isoformat(),
                "level": level.strip(),
                "logger": logger.strip(),
                "message": message.strip(),
            }
        else:
            # Fallback for lines that don't match the expected format
            return {
                "timestamp": datetime.now().isoformat(),
                "level": "INFO",
                "logger": "log_parser",
                "message": line.strip(),
            }

    except Exception as e:
        current_app.logger.error(f"Error parsing log line: {e}")
        return {
            "timestamp": datetime.now().isoformat(),
            "level": "ERROR",
            "logger": "log_parser",
            "message": f"Failed to parse log line: {line.strip()}. Error: {str(e)}",
        }


# Configure custom logger for application events
def configure_app_logger():
    """Configure the application logger with file and memory handlers"""
    logger = logging.getLogger("app")
    logger.setLevel(logging.DEBUG)

    # File handler
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setLevel(logging.DEBUG)

    # Create a formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
    )
    file_handler.setFormatter(formatter)

    # Add handlers to logger
    logger.addHandler(file_handler)

    # Custom handler for in-memory logs
    class MemoryHandler(logging.Handler):
        def emit(self, record):
            try:
                # Format the log entry
                log_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "level": record.levelname,
                    "logger": record.name,
                    "message": self.format(record),
                    "id": f"memory_{id(record)}",
                }

                # Add traceback info if available
                if record.exc_info:
                    import traceback

                    log_entry["stack_trace"] = "".join(
                        traceback.format_exception(*record.exc_info)
                    )

                # Add to memory buffer
                add_to_recent_logs(log_entry)
            except Exception:
                # Don't crash if logging fails
                pass

    memory_handler = MemoryHandler()
    memory_handler.setFormatter(formatter)
    logger.addHandler(memory_handler)

    return logger


# Initialize the logger
app_logger = configure_app_logger()

# Log a startup message
app_logger.info("Logs API initialized successfully")

