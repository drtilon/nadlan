import os
import json
import sys
import logging
import re
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.utils import secure_filename
from .auth import token_required, role_required
from models.models import Tenant, Apartment, Payment, UnassignedPayment, ContractTenant, ContractPeriod
from extentions import db
from openai import OpenAI
from activity_logger import ActivityLogger
from sqlalchemy import func, desc, case
from difflib import SequenceMatcher
import pandas as pd
from io import StringIO

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - CSV_PROCESSOR - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Configuration
XAI_API_KEY = os.environ.get("XAI_API_KEY")

def get_grok_client():
    """Get Grok client using X.AI API"""
    if not XAI_API_KEY:
        return None
    return OpenAI(api_key=XAI_API_KEY, base_url="https://api.x.ai/v1")

# Define blueprint
csv_payments_bp = Blueprint('csv_payments', __name__, url_prefix='/api/csv-payments')

def debug_print(message):
    """Print with immediate flush for Docker/Flask development"""
    print(message, flush=True)
    sys.stdout.flush()
    logger.info(message)

def allowed_file(filename):
    """Check if file extension is allowed"""
    ALLOWED_EXTENSIONS = {'csv', 'txt'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_date_from_string(date_str):
    """Enhanced date parsing that handles various European date formats"""
    if not date_str or pd.isna(date_str):
        return None

    # Convert to string and clean
    date_str = str(date_str).strip()

    if not date_str or date_str.lower() in ['nan', 'n/a', 'none', '']:
        return None

    # Common European date formats to try
    date_formats = [
        '%d.%m.%Y',      # German: 31.12.2024
        '%d/%m/%Y',      # European: 31/12/2024
        '%d-%m-%Y',      # Dash: 31-12-2024
        '%Y-%m-%d',      # ISO: 2024-12-31
        '%d.%m.%y',      # Short year: 31.12.24
        '%d/%m/%y',      # Short year: 31/12/24
        '%d-%m-%y',      # Short year: 31-12-24
        '%m/%d/%Y',      # US format: 12/31/2024
        '%Y/%m/%d',      # Alternative ISO: 2024/12/31
        '%d %m %Y',      # Space separated: 31 12 2024
        '%d %b %Y',      # Month name: 31 Dec 2024
        '%d %B %Y',      # Full month: 31 December 2024
        '%b %d, %Y',     # US style: Dec 31, 2024
        '%B %d, %Y',     # US style full: December 31, 2024
    ]

    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            # Validate reasonable date range (not too far in past/future)
            current_year = datetime.now().year
            if 1900 <= parsed_date.year <= current_year + 10:
                return parsed_date.date()
        except ValueError:
            continue

    # Try pandas date parsing as fallback
    try:
        parsed = pd.to_datetime(date_str, dayfirst=True, errors='coerce')
        if not pd.isna(parsed):
            return parsed.date()
    except:
        pass

    debug_print(f"Could not parse date: '{date_str}'")
    return None

def parse_amount_from_string(amount_str):
    """Enhanced amount parsing for various European formats"""
    if not amount_str or pd.isna(amount_str):
        return 0.0

    # Convert to string and clean
    amount_str = str(amount_str).strip()

    if not amount_str or amount_str.lower() in ['nan', 'n/a', 'none', '']:
        return 0.0

    # Remove currency symbols and spaces
    amount_str = re.sub(r'[€$£¥₹]', '', amount_str)
    amount_str = re.sub(r'\s+', '', amount_str)

    # Handle different decimal separators and thousand separators
    # European format: 1.234,56 or 1,234.56
    if ',' in amount_str and '.' in amount_str:
        # Both comma and dot present
        comma_pos = amount_str.rfind(',')
        dot_pos = amount_str.rfind('.')

        if comma_pos > dot_pos:
            # European: 1.234,56
            amount_str = amount_str.replace('.', '').replace(',', '.')
        else:
            # US: 1,234.56
            amount_str = amount_str.replace(',', '')
    elif ',' in amount_str:
        # Only comma - could be decimal separator in European format
        if len(amount_str.split(',')[-1]) <= 2:
            # Likely decimal separator: 1234,56
            amount_str = amount_str.replace(',', '.')
        else:
            # Likely thousand separator: 1,234
            amount_str = amount_str.replace(',', '')

    # Handle negative amounts (could be in parentheses or with minus)
    is_negative = False
    if amount_str.startswith('(') and amount_str.endswith(')'):
        is_negative = True
        amount_str = amount_str[1:-1]
    elif amount_str.startswith('-'):
        is_negative = True
        amount_str = amount_str[1:]

    # Remove any remaining non-numeric characters except decimal point
    amount_str = re.sub(r'[^\d.]', '', amount_str)

    try:
        amount = float(amount_str)
        if is_negative:
            amount = -amount
        return abs(amount)  # We usually want positive amounts for rent payments
    except ValueError:
        debug_print(f"Could not parse amount: '{amount_str}'")
        return 0.0

def create_unassigned_payments_table():
    """Create the unassigned_payments table if it doesn't exist and add user tracking column"""
    try:
        db.create_all()
        debug_print("Ensured unassigned_payments table exists")

        # Add uploaded_by_user_id column if it doesn't exist
        try:
            db.session.execute("ALTER TABLE unassigned_payments ADD COLUMN uploaded_by_user_id INTEGER")
            db.session.commit()
            debug_print("Added uploaded_by_user_id column to unassigned_payments table")

            # Assign existing records to admin user
            admin_user = db.session.execute(
                "SELECT id FROM users WHERE username = 'admin' OR role = 'admin' LIMIT 1"
            ).fetchone()

            if admin_user:
                admin_id = admin_user[0]
                result = db.session.execute(
                    "UPDATE unassigned_payments SET uploaded_by_user_id = :admin_id WHERE uploaded_by_user_id IS NULL",
                    {"admin_id": admin_id}
                )
                db.session.commit()
                debug_print(f"Assigned {result.rowcount} existing payments to admin user (ID: {admin_id})")
            else:
                debug_print("No admin user found - existing payments will remain unassigned")

        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e):
                debug_print("uploaded_by_user_id column already exists")
            else:
                debug_print(f"Note: Could not add uploaded_by_user_id column: {e}")
            db.session.rollback()
    except Exception as e:
        debug_print(f"Error creating/updating tables: {e}")

