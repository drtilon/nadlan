# routes/logs.py - Fixed version with timestamp sorting issue resolved
import os
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, Response
from .auth import token_required, role_required
import re
from typing import List, Dict, Any, Union
import logging
import math
from utils.logging_helpers import log_with_user

logs_bp = Blueprint("logs_bp", __name__)

# Configure a file handler for our app
LOG_DIRECTORY = os.environ.get("LOG_DIRECTORY", "logs")
APP_LOG_FILE = os.path.join(LOG_DIRECTORY, "app.log")
ACTIVITY_LOG_FILE = os.path.join(LOG_DIRECTORY, "activity.log")

# Create logs directory if it doesn't exist
if not os.path.exists(LOG_DIRECTORY):
    os.makedirs(LOG_DIRECTORY)

# In-memory circular buffer for recent logs (limit to 1000 entries)
recent_logs = []
MAX_RECENT_LOGS = 1000

def add_to_recent_logs(log_entry):
    """Add a log entry to the in-memory circular buffer"""
    global recent_logs
    recent_logs.append(log_entry)
    if len(recent_logs) > MAX_RECENT_LOGS:
        recent_logs.pop(0)  # Remove oldest log

def safe_get_timestamp(log_entry):
    """
    Safely extract timestamp from log entry for sorting.
    Always returns a tuple (datetime, original_value) to ensure consistent sorting.
    """
    if not isinstance(log_entry, dict):
        return (datetime.min, None)

    timestamp = log_entry.get("timestamp", "")

    # Return early for empty/None timestamps
    if not timestamp:
        return (datetime.min, None)

    try:
        # If it's already a datetime object
        if isinstance(timestamp, datetime):
            return (timestamp, timestamp)

        # If it's a Unix timestamp (integer or float)
        elif isinstance(timestamp, (int, float)):
            # Handle timestamps that might be in milliseconds
            if timestamp > 1e10:  # Likely milliseconds
                timestamp = timestamp / 1000
            dt = datetime.fromtimestamp(timestamp)
            return (dt, timestamp)

        # If it's a string
        elif isinstance(timestamp, str):
            timestamp = timestamp.strip()

            # Handle empty strings
            if not timestamp:
                return (datetime.min, timestamp)

            # Try to parse as a number first (Unix timestamp as string)
            try:
                ts_num = float(timestamp)
                if ts_num > 1e10:  # Likely milliseconds
                    ts_num = ts_num / 1000
                dt = datetime.fromtimestamp(ts_num)
                return (dt, timestamp)
            except (ValueError, OSError):
                pass

            # Handle various string timestamp formats
            if 'T' in timestamp:
                # ISO format with T separator
                try:
                    if timestamp.endswith('Z'):
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    else:
                        dt = datetime.fromisoformat(timestamp)
                    return (dt, timestamp)
                except ValueError:
                    pass
            elif ' ' in timestamp and ',' in timestamp:
                # Format like "2025-08-31 10:49:14,123"
                try:
                    dt = datetime.strptime(timestamp.split(',')[0], "%Y-%m-%d %H:%M:%S")
                    return (dt, timestamp)
                except ValueError:
                    pass
            elif ' ' in timestamp:
                # Format like "2025-08-31 10:49:14"
                try:
                    dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
                    return (dt, timestamp)
                except ValueError:
                    pass
            elif '-' in timestamp and ':' in timestamp:
                # Try parsing as ISO format without T
                try:
                    dt = datetime.fromisoformat(timestamp)
                    return (dt, timestamp)
                except ValueError:
                    pass

            # If all parsing attempts fail, return min date
            current_app.logger.warning(f"Could not parse timestamp string: '{timestamp}'")
            return (datetime.min, timestamp)

        else:
            current_app.logger.warning(f"Unknown timestamp type: {type(timestamp)} - {timestamp}")
            return (datetime.min, timestamp)

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Unexpected error parsing timestamp '{timestamp}' (type: {type(timestamp)}): {e}")
        return (datetime.min, timestamp)

