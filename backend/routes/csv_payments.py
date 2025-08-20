# routes/csv_payments.py - CSV Payment Processing Endpoint
import csv
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from .auth import token_required, role_required
from extentions import db
from models.models import Payment, Apartment, Tenant
from activity_logger import ActivityLogger
from sqlalchemy import or_, func
import json

csv_payments_bp = Blueprint("csv_payments_bp", __name__)

# Configuration
ALLOWED_EXTENSIONS = {'csv', 'txt'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
COMMON_DELIMITERS = [';', ',', '\t', '|']

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def detect_delimiter(sample_text):
    """Detect the most likely delimiter in CSV content"""
    delimiter_counts = {}
    for delimiter in COMMON_DELIMITERS:
        delimiter_counts[delimiter] = sample_text.count(delimiter)

    # Return the delimiter with the highest count
    return max(delimiter_counts, key=delimiter_counts.get) if any(delimiter_counts.values()) else ';'

def parse_amount(amount_str):
    """Parse amount string to float, handling various formats"""
    if not amount_str or amount_str.strip() == '':
        return 0.0

    # Remove common currency symbols and whitespace
    cleaned = re.sub(r'[€$£¥\s]', '', str(amount_str))

    # Handle German number format (1.234,56 -> 1234.56)
    if ',' in cleaned and '.' in cleaned:
        # If both comma and dot exist, assume German format
        cleaned = cleaned.replace('.', '').replace(',', '.')
    elif ',' in cleaned and cleaned.count(',') == 1:
        # Single comma, likely decimal separator
        if len(cleaned.split(',')[1]) <= 2:  # Decimal places
            cleaned = cleaned.replace(',', '.')

    # Remove any remaining non-numeric characters except decimal point and minus
    cleaned = re.sub(r'[^\d.-]', '', cleaned)

    try:
        return float(cleaned)
    except (ValueError, InvalidOperation):
        return 0.0

def parse_date(date_str):
    """Parse date string to datetime object, trying multiple formats"""
    if not date_str or date_str.strip() == '':
        return None

    date_formats = [
        '%d.%m.%Y',      # German format: 19.08.2025
        '%d/%m/%Y',      # 19/08/2025
        '%Y-%m-%d',      # ISO format: 2025-08-19
        '%d-%m-%Y',      # 19-08-2025
        '%m/%d/%Y',      # US format: 08/19/2025
        '%d.%m.%y',      # Short year: 19.08.25
        '%d/%m/%y',      # 19/08/25
    ]

    date_str = date_str.strip()
    for fmt in date_formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    return None

def fuzzy_match_tenant(payment_reference, tenant_name, threshold=0.6):
    """
    Fuzzy match payment reference with tenant name
    Returns similarity score (0-1)
    """
    if not payment_reference or not tenant_name:
        return 0.0

    # Normalize strings
    ref_clean = re.sub(r'[^\w\s]', '', payment_reference.lower())
    name_clean = re.sub(r'[^\w\s]', '', tenant_name.lower())

    # Simple substring matching
    if name_clean in ref_clean or ref_clean in name_clean:
        return 1.0

    # Split into words and check for matches
    ref_words = set(ref_clean.split())
    name_words = set(name_clean.split())

    if not ref_words or not name_words:
        return 0.0

    # Calculate Jaccard similarity
    intersection = len(ref_words.intersection(name_words))
    union = len(ref_words.union(name_words))

    return intersection / union if union > 0 else 0.0

def find_matching_tenant(payment_data, apartments_cache):
    """
    Find the best matching tenant for a payment
    Returns (tenant, apartment, confidence_score)
    """
    best_match = None
    best_score = 0.0
    best_apartment = None

    # Get searchable fields from payment
    search_fields = [
        payment_data.get('reference', ''),
        payment_data.get('description', ''),
        payment_data.get('purpose', ''),
        payment_data.get('tenant', ''),
        payment_data.get('sender', ''),
    ]

    search_text = ' '.join(filter(None, search_fields)).lower()

    # Search through all apartments and tenants
    for apartment in apartments_cache:
        # Check apartment address in payment reference
        address_score = fuzzy_match_tenant(search_text, apartment.address)

        for tenant in apartment.tenants:
            # Calculate tenant name match score
            name_score = fuzzy_match_tenant(search_text, tenant.name)

            # Combine apartment address and tenant name scores
            combined_score = max(name_score, address_score * 0.7)  # Slight preference for direct name matches

            if combined_score > best_score:
                best_score = combined_score
                best_match = tenant
                best_apartment = apartment

    return best_match, best_apartment, best_score

def process_csv_content(csv_content, delimiter=';'):
    """
    Process CSV content and extract payment data
    Returns list of payment dictionaries
    """
    payments = []

    try:
        # Create CSV reader
        csv_reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)

        # Get field names and try to map to common payment fields
        fieldnames = csv_reader.fieldnames or []
        current_app.logger.info(f"CSV fields detected: {fieldnames}")

        # Define field mappings (German banking format)
        field_mappings = {
            'date': ['Buchungsdatum', 'Buchungstag', 'Valutadatum', 'Date', 'Datum'],
            'amount': ['Betrag (€)', 'Betrag', 'Umsatz (EUR)', 'Amount', 'Summe'],
            'sender': ['Zahlungspflichtige*r', 'Auftraggeber', 'Sender', 'Von'],
            'reference': ['Verwendungszweck', 'Reference', 'Zweck', 'Beschreibung'],
            'description': ['Buchungstext', 'Description', 'Text'],
            'purpose': ['Verwendungszweck', 'Purpose', 'Zweck'],
        }

        # Auto-detect field mappings
        detected_fields = {}
        for target_field, possible_names in field_mappings.items():
            for field_name in fieldnames:
                if any(possible.lower() in field_name.lower() for possible in possible_names):
                    detected_fields[target_field] = field_name
                    break

        current_app.logger.info(f"Field mappings detected: {detected_fields}")

        # Process each row
        for row_num, row in enumerate(csv_reader, 1):
            try:
                payment_data = {}

                # Extract data using detected mappings
                for target_field, csv_field in detected_fields.items():
                    payment_data[target_field] = row.get(csv_field, '').strip()

                # Parse amount
                amount_str = payment_data.get('amount', '0')
                amount = parse_amount(amount_str)

                # Only process incoming payments (positive amounts)
                if amount <= 0:
                    continue

                # Parse date
                date_str = payment_data.get('date', '')
                payment_date = parse_date(date_str)

                if not payment_date:
                    current_app.logger.warning(f"Row {row_num}: Could not parse date '{date_str}'")
                    continue

                # Create payment record
                payment_record = {
                    'row_number': row_num,
                    'amount': amount,
                    'date': payment_date,
                    'sender': payment_data.get('sender', ''),
                    'reference': payment_data.get('reference', ''),
                    'description': payment_data.get('description', ''),
                    'purpose': payment_data.get('purpose', ''),
                    'raw_data': dict(row),  # Keep original row data
                }

                payments.append(payment_record)

            except Exception as e:
                current_app.logger.error(f"Error processing row {row_num}: {e}")
                continue

    except Exception as e:
        current_app.logger.error(f"Error processing CSV content: {e}")
        raise

    return payments