def exact_match_tenant_name(csv_name):
    """Find exact matching tenant by name (case-insensitive)"""
    if not csv_name:
        return None, 0

    try:
        # Clean the CSV name (remove extra spaces, normalize)
        clean_csv_name = csv_name.strip().lower()

        tenants = Tenant.query.all()

        for tenant in tenants:
            clean_tenant_name = tenant.name.strip().lower()

            # Exact match (case-insensitive)
            if clean_csv_name == clean_tenant_name:
                debug_print(f"Exact match found: '{csv_name}' -> '{tenant.name}'")
                return tenant, 1.0  # Perfect match score

        debug_print(f"No exact match found for: '{csv_name}'")
        return None, 0

    except Exception as e:
        debug_print(f"Error in exact matching: {e}")
        return None, 0

def get_tenant_current_apartment(tenant_id):
    """Get the current apartment for a tenant through ContractTenant relationship"""
    try:
        # Find active contract assignments for this tenant
        active_contract = db.session.query(ContractTenant, ContractPeriod, Apartment).join(
            ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
        ).join(
            Apartment, ContractPeriod.apartment_id == Apartment.id
        ).filter(
            ContractTenant.tenant_id == tenant_id,
            ContractTenant.move_out_date.is_(None),
            ContractPeriod.status == 'active'
        ).first()

        if active_contract:
            contract_tenant, contract_period, apartment = active_contract
            return {
                "id": apartment.id,
                "address": apartment.get_short_address(),
                "contract_number": contract_period.contract_number,
                "monthly_rent": float(contract_period.monthly_rent) if contract_period.monthly_rent else 0
            }

        return None

    except Exception as e:
        debug_print(f"Error getting apartment for tenant {tenant_id}: {e}")
        return None

def get_closest_tenant_names(csv_name, limit=3):
    """Get the closest matching tenant names for suggestions"""
    if not csv_name or csv_name.strip() == "":
        return []

    csv_name_clean = csv_name.strip().lower()
    tenants = Tenant.query.all()

    matches = []
    for tenant in tenants:
        if not tenant.name:
            continue

        score = SequenceMatcher(None, csv_name_clean, tenant.name.lower()).ratio()
        if score > 0.3:  # Only include reasonable matches
            # Get current apartment info
            current_apartment = get_tenant_current_apartment(tenant.id)

            matches.append({
                'id': tenant.id,
                'name': tenant.name,
                'score': score,
                'current_apartment': current_apartment
            })

    # Sort by score descending and return top matches
    matches.sort(key=lambda x: x['score'], reverse=True)
    return matches[:limit]

def get_current_apartment_for_tenant(tenant_id):
    """Get the current apartment ID for a tenant through ContractTenant relationship"""
    try:
        from datetime import date
        today = date.today()

        # Find active contract assignments for this tenant
        active_contract = db.session.query(ContractTenant).join(ContractPeriod).filter(
            ContractTenant.tenant_id == tenant_id,
            ContractTenant.move_out_date.is_(None),  # No move-out date means still active
            ContractPeriod.status == 'active'
        ).first()

        if active_contract and active_contract.contract_period:
            return active_contract.contract_period.apartment_id

        return None

    except Exception as e:
        debug_print(f"Error getting apartment for tenant {tenant_id}: {e}")
        return None