@logs_bp.route("/logs", methods=["GET"])
@token_required
@role_required("admin")  # Only admins can view logs
def get_logs():
    """
    Retrieves application logs with pagination support.
    Supports filtering by level, time range, log type, and search.
    """
    try:
        # Query parameters
        page = request.args.get("page", 0, type=int)
        limit = request.args.get("limit", 25, type=int)
        level = request.args.get("level", "").lower()
        hours = request.args.get("hours")
        log_type = request.args.get("type", "all")  # 'app', 'activity', or 'all'
        entity_type = request.args.get("entity_type")
        user_id = request.args.get("user_id")
        action = request.args.get("action")
        search = request.args.get("search", "")

        # Validate and limit pagination parameters
        page = max(0, page)
        limit = min(max(1, limit), 1000)  # Limit between 1 and 1000
        offset = page * limit

        # Collect all logs first
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
        filtered_logs = apply_filters(
            logs_data, level, entity_type, user_id, action, search, hours
        )

        # Sort logs by timestamp (newest first) - using safe timestamp extraction
        try:
            # Use a custom sort key that extracts just the datetime part
            filtered_logs.sort(key=lambda log: safe_get_timestamp(log)[0], reverse=True)
        except Exception as e:
            log_with_user(current_app.logger, 'error', f"Error sorting logs: {e}")
            # If sorting still fails, try a more defensive approach
            try:
                # Sort only logs that have valid timestamps
                valid_logs = []
                invalid_logs = []

                for log in filtered_logs:
                    dt, _ = safe_get_timestamp(log)
                    if dt != datetime.min:
                        valid_logs.append((dt, log))
                    else:
                        invalid_logs.append(log)

                # Sort valid logs and combine with invalid ones at the end
                valid_logs.sort(key=lambda x: x[0], reverse=True)
                filtered_logs = [log for _, log in valid_logs] + invalid_logs

            except Exception as e2:
                log_with_user(current_app.logger, 'error', f"Fallback sorting also failed: {e2}")
                # If even fallback fails, just return unsorted logs
                pass

        # Calculate pagination
        total_count = len(filtered_logs)
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 0

        # Apply pagination
        paginated_logs = filtered_logs[offset:offset + limit]

        # Collect metadata for filters
        metadata = collect_metadata(logs_data if log_type == 'all' else
                                  [log for log in logs_data if log.get('log_type') == log_type])

        response_data = {
            "logs": paginated_logs,
            "total": total_count,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "hasNext": page < total_pages - 1,
            "hasPrev": page > 0,
            "metadata": metadata
        }

        return jsonify(response_data), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error retrieving logs: {e}")
        return jsonify({"message": "Error retrieving logs", "error": str(e)}), 500

def apply_filters(logs_data, level, entity_type, user_id, action, search, hours):
    """Apply all filters to the logs data"""
    filtered_logs = logs_data

    # Level filter
    if level and level != 'all':
        filtered_logs = [
            log for log in filtered_logs
            if log.get("level", "").lower() == level
        ]

    # Entity type filter
    if entity_type and entity_type != 'all':
        filtered_logs = [
            log for log in filtered_logs
            if log.get("entity_type", "").lower() == entity_type.lower()
        ]

    # User ID filter
    if user_id and user_id != 'all':
        filtered_logs = [
            log for log in filtered_logs
            if (log.get("user", {}) and str(log["user"].get("id", "")) == str(user_id))
        ]

    # Action filter
    if action and action != 'all':
        filtered_logs = [
            log for log in filtered_logs
            if log.get("action", "").lower() == action.lower()
        ]

    # Search filter
    if search:
        filtered_logs = apply_search_filter(filtered_logs, search)

    # Time range filter
    if hours:
        try:
            hours_ago = datetime.now() - timedelta(hours=int(hours))
            filtered_logs = [
                log for log in filtered_logs
                if "timestamp" in log
                and safe_get_timestamp(log)[0] >= hours_ago
            ]
        except (ValueError, TypeError):
            # If hours parameter is invalid, ignore it
            pass

    return filtered_logs

