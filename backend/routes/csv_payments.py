import os
import json
import sys
import logging
import re
from datetime import datetime, timedelta, date
from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.utils import secure_filename
from .auth import token_required, role_required
from models.models import (
    Tenant,
    Apartment,
    Payment,
    UnassignedPayment,
    ContractTenant,
    ContractPeriod,
    User,
)
from extentions import db
from activity_logger import ActivityLogger
from sqlalchemy import func, desc, case
from difflib import SequenceMatcher
import pandas as pd
from io import StringIO

# Set up basic logging
logger = logging.getLogger('CSV_PROCESSOR')
logger.setLevel(logging.INFO)

# Only add handler if it doesn't already exist
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter("%(asctime)s - CSV_PROCESSOR - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# Define blueprint
csv_payments_bp = Blueprint("csv_payments", __name__, url_prefix="/api/csv-payments")

ALLOWED_EXTENSIONS = {"csv", "txt"}


def log_csv_activity(action, details, success=True, error=None):
    """Log CSV payment activities using standard format"""
    ActivityLogger.log_activity(
        action=action,
        entity_type="csv_payment",
        entity_id=None,
        details=details,
        status="success" if success else "failed",
        error=error,
    )


def allowed_file(filename):
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def find_column_by_keywords(headers, keywords):
    """Find column index by matching keywords (case insensitive)"""
    headers_lower = [str(h).lower().strip() for h in headers]

    for keyword in keywords:
        keyword_lower = keyword.lower()
        for i, header in enumerate(headers_lower):
            if keyword_lower in header:
                return i
    return -1


def detect_delimiter(line):
    """Detect delimiter from a line"""
    semicolon_count = line.count(';')
    comma_count = line.count(',')
    tab_count = line.count('\t')
    pipe_count = line.count('|')

    counts = {
        ';': semicolon_count,
        ',': comma_count,
        '\t': tab_count,
        '|': pipe_count
    }

    delimiter = max(counts, key=counts.get)
    return delimiter if counts[delimiter] > 0 else ','


def find_header_row(lines):
    """Find the header row by looking for date/amount/name keywords"""
    date_keywords = ['datum', 'date', 'buchung', 'beleg', 'wert', 'tag']
    amount_keywords = ['betrag', 'amount', 'soll', 'haben']
    name_keywords = ['name', 'empfänger', 'auftraggeber', 'beschreibung', 'zahlungs', 'begünstig']

    for line_num, line in enumerate(lines[:15]):
        if not line.strip():
            continue

        line_lower = line.lower()

        # Check if line contains keywords from all three categories
        has_date = any(kw in line_lower for kw in date_keywords)
        has_amount = any(kw in line_lower for kw in amount_keywords)
        has_name = any(kw in line_lower for kw in name_keywords)

        if has_date and has_amount and has_name:
            return line_num

    return 0  # Default to first line if not found


def parse_date_from_string(date_str):
    """Enhanced date parsing for multiple formats"""
    if not date_str or pd.isna(date_str):
        return None

    date_str = str(date_str).strip()

    # Try ISO format first (YYYY-MM-DD or with time)
    if 'T' in date_str or (len(date_str) >= 10 and '-' in date_str and date_str[4] == '-'):
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
        except:
            pass

    # Try German formats: DD.MM.YYYY or DD.MM.YY
    date_patterns = [
        r'(\d{1,2})\.(\d{1,2})\.(\d{4})',  # DD.MM.YYYY
        r'(\d{1,2})\.(\d{1,2})\.(\d{2})',   # DD.MM.YY
        r'(\d{4})-(\d{1,2})-(\d{1,2})',     # YYYY-MM-DD
        r'(\d{1,2})/(\d{1,2})/(\d{4})',     # DD/MM/YYYY or MM/DD/YYYY
    ]

    for pattern in date_patterns:
        match = re.search(pattern, date_str)
        if match:
            try:
                if '.' in date_str:
                    # German format DD.MM.YYYY or DD.MM.YY
                    day, month, year = match.groups()
                    if len(year) == 2:
                        year = '20' + year
                    return date(int(year), int(month), int(day))
                elif date_str[4] == '-':
                    # ISO format YYYY-MM-DD
                    year, month, day = match.groups()
                    return date(int(year), int(month), int(day))
                else:
                    # Ambiguous slash format - assume DD/MM/YYYY
                    day, month, year = match.groups()
                    return date(int(year), int(month), int(day))
            except ValueError:
                continue

    return None


def parse_amount_from_string(amount_str):
    """Parse amount from string, handling German number format"""
    if not amount_str or pd.isna(amount_str):
        return 0.0

    amount_str = str(amount_str).strip()

    # Remove currency symbols
    amount_str = amount_str.replace('€', '').replace('EUR', '').replace('$', '').strip()

    # Handle German number format: 1.234,56 -> 1234.56
    # Count dots and commas
    dot_count = amount_str.count('.')
    comma_count = amount_str.count(',')

    if comma_count > 0 and dot_count > 0:
        # Has both: German format (1.234,56)
        amount_str = amount_str.replace('.', '').replace(',', '.')
    elif comma_count > 0:
        # Only comma: could be decimal separator
        # If comma is not in last 3 positions, it's thousands separator
        comma_pos = amount_str.rfind(',')
        if len(amount_str) - comma_pos - 1 <= 2:
            # Likely decimal separator
            amount_str = amount_str.replace(',', '.')
        else:
            # Thousands separator
            amount_str = amount_str.replace(',', '')
    elif dot_count > 1:
        # Multiple dots: thousands separator (1.234.567)
        amount_str = amount_str.replace('.', '')
    elif dot_count == 1:
        # Single dot: check if it's thousands or decimal
        parts = amount_str.split('.')
        if len(parts) == 2:
            after_dot = parts[1]
            if len(after_dot) == 3:
                # Likely thousands separator (1.234)
                amount_str = amount_str.replace('.', '')
            elif len(after_dot) <= 2:
                # Could be decimal
                pass

    # Remove any remaining non-numeric characters except minus and dot
    amount_str = re.sub(r'[^\d.-]', '', amount_str)

    try:
        return float(amount_str)
    except ValueError:
        return 0.0


def process_csv_content(file_content):
    """Process CSV by finding: sender, date, amount, notes columns"""
    try:
        lines = file_content.split('\n')

        # Find header row
        header_line = find_header_row(lines)

        if header_line >= len(lines):
            return {"error": "Could not find header row in CSV"}

        # Detect delimiter
        delimiter = detect_delimiter(lines[header_line])

        log_csv_activity(
            action="csv_structure_detected",
            details={
                "header_line": header_line,
                "delimiter": delimiter
            }
        )

        # Read CSV starting from header line
        data_lines = '\n'.join(lines[header_line:])

        try:
            df = pd.read_csv(
                StringIO(data_lines),
                delimiter=delimiter,
                dtype=str,
                skip_blank_lines=True
            )

            # Clean column names
            df.columns = df.columns.str.strip()
            headers = list(df.columns)

            log_csv_activity(
                action="csv_read",
                details={
                    "rows": df.shape[0],
                    "columns": df.shape[1],
                    "headers": headers
                }
            )

        except Exception as e:
            log_csv_activity(
                action="csv_read_failed",
                details={"error": str(e)},
                success=False
            )
            return {"error": f"Failed to read CSV: {str(e)}"}

        # Find columns by keywords
        date_keywords = ['datum', 'date', 'buchung', 'beleg', 'wert', 'buchungstag', 'tag']

        # For sender: prefer payer columns for incoming
        sender_keywords = [
            'zahlungspflichtige', 'auftraggeber', 'sender', 'payer',
            'zahlungsempfänger', 'empfänger', 'begünstigter', 'payee',
            'beschreibung', 'name'
        ]

        # For amount: look for amount column, or soll/haben columns
        amount_keywords = ['betrag', 'amount']
        soll_keywords = ['soll', 'debit']
        haben_keywords = ['haben', 'credit']

        notes_keywords = ['verwendungszweck', 'zweck', 'reference', 'beschreibung', 'memo', 'notiz', 'description']

        date_col = find_column_by_keywords(headers, date_keywords)
        sender_col = find_column_by_keywords(headers, sender_keywords)
        amount_col = find_column_by_keywords(headers, amount_keywords)
        soll_col = find_column_by_keywords(headers, soll_keywords)
        haben_col = find_column_by_keywords(headers, haben_keywords)
        notes_col = find_column_by_keywords(headers, notes_keywords)

        log_csv_activity(
            action="columns_identified",
            details={
                "date_column": date_col,
                "sender_column": sender_col,
                "amount_column": amount_col,
                "soll_column": soll_col,
                "haben_column": haben_col,
                "notes_column": notes_col
            }
        )

        # Validate required columns
        if date_col == -1:
            return {"error": "Could not find date column. Expected headers like: Datum, Date, Buchungsdatum"}

        if sender_col == -1:
            return {"error": "Could not find sender/name column. Expected headers like: Name, Empfänger, Auftraggeber"}

        if amount_col == -1 and (soll_col == -1 or haben_col == -1):
            return {"error": "Could not find amount column. Expected headers like: Betrag, Amount, Soll/Haben"}

        # Extract payments
        payments = []

        for i, row in df.iterrows():
            try:
                # Skip empty rows
                if row.isna().all():
                    continue

                # Extract date
                parsed_date = parse_date_from_string(row.iloc[date_col])
                if not parsed_date:
                    continue

                # Extract sender name
                sender = str(row.iloc[sender_col]).strip()
                if not sender or sender.lower() in ['nan', 'none', '']:
                    sender = ""

                # Extract amount
                amount = 0.0
                if amount_col != -1:
                    # Regular amount column
                    amount = parse_amount_from_string(row.iloc[amount_col])
                elif soll_col != -1 and haben_col != -1:
                    # Soll/Haben columns (Postbank style)
                    soll = parse_amount_from_string(row.iloc[soll_col])
                    haben = parse_amount_from_string(row.iloc[haben_col])
                    amount = haben - soll

                # Skip zero amounts
                if amount == 0.0:
                    continue

                # Skip negative amounts (outgoing payments)
                if amount < 0:
                    log_csv_activity(
                        action="skip_negative_amount",
                        details={"row": i, "amount": amount, "name": sender}
                    )
                    continue

                # Extract notes/description
                notes = ""
                if notes_col != -1:
                    notes = str(row.iloc[notes_col]).strip()
                    if notes.lower() in ['nan', 'none']:
                        notes = ""

                payments.append({
                    "date": parsed_date,
                    "name": sender,
                    "amount": amount,
                    "description": notes,
                    "row_number": i + 1 + header_line,
                })

            except Exception as e:
                log_csv_activity(
                    action="process_row_error",
                    details={"row": i, "error": str(e)},
                    success=False
                )
                continue

        log_csv_activity(
            action="extract_payments",
            details={"payment_count": len(payments)}
        )

        # Log sample payments for debugging
        for i, payment in enumerate(payments[:3]):
            log_csv_activity(
                action="sample_payment",
                details={
                    "index": i + 1,
                    "date": str(payment["date"]),
                    "name": payment["name"],
                    "amount": payment["amount"],
                }
            )

        return {"payments": payments}

    except Exception as e:
        log_csv_activity(
            action="process_csv_error",
            details={"error": str(e)},
            success=False
        )
        return {"error": str(e)}


def fuzzy_match_tenant(name, limit=5):
    """Find tenants matching the name using fuzzy matching"""
    if not name:
        return []

    name_lower = name.lower().strip()
    all_tenants = Tenant.query.all()

    matches = []
    for tenant in all_tenants:
        if not tenant.name:
            continue

        tenant_name_lower = tenant.name.lower().strip()
        score = SequenceMatcher(None, name_lower, tenant_name_lower).ratio()

        # Also check if one name contains the other
        if name_lower in tenant_name_lower or tenant_name_lower in name_lower:
            score = max(score, 0.8)

        if score >= 0.6:
            current_apartment = get_tenant_current_apartment(tenant.id)
            matches.append({
                "id": tenant.id,
                "name": tenant.name,
                "score": score,
                "current_apartment": current_apartment,
            })

    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:limit]