def process_csv_content(file_content):
    """Enhanced CSV processing with better date handling"""
    try:
        client = get_grok_client()
        if not client:
            return {"error": "Grok AI not configured"}

        # Get first 15 lines for better column detection
        lines = file_content.strip().split('\n')
        sample_lines = '\n'.join(lines[:15])

        debug_print("Sending to AI for column detection...")
        debug_print("Sample data:")
        debug_print(sample_lines)

        # Enhanced AI prompt for column identification
        prompt = f"""Analyze this CSV/bank statement data and identify the structure. Here are the first 15 lines:

{sample_lines}

I need you to identify these columns precisely:
1. Date column (payment/transaction/value date) - look for dates in DD.MM.YYYY, DD/MM/YYYY, or YYYY-MM-DD format
2. Name column (sender/recipient name, business name, or person who made the payment)
3. Amount column (money amount, could be positive/negative, with € symbol or decimal)
4. Reference/Description column (payment reference, memo, description, purpose)
5. Which row number contains the actual transaction data (skip headers and account info)

IMPORTANT: Look carefully at the data structure. Some CSV files have:
- Multiple header rows
- Account information at the top
- Empty rows
- Different separators (comma, semicolon, tab)

Return ONLY a JSON object with this exact structure:
{{
    "date_column": column_index_number,
    "name_column": column_index_number,
    "amount_column": column_index_number,
    "reference_column": column_index_number,
    "data_start_row": row_number_where_actual_transactions_begin,
    "delimiter": "," or ";" or "|" or "\\t"
}}

Use 0-based indexing. If a column doesn't exist, use -1.
Be very careful about the data_start_row - make sure it points to actual transaction data, not headers."""

        completion = client.chat.completions.create(
            model="grok-3-mini",
            messages=[{"role": "user", "content": prompt}],
            timeout=30
        )

        ai_response = completion.choices[0].message.content.strip()
        debug_print(f"AI column detection response: {ai_response}")

        # Clean AI response
        if ai_response.startswith('```'):
            ai_response = re.sub(r'```[json]*\n?', '', ai_response)
            ai_response = re.sub(r'\n?```', '', ai_response)

        try:
            structure = json.loads(ai_response)
        except json.JSONDecodeError:
            debug_print(f"Failed to parse AI response: {ai_response}")
            return {"error": "Failed to detect CSV structure"}

        # Validate structure
        required_fields = ['date_column', 'name_column', 'amount_column', 'data_start_row', 'delimiter']
        for field in required_fields:
            if field not in structure:
                return {"error": f"Missing required field: {field}"}

        debug_print(f"Detected structure: {structure}")

        # Parse CSV with detected structure
        delimiter = structure['delimiter']
        if delimiter == '\\t':
            delimiter = '\t'

        try:
            # Try to read with pandas first
            from io import StringIO
            csv_buffer = StringIO(file_content)

            # Read all data first to understand structure
            df = pd.read_csv(csv_buffer, delimiter=delimiter, header=None, dtype=str)
            debug_print(f"CSV shape: {df.shape}")
            debug_print(f"First few rows:\n{df.head()}")

        except Exception as e:
            debug_print(f"Pandas CSV reading failed: {e}")
            # Fallback to manual parsing
            lines = file_content.strip().split('\n')
            data_rows = []
            for line in lines[structure['data_start_row']:]:
                if line.strip():
                    row = [cell.strip().strip('"').strip("'") for cell in line.split(delimiter)]
                    data_rows.append(row)
            df = pd.DataFrame(data_rows)

        # Extract payment data starting from the detected row
        payments = []
        start_row = structure['data_start_row']

        if start_row >= len(df):
            return {"error": f"Data start row {start_row} is beyond CSV length {len(df)}"}

        for i, row in df.iloc[start_row:].iterrows():
            try:
                # Extract date with enhanced parsing
                raw_date = None
                if structure['date_column'] >= 0 and structure['date_column'] < len(row):
                    raw_date = row.iloc[structure['date_column']]

                parsed_date = parse_date_from_string(raw_date)

                # Extract name
                name = ""
                if structure['name_column'] >= 0 and structure['name_column'] < len(row):
                    name = str(row.iloc[structure['name_column']]).strip()

                # Extract amount with better number parsing
                amount = 0.0
                if structure['amount_column'] >= 0 and structure['amount_column'] < len(row):
                    amount_str = str(row.iloc[structure['amount_column']]).strip()
                    amount = parse_amount_from_string(amount_str)

                # Extract reference
                reference = ""
                if structure.get('reference_column', -1) >= 0 and structure['reference_column'] < len(row):
                    reference = str(row.iloc[structure['reference_column']]).strip()

                # Skip rows with invalid data
                if not name or amount == 0.0:
                    debug_print(f"Skipping row {i}: name='{name}', amount={amount}")
                    continue

                payments.append({
                    "date": parsed_date,
                    "name": name,
                    "amount": amount,
                    "description": reference,
                    "row_number": i + 1,
                    "raw_date": str(raw_date) if raw_date else None  # Keep for debugging
                })

            except Exception as e:
                debug_print(f"Error processing row {i}: {e}")
                continue

        debug_print(f"Successfully extracted {len(payments)} payments")

        # Log some sample payments for debugging
        for i, payment in enumerate(payments[:3]):
            debug_print(f"Payment {i+1}: date={payment['date']}, name='{payment['name']}', amount={payment['amount']}")

        return {"payments": payments}

    except Exception as e:
        debug_print(f"Error in process_csv_content: {e}")
        return {"error": str(e)}