def apply_search_filter(logs_data, search_query):
    """Apply search filter to logs"""
    if not search_query:
        return logs_data

    search_lower = search_query.lower()
    results = []

    for log in logs_data:
        # Search in different log fields
        should_include = False

        # Basic text search in message
        if "message" in log and search_lower in (log.get("message") or "").lower():
            should_include = True

        # Search in logger/entity_type
        if "logger" in log and search_lower in (log.get("logger") or "").lower():
            should_include = True

        if "entity_type" in log and search_lower in (log.get("entity_type") or "").lower():
            should_include = True

        # Search in level
        if "level" in log and search_lower in (log.get("level") or "").lower():
            should_include = True

        # Search in action
        if "action" in log and search_lower in (log.get("action") or "").lower():
            should_include = True

        # Search in user info
        if "user" in log and log.get("user"):
            user = log.get("user", {})
            if (
                search_lower in str(user.get("id", "")).lower() or
                search_lower in (user.get("username") or "").lower() or
                search_lower in (user.get("role") or "").lower()
            ):
                should_include = True

        # Search in details object
        if "details" in log and log.get("details"):
            details_str = json.dumps(log.get("details", {}))
            if search_lower in details_str.lower():
                should_include = True

        if should_include:
            results.append(log)

    return results

def collect_metadata(logs_data):
    """Collect metadata about available filter options"""
    entity_types = set()
    action_types = set()

    for log in logs_data:
        if log.get("entity_type"):
            entity_types.add(log["entity_type"])
        if log.get("action"):
            action_types.add(log["action"])

    return {
        "entityTypes": sorted(list(entity_types)),
        "actionTypes": sorted(list(action_types))
    }

@logs_bp.route("/logs", methods=["DELETE"])
@token_required
@role_required("admin")
def clear_logs():
    """Clears all application logs."""
    try:
        log_type = request.args.get("type", "all")

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
        log_with_user(current_app.logger, 'error', f"Error clearing logs: {e}")
        return jsonify({"message": "Error clearing logs", "error": str(e)}), 500

@logs_bp.route("/logs/search", methods=["GET"])
@token_required
@role_required("admin")
def search_logs():
    """
    Search logs with pagination support.
    """
    try:
        query = request.args.get("q", "")
        log_type = request.args.get("type", "all")
        page = request.args.get("page", 0, type=int)
        limit = request.args.get("limit", 25, type=int)

        if not query:
            return jsonify({"logs": [], "total": 0, "page": page, "limit": limit}), 200

        # Validate pagination
        page = max(0, page)
        limit = min(max(1, limit), 1000)
        offset = page * limit

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
        results = apply_search_filter(logs_data, query)

        # Sort by timestamp (newest first) - using safe timestamp extraction
        try:
            # Use a custom sort key that extracts just the datetime part
            results.sort(key=lambda log: safe_get_timestamp(log)[0], reverse=True)
        except Exception as e:
            log_with_user(current_app.logger, 'error', f"Error sorting search results: {e}")
            # If sorting still fails, try a more defensive approach
            try:
                # Sort only logs that have valid timestamps
                valid_logs = []
                invalid_logs = []

                for log in results:
                    dt, _ = safe_get_timestamp(log)
                    if dt != datetime.min:
                        valid_logs.append((dt, log))
                    else:
                        invalid_logs.append(log)

                # Sort valid logs and combine with invalid ones at the end
                valid_logs.sort(key=lambda x: x[0], reverse=True)
                results = [log for _, log in valid_logs] + invalid_logs

            except Exception as e2:
                log_with_user(current_app.logger, 'error', f"Fallback sorting also failed: {e2}")
                # If even fallback fails, just return unsorted results
                pass

        # Calculate pagination
        total_count = len(results)
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 0

        # Apply pagination
        paginated_results = results[offset:offset + limit]

        response_data = {
            "logs": paginated_results,
            "total": total_count,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "hasNext": page < total_pages - 1,
            "hasPrev": page > 0
        }

        return jsonify(response_data), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error searching logs: {e}")
        return jsonify({"message": "Error searching logs", "error": str(e)}), 500