def fuzzy_match_tenant_from_payment(payment_data, limit=5):
    """
    MODIFIED: Find tenants matching either the name OR description field
    Returns best matches with source field indicated
    """
    name = payment_data.get("name", "")
    description = payment_data.get("description", "")

    all_matches = []

    # Match from name field
    if name:
        name_matches = fuzzy_match_tenant(name, limit=limit * 2)
        for match in name_matches:
            match["matched_from"] = "name"
            all_matches.append(match)

    # Match from description/notes field
    if description:
        desc_matches = fuzzy_match_tenant(description, limit=limit * 2)
        for match in desc_matches:
            match["matched_from"] = "description"
            all_matches.append(match)

    # Remove duplicates, keeping highest score
    seen_tenants = {}
    for match in all_matches:
        tenant_id = match["id"]
        if tenant_id not in seen_tenants or match["score"] > seen_tenants[tenant_id]["score"]:
            seen_tenants[tenant_id] = match

    # Convert back to list and sort by score
    unique_matches = list(seen_tenants.values())
    unique_matches.sort(key=lambda x: x["score"], reverse=True)

    return unique_matches[:limit]


def get_tenant_current_apartment(tenant_id):
    """Get the current apartment for a tenant"""
    try:
        active_contract = (
            db.session.query(ContractTenant)
            .join(ContractPeriod)
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == "active",
            )
            .first()
        )

        if active_contract and active_contract.contract_period:
            apartment = Apartment.query.get(active_contract.contract_period.apartment_id)
            if apartment:
                return {
                    "id": apartment.id,
                    "address": apartment.address or f"{apartment.street_name or ''} {apartment.house_number or ''}".strip()
                }

        return None

    except Exception as e:
        log_csv_activity(
            action="get_tenant_apartment_error",
            details={"tenant_id": tenant_id, "error": str(e)},
            success=False
        )
        return None