@csv_payments_bp.route('/process-csv-simple', methods=['POST'])
@token_required
def process_csv_simple():
    """Enhanced CSV processing with automatic assignment for perfect matches"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Validate file type
        if not file.filename.lower().endswith(('.csv', '.txt')):
            return jsonify({'error': 'Please upload CSV or TXT files.'}), 400

        # Get current user ID
        current_user_id = g.user.get('id')
        if not current_user_id:
            return jsonify({'error': 'User authentication required'}), 401

        # Read file content
        try:
            file_content = file.read().decode('utf-8')
        except UnicodeDecodeError:
            try:
                file_content = file.read().decode('latin-1')
            except:
                return jsonify({'error': 'Could not decode file. Please ensure it is a valid CSV file.'}), 400

        # Process CSV content
        result = process_csv_content(file_content)

        if "error" in result:
            return jsonify(result), 400

        # Process payments with automatic assignment for perfect matches
        unassigned_transactions = []  # Only truly unassigned payments
        auto_assigned = 0
        auto_assigned_details = []

        for i, payment_data in enumerate(result["payments"]):
            # Try to find exact matching tenant
            matched_tenant, similarity_score = exact_match_tenant_name(payment_data["name"])

            if matched_tenant and similarity_score == 1.0:  # Perfect match found
                matched_apartment_id = get_current_apartment_for_tenant(matched_tenant.id)

                if matched_apartment_id:
                    # AUTO-ASSIGN: Create actual payment record immediately
                    try:
                        payment_success = create_automatic_payment_record(
                            payment_data, matched_tenant, matched_apartment_id, current_user_id
                        )

                        if payment_success:
                            auto_assigned += 1
                            auto_assigned_details.append({
                                "tenant_name": matched_tenant.name,
                                "amount": float(payment_data["amount"]),
                                "date": payment_data["date"].isoformat() if payment_data["date"] else None
                            })
                            debug_print(f"Auto-assigned: {payment_data['name']} -> {matched_tenant.name} (€{payment_data['amount']})")
                            continue  # Skip adding to unassigned table
                        else:
                            debug_print(f"Failed to auto-assign {payment_data['name']}, adding to unassigned")
                    except Exception as e:
                        debug_print(f"Error auto-assigning {payment_data['name']}: {e}")
                        # Fall through to add as unassigned

            # No perfect match or auto-assignment failed - add to unassigned table
            unassigned_payment = UnassignedPayment(
                name_from_csv=payment_data["name"][:255],
                amount=payment_data["amount"],
                payment_date=payment_data["date"],
                description=payment_data["description"][:1000] if payment_data["description"] else None,
                csv_line=payment_data.get("row_number", i + 1),
                matched_tenant_id=None,  # No auto-match for unassigned
                matched_apartment_id=None,
                similarity_score=0,  # No confident match
                status="unassigned",  # Only unassigned status now
                sender=payment_data["name"][:255],
                reference=payment_data["description"][:500] if payment_data["description"] else None,
                uploaded_by_user_id=current_user_id
            )

            db.session.add(unassigned_payment)
            db.session.flush()  # Get the ID

            # Add to unassigned list for frontend
            unassigned_transactions.append({
                "id": unassigned_payment.id,
                "date": payment_data["date"].isoformat() if payment_data["date"] else None,
                "payment_date": payment_data["date"].isoformat() if payment_data["date"] else None,
                "amount": float(payment_data["amount"]),
                "sender": payment_data["name"],
                "name_from_csv": payment_data["name"],
                "reference": payment_data["description"] or "",
                "description": payment_data["description"] or "",
                "csv_line": payment_data.get("row_number", i + 1),
                "status": "unassigned"
            })

        try:
            db.session.commit()
            debug_print(f"Successfully processed {len(result['payments'])} payments: {auto_assigned} auto-assigned, {len(unassigned_transactions)} need manual review")
        except Exception as e:
            db.session.rollback()
            debug_print(f"Database error: {e}")
            return jsonify({'error': 'Failed to store transactions in database'}), 500

        return jsonify({
            "transactions": unassigned_transactions,  # Only unassigned payments
            "auto_assigned": auto_assigned,
            "auto_assigned_details": auto_assigned_details,
            "total_processed": len(result["payments"]),
            "message": f"Processed {len(result['payments'])} payments: {auto_assigned} automatically assigned, {len(unassigned_transactions)} require manual review"
        }), 200

    except Exception as e:
        db.session.rollback()
        debug_print(f"Error in process_csv_simple: {e}")
        return jsonify({'error': str(e)}), 500


def create_automatic_payment_record(payment_data, tenant, apartment_id, current_user_id):
    """Create a payment record automatically for perfect matches"""
    try:
        # Get apartment object
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            debug_print(f"Apartment {apartment_id} not found")
            return False

        payment_date = payment_data["date"] or datetime.now().date()
        amount = float(payment_data["amount"])

        # Find current contract for this tenant and apartment
        current_contract = db.session.query(ContractPeriod).join(ContractTenant).filter(
            ContractTenant.tenant_id == tenant.id,
            ContractPeriod.apartment_id == apartment_id,
            ContractTenant.move_out_date.is_(None),
            ContractPeriod.status == 'active'
        ).first()

        # Create payment record
        tenant_data = [{
            "id": tenant.id,
            "name": tenant.name,
            "amountPaid": amount,
            "amountDue": amount,
            "paid": True
        }]

        new_payment = Payment(
            apartment_id=apartment_id,
            month=payment_date.month,
            year=payment_date.year,
            amount=amount,
            payment_date=payment_date,
            payment_method='bank_transfer',  # Default for CSV imports
            payment_type='rent',
            internet=0.0,
            electricity=0.0,
            other=0.0,
            status='paid',
            notes=f"Auto-assigned from CSV: {payment_data['name']}",
            contract_period_id=current_contract.id if current_contract else None
        )

        # Set tenants JSON field after creation
        new_payment.tenants = json.dumps(tenant_data)
        new_payment.extraPayments = "{}"

        db.session.add(new_payment)

        # Also create a record in unassigned_payments for tracking, but mark as assigned
        tracking_record = UnassignedPayment(
            name_from_csv=payment_data["name"][:255],
            amount=payment_data["amount"],
            payment_date=payment_data["date"],
            description=payment_data["description"][:1000] if payment_data["description"] else None,
            csv_line=payment_data.get("row_number", 0),
            matched_tenant_id=tenant.id,
            matched_apartment_id=apartment_id,
            similarity_score=1.0,
            status="auto_assigned",  # New status for tracking
            sender=payment_data["name"][:255],
            reference=payment_data["description"][:500] if payment_data["description"] else None,
            uploaded_by_user_id=current_user_id
        )

        db.session.add(tracking_record)

        debug_print(f"Created automatic payment record for {tenant.name} - €{amount}")
        return True

    except Exception as e:
        debug_print(f"Error creating automatic payment record: {e}")
        return False

@csv_payments_bp.route("/grok-status", methods=["GET"])
@token_required
def check_grok_status():
    """Check if Grok AI is configured and working - compatible with your component"""
    try:
        client = get_grok_client()
        if not client:
            return jsonify({
                "configured": False,
                "api_working": False,
                "fullyOperational": False,
                "message": "Grok API key not configured"
            }), 200

        # Test with a simple query
        try:
            completion = client.chat.completions.create(
                model="grok-3-mini",
                messages=[{"role": "user", "content": "Say 'ok' if you can hear me"}],
                timeout=10
            )
            api_working = "ok" in completion.choices[0].message.content.lower()
        except Exception as e:
            debug_print(f"Grok test failed: {e}")
            api_working = False

        return jsonify({
            "configured": True,
            "api_working": api_working,
            "fullyOperational": api_working,
        }), 200
    except Exception as e:
        debug_print(f"Grok status check error: {e}")
        return jsonify({"configured": False, "message": str(e)}), 500

@csv_payments_bp.route('/previous-uploads', methods=['GET'])
@token_required
def get_previous_uploads():
    """Get unassigned payments only (no auto-matched ones needing approval)"""
    try:
        # Get current user info
        current_user_id = g.user.get('id')
        if not current_user_id:
            return jsonify({'error': 'User authentication required'}), 401

        # Get pagination parameters
        page = int(request.args.get('page', 0))
        limit = int(request.args.get('limit', 50))
        offset = page * limit

        # Get filter parameters
        filter_user_id = request.args.get('user_id')
        show_all = request.args.get('show_all', 'false').lower() == 'true'

        # Determine filtering logic
        if show_all:
            user_filter = True
            debug_print(f"Admin {current_user_id} viewing all uploads from all users")
        elif filter_user_id:
            try:
                filter_user_id = int(filter_user_id)
                user_filter = (UnassignedPayment.uploaded_by_user_id == filter_user_id)
                debug_print(f"Admin {current_user_id} filtering by user {filter_user_id}")
            except ValueError:
                user_filter = (UnassignedPayment.uploaded_by_user_id == current_user_id)
                debug_print(f"Invalid user_id filter, defaulting to current user {current_user_id}")
        else:
            user_filter = (UnassignedPayment.uploaded_by_user_id == current_user_id)
            debug_print(f"Admin {current_user_id} viewing own uploads only")

        # Get summary counts for all statuses
        summary_query = db.session.query(
            UnassignedPayment.status,
            func.count(UnassignedPayment.id).label('count'),
            func.sum(UnassignedPayment.amount).label('total_amount')
        )

        if user_filter is not True:
            summary_query = summary_query.filter(user_filter)

        summary = summary_query.group_by(UnassignedPayment.status).all()

        summary_dict = {}
        for status, count, total_amount in summary:
            summary_dict[status] = {
                "count": count,
                "total_amount": float(total_amount) if total_amount else 0.0
            }

        # Get only UNASSIGNED payments for manual review
        base_query = UnassignedPayment.query.filter(
            UnassignedPayment.status == 'unassigned'  # Only truly unassigned
        )

        if user_filter is not True:
            base_query = base_query.filter(user_filter)

        base_query = base_query.order_by(desc(UnassignedPayment.created_at))

        # Get total counts for pagination
        total_items = base_query.count()
        paginated_payments = base_query.offset(offset).limit(limit).all()

        def format_payment(payment):
            formatted = {
                "id": payment.id,
                "name_from_csv": payment.name_from_csv,
                "amount": float(payment.amount),
                "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
                "description": payment.description,
                "csv_line": payment.csv_line,
                "status": payment.status,
                "created_at": payment.created_at.isoformat() if hasattr(payment, 'created_at') and payment.created_at else None
            }

            # Include upload user info
            if hasattr(payment, 'uploaded_by_user_id'):
                formatted["uploaded_by_user_id"] = payment.uploaded_by_user_id
                if payment.uploaded_by_user_id:
                    try:
                        from models.models import User
                        user = User.query.get(payment.uploaded_by_user_id)
                        formatted["uploaded_by_username"] = user.username if user else "Unknown"
                    except:
                        formatted["uploaded_by_username"] = "Unknown"
                else:
                    formatted["uploaded_by_username"] = "Legacy (Pre-tracking)"

            return formatted

        # Get uploaders list
        uploaders_query = db.session.query(
            UnassignedPayment.uploaded_by_user_id,
            func.count(UnassignedPayment.id).label('upload_count')
        ).group_by(UnassignedPayment.uploaded_by_user_id).all()

        uploaders = []
        for uploader_id, count in uploaders_query:
            if uploader_id:
                try:
                    from models.models import User
                    user = User.query.get(uploader_id)
                    uploaders.append({
                        "user_id": uploader_id,
                        "username": user.username if user else "Unknown",
                        "upload_count": count
                    })
                except:
                    uploaders.append({
                        "user_id": uploader_id,
                        "username": "Unknown",
                        "upload_count": count
                    })
            else:
                uploaders.append({
                    "user_id": None,
                    "username": "Legacy (Pre-tracking)",
                    "upload_count": count
                })

        unassigned_payments = [format_payment(p) for p in paginated_payments]

        return jsonify({
            "summary": summary_dict,
            "unassigned": unassigned_payments,
            "matched": [],  # No longer needed - auto-assigned payments don't appear here
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": total_items,
                "total_pages": (total_items + limit - 1) // limit if limit > 0 else 1,
                "has_next": offset + limit < total_items,
                "has_prev": page > 0
            },
            "uploaders": uploaders,
            "current_filter": {
                "user_id": filter_user_id,
                "show_all": show_all
            }
        }), 200

    except Exception as e:
        debug_print(f"Error getting previous uploads: {e}")
        return jsonify({'error': str(e)}), 500

@csv_payments_bp.route('/uploaders', methods=['GET'])
@token_required
def get_uploaders():
    """Get list of all users who have uploaded CSV payments (for admin filtering)"""
    try:
        # FIXED: Use correct SQLAlchemy case syntax
        uploaders_query = db.session.query(
            UnassignedPayment.uploaded_by_user_id,
            func.count(UnassignedPayment.id).label('total_uploads'),
            func.sum(case((UnassignedPayment.status == 'unassigned', 1), else_=0)).label('unassigned_count'),
            func.sum(case((UnassignedPayment.status == 'matched', 1), else_=0)).label('matched_count'),
            func.sum(case((UnassignedPayment.status == 'assigned', 1), else_=0)).label('assigned_count'),
            func.sum(case((UnassignedPayment.status == 'rejected', 1), else_=0)).label('rejected_count')
        ).group_by(UnassignedPayment.uploaded_by_user_id).all()

        uploaders = []
        for uploader_id, total, unassigned, matched, assigned, rejected in uploaders_query:
            if uploader_id:
                try:
                    from models.models import User
                    user = User.query.get(uploader_id)
                    uploaders.append({
                        "user_id": uploader_id,
                        "username": user.username if user else "Unknown",
                        "total_uploads": total,
                        "unassigned_count": unassigned or 0,
                        "matched_count": matched or 0,
                        "assigned_count": assigned or 0,
                        "rejected_count": rejected or 0
                    })
                except:
                    uploaders.append({
                        "user_id": uploader_id,
                        "username": "Unknown",
                        "total_uploads": total,
                        "unassigned_count": unassigned or 0,
                        "matched_count": matched or 0,
                        "assigned_count": assigned or 0,
                        "rejected_count": rejected or 0
                    })
            else:
                uploaders.append({
                    "user_id": None,
                    "username": "Legacy (Pre-tracking)",
                    "total_uploads": total,
                    "unassigned_count": unassigned or 0,
                    "matched_count": matched or 0,
                    "assigned_count": assigned or 0,
                    "rejected_count": rejected or 0
                })

        return jsonify({"uploaders": uploaders}), 200

    except Exception as e:
        debug_print(f"Error getting uploaders: {e}")
        return jsonify({'error': str(e)}), 500

@csv_payments_bp.route('/suggest-tenants/<int:payment_id>', methods=['GET'])
@token_required
def suggest_tenants(payment_id):
    """Get closest tenant name suggestions for a payment"""
    try:
        current_user_id = g.user.get('id')
        if not current_user_id:
            return jsonify({'error': 'User authentication required'}), 401

        # Admins can access any payment
        payment = UnassignedPayment.query.get(payment_id)

        if not payment:
            return jsonify({'error': 'Payment not found'}), 404

        suggestions = get_closest_tenant_names(payment.name_from_csv, limit=3)

        return jsonify({
            "suggestions": suggestions,
            "original_name": payment.name_from_csv
        }), 200

    except Exception as e:
        debug_print(f"Error getting tenant suggestions: {e}")
        return jsonify({'error': str(e)}), 500

@csv_payments_bp.route('/assign/<int:payment_id>', methods=['POST'])
@token_required
def assign_previous_payment(payment_id):
    """Assign a previous upload payment to a tenant and apartment with full details"""
    try:
        data = request.get_json()
        tenant_id = data.get('tenant_id')
        apartment_id = data.get('apartment_id')
        custom_amount = data.get('amount')  # Allow custom amount
        custom_date = data.get('payment_date')  # Allow custom date
        notes = data.get('notes', '')
        payment_method = data.get('payment_method', 'bank_transfer')

        # Get current user info
        current_user_id = g.user.get('id')

        if not current_user_id:
            return jsonify({"success": False, "error": "User authentication required"}), 401

        if not tenant_id or not apartment_id:
            return jsonify({"success": False, "error": "Missing tenant_id or apartment_id"}), 400

        # Get the unassigned payment (admins can access any payment)
        payment = UnassignedPayment.query.get(payment_id)

        if not payment:
            return jsonify({"success": False, "error": "Payment not found"}), 404

        # Validate tenant and apartment exist
        tenant = Tenant.query.get(tenant_id)
        apartment = Apartment.query.get(apartment_id)

        if not tenant or not apartment:
            return jsonify({"success": False, "error": "Tenant or apartment not found"}), 404

        # Use custom amount if provided, otherwise use original amount
        final_amount = float(custom_amount) if custom_amount else float(payment.amount)

        # Use custom date if provided, otherwise use original date
        if custom_date:
            try:
                final_date = datetime.strptime(custom_date, '%Y-%m-%d').date()
            except ValueError:
                final_date = payment.payment_date or datetime.now().date()
        else:
            final_date = payment.payment_date or datetime.now().date()

        # Find current contract for this tenant and apartment
        current_contract = db.session.query(ContractPeriod).join(ContractTenant).filter(
            ContractTenant.tenant_id == tenant_id,
            ContractPeriod.apartment_id == apartment_id,
            ContractTenant.move_out_date.is_(None),
            ContractPeriod.status == 'active'
        ).first()

        # Create payment record using correct Payment model structure
        tenant_data = [{
            "id": tenant.id,
            "name": tenant.name,
            "amountPaid": final_amount,
            "amountDue": final_amount,
            "paid": True
        }]

        # Create unique month identifier
        month_identifier = f"csv_{payment.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Create Payment with correct fields (no 'tenants' parameter in constructor)
        new_payment = Payment(
            apartment_id=apartment_id,
            month=final_date.month,
            year=final_date.year,
            amount=final_amount,
            payment_date=final_date,
            payment_method=payment_method,
            payment_type='rent',
            internet=0.0,
            electricity=0.0,
            other=0.0,
            status='paid',
            notes=notes or f"CSV import: {payment.name_from_csv}",
            contract_period_id=current_contract.id if current_contract else None
        )

        # Set tenants JSON field after creation
        new_payment.tenants = json.dumps(tenant_data)
        new_payment.extraPayments = "{}"

        db.session.add(new_payment)

        # Update unassigned payment status
        payment.status = 'assigned'
        payment.matched_tenant_id = tenant_id
        payment.matched_apartment_id = apartment_id

        db.session.commit()

        debug_print(f"Successfully assigned payment {payment_id} to {tenant.name} in apartment {apartment_id}")

        return jsonify({
            "success": True,
            "message": f"Payment assigned to {tenant.name}",
            "payment_id": new_payment.id,
            "amount": final_amount,
            "date": final_date.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        debug_print(f"Error assigning payment {payment_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@csv_payments_bp.route('/tenants/search', methods=['GET'])
@token_required
def search_tenants():
    """Search tenants with their current apartment info"""
    try:
        query = request.args.get('query', '').strip()
        limit = min(int(request.args.get('limit', 20)), 50)  # Max 50 results

        if not query or len(query) < 2:
            return jsonify([]), 200

        # Search tenants by name (case-insensitive, partial match)
        tenants = db.session.query(Tenant).filter(
            Tenant.name.ilike(f'%{query}%')
        ).limit(limit).all()

        results = []
        for tenant in tenants:
            # Find current apartment through active contract
            current_apartment = get_tenant_current_apartment(tenant.id)

            results.append({
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "current_apartment": current_apartment
            })

        debug_print(f"Found {len(results)} tenants matching '{query}'")
        return jsonify(results), 200

    except Exception as e:
        debug_print(f"Error searching tenants: {e}")
        return jsonify({"error": str(e)}), 500

@csv_payments_bp.route('/apartments/search', methods=['GET'])
@token_required
def search_apartments():
    """Search apartments with current tenant info"""
    try:
        query = request.args.get('query', '').strip()
        limit = min(int(request.args.get('limit', 20)), 50)  # Max 50 results

        if not query or len(query) < 2:
            return jsonify([]), 200

        # Search apartments by address (case-insensitive, partial match)
        apartments = Apartment.query.filter(
            Apartment.address.ilike(f'%{query}%')
        ).limit(limit).all()

        results = []
        for apartment in apartments:
            # Get current tenants
            current_tenants = db.session.query(Tenant).join(ContractTenant).join(ContractPeriod).filter(
                ContractPeriod.apartment_id == apartment.id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).all()

            tenant_names = [tenant.name for tenant in current_tenants]

            results.append({
                "id": apartment.id,
                "address": apartment.get_short_address(),
                "rent": float(apartment.rent) if apartment.rent else 0,
                "rooms": apartment.rooms,
                "current_tenants": tenant_names,
                "tenant_count": len(current_tenants)
            })

        debug_print(f"Found {len(results)} apartments matching '{query}'")
        return jsonify(results), 200

    except Exception as e:
        debug_print(f"Error searching apartments: {e}")
        return jsonify({"error": str(e)}), 500

@csv_payments_bp.route('/reject/<int:payment_id>', methods=['POST'])
@token_required
def reject_previous_payment(payment_id):
    """Reject a previous upload payment - alternative endpoint naming"""
    return reject_payment(payment_id)

@csv_payments_bp.route('/previous-uploads/<int:payment_id>/reject', methods=['POST'])
@token_required
def reject_payment(payment_id):
    """Reject an unassigned payment"""
    try:
        current_user_id = g.user.get('id')
        if not current_user_id:
            return jsonify({"success": False, "error": "User authentication required"}), 401

        # Admins can reject any payment
        payment = UnassignedPayment.query.get(payment_id)

        if not payment:
            return jsonify({"success": False, "error": "Payment not found"}), 404

        payment.status = 'rejected'
        db.session.commit()

        debug_print(f"Payment {payment_id} rejected by user {current_user_id}")

        return jsonify({"success": True, "message": "Payment rejected successfully"}), 200

    except Exception as e:
        db.session.rollback()
        debug_print(f"Error rejecting payment {payment_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