@logs_bp.route("/logs/stats", methods=["GET"])
@token_required
@role_required("admin")
def get_log_stats():
    """
    Returns statistics about the logs.
    """
    try:
        # Get all logs for statistics (without pagination)
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
        log_with_user(current_app.logger, 'error', f"Error generating log statistics: {e}")
        return jsonify({"message": "Error generating log statistics", "error": str(e)}), 500

@logs_bp.route("/logs/entity/<entity_type>/<entity_id>", methods=["GET"])
@token_required
@role_required("admin")
def get_entity_logs(entity_type, entity_id):
    """
    Get all activity logs related to a specific entity with pagination.
    """
    try:
        # Pagination parameters
        page = request.args.get("page", 0, type=int)
        limit = request.args.get("limit", 25, type=int)

        # Validate pagination
        page = max(0, page)
        limit = min(max(1, limit), 1000)
        offset = page * limit

        # Get activity logs
        activity_logs = collect_activity_logs_from_file(ACTIVITY_LOG_FILE)

        # Filter logs for the specific entity
        entity_logs = [
            log for log in activity_logs
            if log.get("entity_type") == entity_type and str(log.get("entity_id")) == str(entity_id)
        ]

        # Sort by timestamp (newest first) - using safe timestamp extraction
        try:
            # Use a custom sort key that extracts just the datetime part
            entity_logs.sort(key=lambda log: safe_get_timestamp(log)[0], reverse=True)
        except Exception as e:
            log_with_user(current_app.logger, 'error', f"Error sorting entity logs: {e}")
            # If sorting still fails, try a more defensive approach
            try:
                # Sort only logs that have valid timestamps
                valid_logs = []
                invalid_logs = []

                for log in entity_logs:
                    dt, _ = safe_get_timestamp(log)
                    if dt != datetime.min:
                        valid_logs.append((dt, log))
                    else:
                        invalid_logs.append(log)

                # Sort valid logs and combine with invalid ones at the end
                valid_logs.sort(key=lambda x: x[0], reverse=True)
                entity_logs = [log for _, log in valid_logs] + invalid_logs

            except Exception as e2:
                log_with_user(current_app.logger, 'error', f"Fallback sorting also failed: {e2}")
                # If even fallback fails, just return unsorted logs
                pass

        # Calculate pagination
        total_count = len(entity_logs)
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 0

        # Apply pagination
        paginated_logs = entity_logs[offset:offset + limit]

        return jsonify({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "logs": paginated_logs,
            "total": total_count,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "hasNext": page < total_pages - 1,
            "hasPrev": page > 0
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error retrieving entity logs: {e}")
        return jsonify({"message": "Error retrieving entity logs", "error": str(e)}), 500

def is_noisy_log(log_entry: Dict[str, Any]) -> bool:
    """
    Check if a log entry is a noisy system/infrastructure log that should be filtered out.
    These include SQL errors during startup, werkzeug HTTP request logs, CORS config,
    startup messages, and other internal framework noise.
    """
    message = (log_entry.get("message") or "").lower()
    logger_name = (log_entry.get("logger") or "").lower()

    # Filter out werkzeug HTTP access logs
    if logger_name == "werkzeug":
        return True

    # Filter out SQL/database startup errors (CREATE TABLE, connection retries)
    sql_patterns = [
        "create table", "alter table", "drop table",
        "sqlalche.me", "operational error", "operationalerror",
        "mysql not ready", "retrying in", "auto_increment",
        "primary key", "varchar(", "integer not null",
        "background on this error", "[sql:", "(background on",
        "db.create_all()", "database connection successful",
        "running db.create_all",
    ]
    for pattern in sql_patterns:
        if pattern in message:
            return True

    # Filter out startup/initialization noise
    startup_patterns = [
        "logging configured successfully",
        "configuring cors with origins",
        "extensions initialized",
        "blueprints registered",
        "starting flask server",
        "database schema",
        "demo database initialization",
        "demo data already exists",
        "demo data exists",
        "ensuring database schema",
        "starting demo",
    ]
    for pattern in startup_patterns:
        if pattern in message:
            return True

    # Filter out internal request logs (the middleware logs every request)
    if message.startswith("[request]"):
        return True

    # Filter out very short/empty messages
    if len(message.strip()) < 3:
        return True

    return False


def collect_logs_from_file(file_path) -> List[Dict[str, Any]]:
    """Parse and collect logs from the log file, filtering out noisy system logs."""
    logs_data = []
    try:
        if not os.path.exists(file_path):
            return []

        with open(file_path, "r") as f:
            log_lines = f.readlines()

        for i, line in enumerate(log_lines):
            try:
                # Check for new format with brackets
                if line.strip() and line.startswith('['):
                    log_entry = parse_log_line(line)
                    if log_entry:
                        log_entry["id"] = f"file_{i}"
                        # Filter out noisy system logs
                        if not is_noisy_log(log_entry):
                            logs_data.append(log_entry)
                elif logs_data and line.strip():
                    # Continuation line - check if previous entry was kept
                    if logs_data:
                        logs_data[-1]["message"] += "\n" + line.strip()
            except Exception as e:
                log_with_user(current_app.logger, 'error', f"Error parsing log line: {e}")
                continue

        return logs_data
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error collecting logs from file: {e}")
        return []



def parse_log_line(line: str) -> Dict[str, Any]:
    """Parse new log format: [YYYY-MM-DD HH:MM:SS] LEVEL in MODULE: MESSAGE"""
    try:
        # New format with brackets
        pattern = r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+) in ([^:]+): (.*)"
        match = re.match(pattern, line)

        if match:
            timestamp_str, level, logger, message = match.groups()
            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            return {
                "timestamp": timestamp.isoformat(),
                "level": level.strip(),
                "logger": logger.strip(),
                "message": message.strip(),
            }

        # Fallback
        return {
            "timestamp": datetime.now().isoformat(),
            "level": "INFO",
            "logger": "unknown",
            "message": line.strip(),
        }
    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error parsing log line: {e}")
        return None


def collect_activity_logs_from_file(file_path) -> List[Dict[str, Any]]:
    """Parse activity logs from file, deduplicating entries."""
    logs_data = []
    seen_timestamps = set()

    try:
        if not os.path.exists(file_path):
            return []

        with open(file_path, "r") as f:
            log_lines = f.readlines()

        for i, line in enumerate(log_lines):
            try:
                if line.strip() and "USER ACTIVITY" in line:
                    # Extract JSON part
                    json_start = line.find('USER ACTIVITY:')
                    if json_start == -1:
                        json_start = line.find('USER ACTIVITY ERROR:')

                    if json_start != -1:
                        # Find where JSON starts (after the marker)
                        marker_end = line.find(':', json_start) + 1
                        json_str = line[marker_end:].strip()

                        activity_data = json.loads(json_str)

                        # Deduplicate: use timestamp + action + entity_type + entity_id as key
                        dedup_key = (
                            activity_data.get("timestamp", ""),
                            activity_data.get("action", ""),
                            activity_data.get("entity_type", ""),
                            str(activity_data.get("entity_id", "")),
                            str(activity_data.get("user", {}).get("id", ""))
                        )

                        if dedup_key in seen_timestamps:
                            continue
                        seen_timestamps.add(dedup_key)

                        activity_data["id"] = f"activity_{i}"

                        if "level" not in activity_data:
                            activity_data["level"] = "ERROR" if "ERROR" in line else "INFO"

                        logs_data.append(activity_data)

            except Exception as e:
                log_with_user(current_app.logger, 'error', f"Error parsing activity log: {e}")
                continue

        return logs_data

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error collecting activity logs: {e}")
        return []