@csv_payments_bp.route("/process-csv-payments", methods=["POST"])
@token_required
@role_required("admin")
def process_csv_payments():
    """
    Process uploaded CSV file to extract and match rent payments
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({"message": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"message": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"message": "Invalid file type. Only CSV and TXT files are allowed"}), 400

        # Check file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning

        if file_size > MAX_FILE_SIZE:
            return jsonify({"message": f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"}), 400

        # Read file content
        try:
            content = file.read().decode('utf-8-sig')  # Handle BOM
        except UnicodeDecodeError:
            try:
                file.seek(0)
                content = file.read().decode('latin1')  # Fallback encoding
            except UnicodeDecodeError:
                return jsonify({"message": "Could not decode file. Please ensure it's a valid CSV file"}), 400

        # Detect delimiter
        delimiter = detect_delimiter(content[:1000])  # Sample first 1000 characters

        # Get optional parameters
        confidence_threshold = float(request.form.get('confidence_threshold', 0.6))
        auto_insert = request.form.get('auto_insert', 'true').lower() == 'true'

        current_app.logger.info(f"Processing CSV with delimiter '{delimiter}', threshold {confidence_threshold}")

        # Process CSV content
        payments = process_csv_content(content, delimiter)

        if not payments:
            return jsonify({
                "message": "No valid payments found in CSV file",
                "total_rows": 0,
                "matched_payments": [],
                "unmatched_payments": [],
                "insert_errors": []
            }), 200

        # Cache apartments and tenants for matching
        apartments_cache = Apartment.query.all()

        # Process payments and find matches
        matched_payments = []
        unmatched_payments = []
        insert_errors = []

        for payment in payments:
            # Find matching tenant
            tenant, apartment, confidence = find_matching_tenant(payment, apartments_cache)

            payment_result = {
                "row_number": payment['row_number'],
                "amount": payment['amount'],
                "date": payment['date'].isoformat(),
                "sender": payment['sender'],
                "reference": payment['reference'],
                "description": payment['description'],
                "confidence": confidence,
                "matched_tenant": tenant.name if tenant else None,
                "matched_apartment": apartment.address if apartment else None,
                "apartment_id": apartment.id if apartment else None,
                "tenant_id": tenant.id if tenant else None,
            }

            if confidence >= confidence_threshold and tenant and apartment:
                # High confidence match
                matched_payments.append(payment_result)

                # Auto-insert if enabled
                if auto_insert:
                    try:
                        # Create payment record
                        new_payment = Payment(
                            apartment_id=apartment.id,
                            month=payment['date'].strftime('%B'),
                            year=payment['date'].year,
                            status='paid',
                            tenants=json.dumps([{
                                "name": tenant.name,
                                "amountPaid": payment['amount'],
                                "amountDue": payment['amount'],
                                "paid": True
                            }]),
                            internet=0.0,
                            electricity=0.0,
                            other=0.0,
                            extraPayments="{}",
                            paymentDate=payment['date'],
                            paymentMethod="bank_transfer",
                            notes=f"CSV Import: {payment['reference'][:100]}",
                            updated_at=datetime.utcnow()
                        )

                        # Add new model fields if they exist
                        if hasattr(new_payment, 'amount'):
                            new_payment.amount = payment['amount']
                        if hasattr(new_payment, 'payment_type'):
                            new_payment.payment_type = 'rent'
                        if hasattr(new_payment, 'tenant_name'):
                            new_payment.tenant_name = tenant.name

                        db.session.add(new_payment)
                        db.session.flush()

                        payment_result["inserted"] = True
                        payment_result["payment_id"] = new_payment.id

                    except Exception as e:
                        db.session.rollback()
                        current_app.logger.error(f"Error inserting payment: {e}")
                        insert_errors.append({
                            "row_number": payment['row_number'],
                            "error": str(e),
                            "payment_data": payment_result
                        })
                        payment_result["inserted"] = False
                        payment_result["insert_error"] = str(e)
            else:
                # Low confidence or no match
                unmatched_payments.append(payment_result)

        # Commit all successful insertions
        if auto_insert and not insert_errors:
            db.session.commit()

            # Log the CSV processing
            ActivityLogger.log_activity(
                action="process_csv_payments",
                entity_type="payment",
                details={
                    "filename": secure_filename(file.filename),
                    "total_payments": len(payments),
                    "matched": len(matched_payments),
                    "unmatched": len(unmatched_payments),
                    "inserted": len([p for p in matched_payments if p.get("inserted", False)]),
                    "confidence_threshold": confidence_threshold
                }
            )
        elif auto_insert:
            db.session.rollback()

        # Prepare response
        response = {
            "message": f"Processed {len(payments)} payments from CSV",
            "total_rows": len(payments),
            "matched_payments": matched_payments,
            "unmatched_payments": unmatched_payments,
            "insert_errors": insert_errors,
            "summary": {
                "total": len(payments),
                "matched": len(matched_payments),
                "unmatched": len(unmatched_payments),
                "inserted": len([p for p in matched_payments if p.get("inserted", False)]),
                "errors": len(insert_errors),
                "confidence_threshold": confidence_threshold,
                "auto_insert_enabled": auto_insert
            },
            "field_mappings": {
                "delimiter_detected": delimiter,
                "total_amount": sum(p['amount'] for p in payments),
                "date_range": {
                    "earliest": min(p['date'] for p in payments).isoformat() if payments else None,
                    "latest": max(p['date'] for p in payments).isoformat() if payments else None
                }
            }
        }

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error processing CSV payments: {e}")
        db.session.rollback()
        return jsonify({
            "message": "Error processing CSV file",
            "error": str(e),
            "matched_payments": [],
            "unmatched_payments": [],
            "insert_errors": []
        }), 500

@csv_payments_bp.route("/manual-match-payment", methods=["POST"])
@token_required
@role_required("admin")
def manual_match_payment():
    """
    Manually match and insert a payment that was unmatched during CSV processing
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Required fields
        required_fields = ['apartment_id', 'tenant_id', 'amount', 'date']
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400

        # Validate apartment and tenant
        apartment = Apartment.query.get(data['apartment_id'])
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        tenant = Tenant.query.get(data['tenant_id'])
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Parse date
        try:
            payment_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
        except ValueError:
            try:
                payment_date = datetime.strptime(data['date'], '%Y-%m-%d')
            except ValueError:
                return jsonify({"message": "Invalid date format"}), 400

        # Create payment record
        new_payment = Payment(
            apartment_id=apartment.id,
            month=payment_date.strftime('%B'),
            year=payment_date.year,
            status='paid',
            tenants=json.dumps([{
                "name": tenant.name,
                "amountPaid": float(data['amount']),
                "amountDue": float(data['amount']),
                "paid": True
            }]),
            internet=0.0,
            electricity=0.0,
            other=0.0,
            extraPayments="{}",
            paymentDate=payment_date,
            paymentMethod="bank_transfer",
            notes=f"Manual CSV Match: {data.get('reference', '')}",
            updated_at=datetime.utcnow()
        )

        # Add new model fields if they exist
        if hasattr(new_payment, 'amount'):
            new_payment.amount = float(data['amount'])
        if hasattr(new_payment, 'payment_type'):
            new_payment.payment_type = 'rent'
        if hasattr(new_payment, 'tenant_name'):
            new_payment.tenant_name = tenant.name

        db.session.add(new_payment)
        db.session.commit()

        # Log the manual match
        ActivityLogger.log_payment_action(
            action="manual_csv_match",
            payment_id=new_payment.id,
            apartment_id=apartment.id,
            details={
                "tenant_id": tenant.id,
                "amount": float(data['amount']),
                "date": data['date'],
                "reference": data.get('reference', ''),
                "row_number": data.get('row_number')
            }
        )

        return jsonify({
            "message": "Payment manually matched and inserted successfully",
            "payment_id": new_payment.id
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error manually matching payment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error manually matching payment", "error": str(e)}), 500