def create_automatic_payment_record(tenant, payment_data, current_user_id, matched_from="name"):
    """
    MODIFIED: Create payment record automatically for good match
    Added matched_from parameter to track where the match came from
    """
    try:
        apartment_id = get_current_apartment_for_tenant(tenant.id)
        if not apartment_id:
            return False

        amount = float(payment_data["amount"])
        payment_date = payment_data["date"]

        # Create payment record
        new_payment = Payment(
            apartment_id=apartment_id,
            amount=amount,
            payment_date=payment_date,
            month=payment_date.month if payment_date else None,
            year=payment_date.year if payment_date else None,
            status="paid",
            payment_method="bank_transfer",
            payment_type="rent",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Set optional fields if they exist in the model
        if hasattr(new_payment, 'paymentStatus'):
            new_payment.paymentStatus = "Completed"

        if hasattr(new_payment, 'notes'):
            match_source = f"Matched from {matched_from} field" if matched_from == "description" else ""
            new_payment.notes = f"Auto-assigned from CSV: {tenant.name}. {match_source}".strip()

        db.session.add(new_payment)
        db.session.flush()

        # Create tracking record
        tracking_record = UnassignedPayment(
            payment_date=payment_date,
            amount=amount,
            status="assigned",
            sender=payment_data["name"][:255] if payment_data["name"] else "",
            name_from_csv=payment_data["name"][:255] if payment_data["name"] else "",
            reference=payment_data.get("description", "")[:500] if payment_data.get("description") else None,
            matched_tenant_id=tenant.id,
            matched_apartment_id=apartment_id,
            similarity_score=1.0,
            description=payment_data.get("description", "")[:500] if payment_data.get("description") else None,
            uploaded_by_user_id=current_user_id,
        )

        db.session.add(tracking_record)

        log_csv_activity(
            action="create_automatic_payment",
            details={
                "tenant_name": tenant.name,
                "amount": amount,
                "apartment_id": apartment_id,
                "matched_from": matched_from,
            }
        )
        return True

    except Exception as e:
        log_csv_activity(
            action="create_payment_error",
            details={"tenant_name": tenant.name, "error": str(e)},
            success=False
        )
        return False


def get_current_apartment_for_tenant(tenant_id):
    """Get the current apartment ID for a tenant"""
    try:
        active_contract = (
            db.session.query(ContractTenant)
            .join(ContractPeriod)
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == "active",
            )
            .first()
        )

        if active_contract and active_contract.contract_period:
            return active_contract.contract_period.apartment_id

        return None

    except Exception as e:
        log_csv_activity(
            action="get_apartment_for_tenant_error",
            details={"tenant_id": tenant_id, "error": str(e)},
            success=False
        )
        return None


