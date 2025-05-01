# routes/logs.py
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
APP_LOG_FILE = os.path.join(LOG_DIRECTORY, "app.log")
ACTIVITY_LOG_FILE = os.path.join(LOG_DIRECTORY, "activity.log")

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
    Supports optional filtering by level, time range and log type.
    """
    try:
        # Query parameters
        level = request.args.get("level", "").lower()
        hours = request.args.get("hours")
        log_type = request.args.get("type", "all")  # 'app', 'activity', or 'all'
        entity_type = request.args.get("entity_type")  # For filtering activity logs
        user_id = request.args.get("user_id")  # For filtering by user
        action = request.args.get("action")  # For filtering by action type

        # Collect logs from appropriate files based on type
        logs_data = []
        if log_type in ['all', 'app']:
            app_logs = collect_logs_from_file(APP_LOG_FILE)
            for log in app_logs:
                log['log_type'] = 'app'
                logs_data.append(log)

        if log_type in ['all', 'activity']:
            activity_logs = collect_activity_logs_from_file(ACTIVITY_LOG_FILE)
            for log in activity_logs:
                log['log_type'] = 'activity'
                logs_data.append(log)

        # Add in-memory logs that might not be in the file yet
        for memory_log in recent_logs:
            if not any(
                file_log.get("id") == memory_log.get("id") for file_log in logs_data
            ):
                logs_data.append(memory_log)

        # Apply filters
        if level and level != 'all':
            logs_data = [
                log for log in logs_data if log.get("level", "").lower() == level
            ]

        if entity_type and entity_type != 'all':
            logs_data = [
                log for log in logs_data 
                if log.get("entity_type", "").lower() == entity_type.lower()
            ]
            
        if user_id and user_id != 'all':
            logs_data = [
                log for log in logs_data 
                if (log.get("user", {}) and str(log["user"].get("id", "")) == str(user_id))
            ]
            
        if action and action != 'all':
            logs_data = [
                log for log in logs_data 
                if log.get("action", "").lower() == action.lower()
            ]

        if hours:
            try:
                hours_ago = datetime.now() - timedelta(hours=int(hours))
                logs_data = [
                    log
                    for log in logs_data
                    if "timestamp" in log
                    and datetime.fromisoformat(log["timestamp"].replace('Z', '+00:00')) >= hours_ago
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
        log_type = request.args.get("type", "all")  # 'app', 'activity', or 'all'
        
        # Clear the appropriate log files
        if log_type in ['all', 'app']:
            with open(APP_LOG_FILE, "w") as f:
                f.write("")
                
        if log_type in ['all', 'activity']:
            with open(ACTIVITY_LOG_FILE, "w") as f:
                f.write("")

        # Also clear in-memory logs
        global recent_logs
        recent_logs = []

        return jsonify({"message": f"{log_type.capitalize()} logs cleared successfully"}), 200

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
        log_type = request.args.get("type", "all")
        
        if not query:
            return jsonify({"message": "No search query provided"}), 400

        # Collect appropriate logs
        logs_data = []
        
        if log_type in ['all', 'app']:
            app_logs = collect_logs_from_file(APP_LOG_FILE)
            for log in app_logs:
                log['log_type'] = 'app'
                logs_data.append(log)
                
        if log_type in ['all', 'activity']:
            activity_logs = collect_activity_logs_from_file(ACTIVITY_LOG_FILE)
            for log in activity_logs:
                log['log_type'] = 'activity'
                logs_data.append(log)

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
            should_include = False
            
            # Basic text search in message
            if "message" in log and query.lower() in (log.get("message") or "").lower():
                should_include = True
                
            # Search in logger/entity_type  
            if "logger" in log and query.lower() in (log.get("logger") or "").lower():
                should_include = True
                
            if "entity_type" in log and query.lower() in (log.get("entity_type") or "").lower():
                should_include = True
                
            # Search in level
            if "level" in log and query.lower() in (log.get("level") or "").lower():
                should_include = True
            
            # Search in action
            if "action" in log and query.lower() in (log.get("action") or "").lower():
                should_include = True
                
            # Search in user info
            if "user" in log and log.get("user"):
                user = log.get("user", {})
                if (
                    query.lower() in str(user.get("id", "")).lower() or
                    query.lower() in (user.get("username") or "").lower() or
                    query.lower() in (user.get("role") or "").lower()
                ):
                    should_include = True
                    
            # Search in details object (if string search is possible)
            if "details" in log and log.get("details"):
                details_str = json.dumps(log.get("details", {}))
                if query.lower() in details_str.lower():
                    should_include = True
                    
            if should_include:
                results.append(log)

        # Sort results by timestamp (newest first)
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        return jsonify({"logs": results, "count": len(results)}), 200

    except Exception as e:
        current_app.logger.error(f"Error searching logs: {e}")
        return jsonify({"message": "Error searching logs", "error": str(e)}), 500


@logs_bp.route("/logs/stats", methods=["GET"])
@token_required
@role_required("admin")
def get_log_stats():
    """
    Returns statistics about the logs:
    - Total count by log type
    - Distribution by level/action
    - User activity summary
    - Entity type distribution
    """
    try:
        # Get all logs
        app_logs = collect_logs_from_file(APP_LOG_FILE)
        activity_logs = collect_activity_logs_from_file(ACTIVITY_LOG_FILE)
        
        # Count by log type
        total_app_logs = len(app_logs)
        total_activity_logs = len(activity_logs)
        
        # Initialize stats containers
        level_distribution = {}
        action_distribution = {}
        user_activity = {}
        entity_distribution = {}
        
        # Process app logs
        for log in app_logs:
            level = log.get("level", "unknown").lower()
            level_distribution[level] = level_distribution.get(level, 0) + 1
        
        # Process activity logs
        for log in activity_logs:
            # Action stats
            action = log.get("action", "unknown")
            action_distribution[action] = action_distribution.get(action, 0) + 1
            
            # Entity stats
            entity = log.get("entity_type", "unknown")
            entity_distribution[entity] = entity_distribution.get(entity, 0) + 1
            
            # User stats
            user = log.get("user", {})
            user_id = user.get("id") if user else "unknown"
            username = user.get("username") if user else "unknown"
            
            if user_id not in user_activity:
                user_activity[user_id] = {
                    "user_id": user_id,
                    "username": username,
                    "role": user.get("role") if user else "unknown",
                    "actions": {},
                    "total_actions": 0
                }
            
            user_activity[user_id]["actions"][action] = user_activity[user_id]["actions"].get(action, 0) + 1
            user_activity[user_id]["total_actions"] += 1
            
        # Sort user activity by most active
        sorted_users = sorted(
            list(user_activity.values()),
            key=lambda x: x["total_actions"],
            reverse=True
        )
        
        return jsonify({
            "total_logs": {
                "app": total_app_logs,
                "activity": total_activity_logs,
                "total": total_app_logs + total_activity_logs
            },
            "level_distribution": level_distribution,
            "action_distribution": action_distribution,
            "entity_distribution": entity_distribution,
            "user_activity": sorted_users[:10]  # Top 10 most active users
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error generating log statistics: {e}")
        return jsonify({"message": "Error generating log statistics", "error": str(e)}), 500


@logs_bp.route("/logs/entity/<entity_type>/<entity_id>", methods=["GET"])
@token_required
@role_required("admin")
def get_entity_logs(entity_type, entity_id):
    """
    Get all activity logs related to a specific entity (apartment, tenant, etc.)
    """
    try:
        # Get activity logs
        activity_logs = collect_activity_logs_from_file(ACTIVITY_LOG_FILE)
        
        # Filter logs for the specific entity
        entity_logs = [
            log for log in activity_logs
            if log.get("entity_type") == entity_type and str(log.get("entity_id")) == str(entity_id)
        ]
        
        # Sort by timestamp (newest first)
        entity_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return jsonify({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "logs": entity_logs,
            "count": len(entity_logs)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error retrieving entity logs: {e}")
        return jsonify({"message": "Error retrieving entity logs", "error": str(e)}), 500


def collect_logs_from_file(file_path) -> List[Dict[str, Any]]:
    """
    Parse and collect logs from the log file.
    Returns a list of log entry dictionaries.
    """
    logs_data = []

    try:
        if not os.path.exists(file_path):
            return []

        with open(file_path, "r") as f:
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


def collect_activity_logs_from_file(file_path) -> List[Dict[str, Any]]:
    """
    Parse and collect activity logs from the activity log file.
    These have a different format than regular application logs.
    """
    logs_data = []

    try:
        if not os.path.exists(file_path):
            return []

        with open(file_path, "r") as f:
            log_lines = f.readlines()

        # Parse each line
        for i, line in enumerate(log_lines):
            try:
                # Handle multiline log entries
                if line.strip() and re.match(
                    r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}", line
                ):
                    # Check if this is an activity log
                    if "USER ACTIVITY" in line:
                        # Extract the JSON part of the activity log
                        json_start = line.find('USER ACTIVITY:') + 14
                        if json_start < 14:  # Not found
                            json_start = line.find('USER ACTIVITY ERROR:') + 20
                            
                        if json_start > 0:  # Found the marker
                            json_str = line[json_start:].strip()
                            activity_data = json.loads(json_str)
                            
                            # Add log identifier
                            activity_data["id"] = f"activity_{i}"
                            
                            # Add standard log fields for compatibility
                            if "level" not in activity_data:
                                activity_data["level"] = "ERROR" if "ERROR" in line else "INFO"
                                
                            logs_data.append(activity_data)
                    else:
                        # Regular log entry, skip or process differently if needed
                        pass
                        
                elif logs_data and line.strip():
                    # This could be a continuation of a previous log
                    # For activity logs, we generally don't expect multiline entries
                    # But we could handle them if needed
                    pass
                    
            except Exception as e:
                # Skip lines that can't be parsed
                current_app.logger.error(f"Error parsing activity log line: {e}")
                continue

        return logs_data

    except Exception as e:
        current_app.logger.error(f"Error collecting activity logs from file: {e}")
        return []