@csv_payments_bp.route("/process-csv-simple", methods=["POST"])
@token_required
def process_csv_simple():
    """
    MODIFIED: Enhanced CSV processing with:
    - 75% threshold for auto-assignment (changed from 95%)
    - Matching from both name AND description fields
    """
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        if not file.filename.lower().endswith((".csv", ".txt")):
            return jsonify({"error": "Please upload CSV or TXT files."}), 400

        current_user_id = g.user.get("id")
        if not current_user_id:
            return jsonify({"error": "User authentication required"}), 401

        # Read file content
        try:
            file_content = file.read().decode("utf-8")
        except UnicodeDecodeError:
            try:
                file_content = file.read().decode("latin-1")
            except:
                return jsonify({"error": "Could not decode file. Please ensure it is a valid CSV file."}), 400

        log_csv_activity(
            action="process_csv_start",
            details={"filename": file.filename, "user_id": current_user_id}
        )

        # Process CSV
        result = process_csv_content(file_content)

        if "error" in result:
            return jsonify({"error": result["error"]}), 400

        # Process each payment
        unassigned_transactions = []
        auto_assigned = 0
        auto_assigned_details = []
        skipped_duplicates = 0
        duplicate_details = []

        for i, payment_data in enumerate(result["payments"]):
            # Check for duplicates
            existing = UnassignedPayment.query.filter_by(
                payment_date=payment_data["date"],
                amount=float(payment_data["amount"]),
                sender=payment_data["name"][:255] if payment_data["name"] else ""
            ).first()

            if existing:
                skipped_duplicates += 1
                duplicate_details.append({
                    "name": payment_data["name"],
                    "amount": payment_data["amount"],
                    "date": str(payment_data["date"])
                })
                continue

            # MODIFIED: Try to auto-assign using BOTH name and description
            matches = fuzzy_match_tenant_from_payment(payment_data, limit=1)

            # MODIFIED: Changed threshold from 0.95 to 0.75 (75%)
            if matches and matches[0]["score"] >= 0.75:
                # Good match - auto assign
                tenant = Tenant.query.get(matches[0]["id"])
                matched_from = matches[0].get("matched_from", "name")

                if create_automatic_payment_record(tenant, payment_data, current_user_id, matched_from):
                    auto_assigned += 1
                    auto_assigned_details.append({
                        "tenant_name": tenant.name,
                        "amount": payment_data["amount"],
                        "date": str(payment_data["date"]),
                        "matched_from": matched_from,
                        "score": matches[0]["score"]
                    })
                    continue

            # Create unassigned payment
            unassigned_payment = UnassignedPayment(
                payment_date=payment_data["date"],
                amount=float(payment_data["amount"]),
                status="unassigned",
                sender=payment_data["name"][:255] if payment_data["name"] else "",
                name_from_csv=payment_data["name"][:255] if payment_data["name"] else "",
                reference=payment_data.get("description", "")[:500] if payment_data.get("description") else None,
                description=payment_data.get("description", "")[:500] if payment_data.get("description") else None,
                csv_line=payment_data.get("row_number", i + 1),
                uploaded_by_user_id=current_user_id,
            )

            db.session.add(unassigned_payment)
            db.session.flush()

            unassigned_transactions.append({
                "id": unassigned_payment.id,
                "date": payment_data["date"].isoformat(),
                "payment_date": payment_data["date"].isoformat(),
                "amount": float(payment_data["amount"]),
                "sender": payment_data["name"] or "",
                "name_from_csv": payment_data["name"] or "",
                "reference": payment_data.get("description", "") or "",
                "description": payment_data.get("description", "") or "",
                "csv_line": payment_data.get("row_number", i + 1),
                "status": "unassigned",
            })

        try:
            db.session.commit()
            log_csv_activity(
                action="process_csv_complete",
                details={
                    "total_payments": len(result["payments"]),
                    "auto_assigned": auto_assigned,
                    "unassigned": len(unassigned_transactions),
                    "duplicates_skipped": skipped_duplicates,
                    "threshold_used": "75%"
                }
            )
        except Exception as e:
            db.session.rollback()
            log_csv_activity(
                action="database_error",
                details={"error": str(e)},
                success=False
            )
            return jsonify({"error": "Failed to store transactions in database"}), 500

        return jsonify({
            "transactions": unassigned_transactions,
            "auto_assigned": auto_assigned,
            "auto_assigned_details": auto_assigned_details,
            "duplicates_skipped": skipped_duplicates,
            "duplicate_details": duplicate_details,
            "total_processed": len(result["payments"]),
            "message": f"Processed {len(result['payments'])} payments: {auto_assigned} auto-assigned (75% threshold), {len(unassigned_transactions)} require review, {skipped_duplicates} duplicates skipped",
        }), 200

    except Exception as e:
        db.session.rollback()
        log_csv_activity(
            action="process_csv_error",
            details={"error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/unassigned", methods=["GET"])
@token_required
def get_unassigned_payments():
    """Get all unassigned payments with filters"""
    try:
        status = request.args.get("status", "unassigned")
        uploader_id = request.args.get("uploader_id")

        query = UnassignedPayment.query

        if status and status != "all":
            if status == "unassigned":
                query = query.filter(UnassignedPayment.status.in_(["unassigned", "matched"]))
            else:
                query = query.filter_by(status=status)

        if uploader_id:
            query = query.filter_by(uploaded_by_user_id=int(uploader_id))

        payments = query.order_by(desc(UnassignedPayment.created_at)).all()

        results = []
        for payment in payments:
            # MODIFIED: Use new function that checks both name and description
            payment_data = {
                "name": payment.name_from_csv or "",
                "description": payment.description or payment.reference or ""
            }
            potential_matches = fuzzy_match_tenant_from_payment(payment_data, limit=5)

            payment_dict = payment.to_dict()
            payment_dict["potential_matches"] = potential_matches
            results.append(payment_dict)

        return jsonify({"payments": results}), 200

    except Exception as e:
        log_csv_activity(
            action="get_unassigned_error",
            details={"error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/previous-uploads", methods=["GET"])
@token_required
def get_previous_uploads():
    """Get previous CSV uploads with pagination and filtering"""
    try:
        current_user_id = g.user.get("id")
        is_admin = g.user.get("role") == "admin"

        page = int(request.args.get("page", 0))
        limit = int(request.args.get("limit", 50))
        filter_user_id = request.args.get("user_id")
        show_all = request.args.get("show_all", "false").lower() == "true"

        # Base query - only unassigned and matched (not assigned or rejected)
        query = UnassignedPayment.query.filter(
            UnassignedPayment.status.in_(["unassigned", "matched"])
        )

        # Apply user filters
        if not is_admin or (not show_all and not filter_user_id):
            query = query.filter_by(uploaded_by_user_id=current_user_id)
        elif filter_user_id:
            query = query.filter_by(uploaded_by_user_id=int(filter_user_id))

        # Get counts by status for summary
        summary = {
            "unassigned": {
                "count": query.filter_by(status="unassigned").count(),
                "total_amount": db.session.query(func.sum(UnassignedPayment.amount)).filter(
                    UnassignedPayment.status == "unassigned",
                    UnassignedPayment.uploaded_by_user_id == current_user_id if not is_admin else True
                ).scalar() or 0
            },
            "matched": {
                "count": query.filter_by(status="matched").count(),
                "total_amount": db.session.query(func.sum(UnassignedPayment.amount)).filter(
                    UnassignedPayment.status == "matched",
                    UnassignedPayment.uploaded_by_user_id == current_user_id if not is_admin else True
                ).scalar() or 0
            },
            "assigned": {
                "count": UnassignedPayment.query.filter_by(
                    status="assigned",
                    uploaded_by_user_id=current_user_id if not is_admin else None
                ).count(),
                "total_amount": db.session.query(func.sum(UnassignedPayment.amount)).filter(
                    UnassignedPayment.status == "assigned",
                    UnassignedPayment.uploaded_by_user_id == current_user_id if not is_admin else True
                ).scalar() or 0
            }
        }

        # Get counts
        total_items = query.count()

        # Pagination
        offset = page * limit
        paginated_payments = query.order_by(desc(UnassignedPayment.payment_date)).offset(offset).limit(limit).all()

        # Format payments
        def format_payment(p):
            return {
                "id": p.id,
                "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                "amount": float(p.amount) if p.amount else 0,
                "name_from_csv": p.sender or "",
                "sender": p.sender or "",
                "reference": p.reference or "",
                "description": p.reference or "",
                "status": p.status or "unassigned",
            }

        unassigned_payments = [format_payment(p) for p in paginated_payments]

        return jsonify({
            "unassigned": unassigned_payments,
            "matched": [],  # For compatibility
            "summary": summary,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": total_items,
                "total_pages": (total_items + limit - 1) // limit if limit > 0 else 1,
                "has_next": offset + limit < total_items,
                "has_prev": page > 0,
            },
        }), 200

    except Exception as e:
        log_csv_activity(
            action="get_previous_uploads_error",
            details={"error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/uploaders", methods=["GET"])
@token_required
def get_uploaders():
    """Get list of users who have uploaded CSV payments"""
    try:
        uploaders_query = (
            db.session.query(
                UnassignedPayment.uploaded_by_user_id,
                func.count(UnassignedPayment.id).label("total_uploads"),
                User.username
            )
            .outerjoin(User, UnassignedPayment.uploaded_by_user_id == User.id)
            .filter(UnassignedPayment.status.in_(["unassigned", "matched"]))
            .group_by(UnassignedPayment.uploaded_by_user_id, User.username)
            .all()
        )

        uploaders = []
        for uploader_id, total, username in uploaders_query:
            uploaders.append({
                "user_id": uploader_id,
                "username": username or f"User {uploader_id}",
                "upload_count": total
            })

        return jsonify({"uploaders": uploaders}), 200

    except Exception as e:
        log_csv_activity(
            action="get_uploaders_error",
            details={"error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/assign/<int:payment_id>", methods=["POST"])
@token_required
def assign_payment(payment_id):
    """Assign an unassigned payment to a tenant and apartment - SUPPORTS UNKNOWN TENANT"""
    try:
        payment = UnassignedPayment.query.get(payment_id)
        if not payment:
            return jsonify({"error": "Payment not found"}), 404

        data = request.get_json()
        tenant_id = data.get("tenant_id")  # Can be None for "Unknown"
        apartment_id = data.get("apartment_id")
        amount = data.get("amount")
        payment_date = data.get("payment_date")
        notes = data.get("notes", "")

        # apartment_id is REQUIRED, but tenant_id is OPTIONAL
        if not apartment_id:
            return jsonify({"error": "Apartment is required"}), 400

        # Create payment record - tenant_id can be None for unknown tenant
        new_payment = Payment(
            apartment_id=apartment_id,
            amount=float(amount),
            payment_date=datetime.fromisoformat(payment_date) if payment_date else payment.payment_date,
            month=payment.payment_date.month if payment.payment_date else None,
            year=payment.payment_date.year if payment.payment_date else None,
            status="paid",
            payment_method="bank_transfer",
            payment_type="rent",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Set optional fields
        if hasattr(new_payment, 'paymentStatus'):
            new_payment.paymentStatus = "Completed"

        if hasattr(new_payment, 'notes'):
            # Add indication if this is an unknown tenant payment
            if tenant_id is None:
                new_payment.notes = f"[Unknown Tenant] {notes}".strip()
            else:
                new_payment.notes = notes

        db.session.add(new_payment)

        # Update unassigned payment status
        payment.status = "assigned"
        payment.matched_tenant_id = tenant_id  # Can be None for unknown
        payment.matched_apartment_id = apartment_id

        db.session.commit()

        log_csv_activity(
            action="manual_assignment",
            details={
                "payment_id": payment_id,
                "tenant_id": tenant_id if tenant_id else "unknown",
                "apartment_id": apartment_id,
                "is_unknown_tenant": tenant_id is None
            }
        )

        tenant_label = "Unknown Tenant" if tenant_id is None else f"Tenant ID {tenant_id}"
        return jsonify({
            "success": True,
            "message": f"Payment assigned successfully to {tenant_label}"
        }), 200

    except Exception as e:
        db.session.rollback()
        log_csv_activity(
            action="assign_payment_error",
            details={"payment_id": payment_id, "error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500

@csv_payments_bp.route("/reject/<int:payment_id>", methods=["POST"])
@token_required
def reject_payment(payment_id):
    """Delete an unassigned payment"""
    try:
        payment = UnassignedPayment.query.get(payment_id)
        if not payment:
            return jsonify({"error": "Payment not found"}), 404

        db.session.delete(payment)
        db.session.commit()

        log_csv_activity(
            action="delete_payment",
            details={"payment_id": payment_id}
        )

        return jsonify({"success": True, "message": "Payment deleted"}), 200

    except Exception as e:
        db.session.rollback()
        log_csv_activity(
            action="delete_payment_error",
            details={"payment_id": payment_id, "error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/reject-multiple", methods=["POST"])
@token_required
def reject_multiple_payments():
    """Delete multiple payments at once"""
    try:
        data = request.get_json()
        payment_ids = data.get("payment_ids", [])

        if not payment_ids:
            return jsonify({"error": "No payment IDs provided"}), 400

        deleted_count = UnassignedPayment.query.filter(
            UnassignedPayment.id.in_(payment_ids)
        ).delete(synchronize_session=False)

        db.session.commit()

        log_csv_activity(
            action="delete_multiple_payments",
            details={
                "payment_ids": payment_ids,
                "deleted_count": deleted_count
            }
        )

        return jsonify({
            "success": True,
            "message": f"Deleted {deleted_count} payments"
        }), 200

    except Exception as e:
        db.session.rollback()
        log_csv_activity(
            action="delete_multiple_payments_error",
            details={"error": str(e)},
            success=False
        )
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/match-tenant", methods=["POST"])
@token_required
def match_tenant():
    """Find potential tenant matches for a name"""
    try:
        data = request.get_json()
        name = data.get("name", "")

        if not name:
            return jsonify({"error": "Name is required"}), 400

        matches = fuzzy_match_tenant(name, limit=10)

        return jsonify({"matches": matches}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@csv_payments_bp.route("/statistics", methods=["GET"])
@token_required
def get_statistics():
    """Get CSV payment statistics"""
    try:
        total_unassigned = UnassignedPayment.query.filter_by(status="unassigned").count()
        total_assigned = UnassignedPayment.query.filter_by(status="assigned").count()

        total_amount_unassigned = db.session.query(
            func.sum(UnassignedPayment.amount)
        ).filter_by(status="unassigned").scalar() or 0

        return jsonify({
            "total_unassigned": total_unassigned,
            "total_assigned": total_assigned,
            "total_amount_unassigned": float(total_amount_unassigned)
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
