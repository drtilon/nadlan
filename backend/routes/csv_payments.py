import os
import json
import tempfile
import time
import re
import sys
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from .auth import token_required, role_required
from models.models import Tenant, Apartment, Payment
from extentions import db
from openai import OpenAI
from activity_logger import ActivityLogger

# Set up logging for immediate output
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

# Configuration
ALLOWED_EXTENSIONS = {'csv', 'txt'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
CHUNK_SIZE = 100

def debug_print(message):
    """Print with immediate flush for Docker/Flask development"""
    print(message, flush=True)
    sys.stdout.flush()
    logger.info(message)



def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_temp_results_file():
    """Create a temporary file to store processing results"""
    temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.json')
    initial_data = {
        "processed_chunks": 0,
        "total_chunks": 0,
        "rent_payments": [],
        "processing_complete": False,
        "error": None,
        "original_transactions": [],
        "csv_structure": {},
        "start_time": time.time()
    }
    json.dump(initial_data, temp_file)
    temp_file.close()
    debug_print(f"Created temp file: {temp_file.name}")
    return temp_file.name

def update_temp_results_file(temp_file_path, chunk_results, chunk_number, total_chunks, complete=False, error=None):
    """Update the temporary results file with new chunk results"""
    try:
        # Read existing data
        with open(temp_file_path, 'r') as f:
            data = json.load(f)

        # Update data
        data["processed_chunks"] = chunk_number
        data["total_chunks"] = total_chunks
        data["rent_payments"].extend(chunk_results)
        data["processing_complete"] = complete
        if error:
            data["error"] = str(error)

        # Write back
        with open(temp_file_path, 'w') as f:
            json.dump(data, f)

        debug_print(f"Updated temp file: chunk {chunk_number}/{total_chunks}, {len(chunk_results)} new payments")
        return True
    except Exception as e:
        debug_print(f"Error updating temp file: {e}")
        return False

def read_temp_results_file(temp_file_path):
    """Read the current state from temporary results file"""
    try:
        with open(temp_file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        debug_print(f"Error reading temp file: {e}")
        return None

def store_original_transactions(temp_file_path, transactions, csv_structure):
    """Store the original transactions and structure in temp file"""
    try:
        with open(temp_file_path, 'r') as f:
            data = json.load(f)

        data["original_transactions"] = transactions
        data["csv_structure"] = csv_structure

        with open(temp_file_path, 'w') as f:
            json.dump(data, f)

        debug_print(f"Stored {len(transactions)} transactions in temp file")
        return True
    except Exception as e:
        debug_print(f"Error storing transactions: {e}")
        return False

@csv_payments_bp.route("/grok-status", methods=["GET"])
@token_required
def check_grok_status():
    """Check if Grok AI is configured and working"""
    try:
        client = get_grok_client()
        if not client:
            return jsonify({"configured": False, "message": "Grok API key not configured"}), 200

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
        }), 200
    except Exception as e:
        debug_print(f"Grok status check error: {e}")
        return jsonify({"configured": False, "message": str(e)}), 500

@csv_payments_bp.route("/process-csv-simple", methods=["POST"])
@token_required
@role_required("admin")
def process_csv_simple():
    """
    Modified version that uses AI only once for CSV structure detection,
    then returns all positive transactions to frontend
    """
    try:
        debug_print("Starting CSV processing...")

        client = get_grok_client()
        if not client:
            debug_print("Grok AI not configured")
            return jsonify({"message": "Grok AI not configured"}), 500

        if 'file' not in request.files:
            debug_print("No file provided in request")
            return jsonify({"message": "No file provided"}), 400

        file = request.files['file']
        if not file:
            debug_print("No file selected")
            return jsonify({"message": "No file selected"}), 400

        debug_print(f"Processing file: {file.filename}")

        # Read file
        try:
            csv_content = file.read().decode('utf-8')
            debug_print("File decoded as UTF-8")
        except:
            file.seek(0)
            csv_content = file.read().decode('latin-1')
            debug_print("File decoded as latin-1")

        # Count lines for information
        line_count = len(csv_content.strip().split('\n'))
        debug_print(f"CSV has {line_count} lines")

        # Process with single AI call
        return process_csv_structure_only(csv_content, client)

    except Exception as e:
        debug_print(f"ERROR in process_csv_simple: {e}")
        return jsonify({"message": str(e)}), 500

def process_csv_structure_only(csv_content, client):
    """
    Process CSV using AI only for structure detection,
    then return all positive transactions without AI analysis
    """
    try:
        # Get first 10 lines for column detection
        lines = csv_content.strip().split('\n')
        first_10_lines = '\n'.join(lines[:10])

        debug_print("=" * 50)
        debug_print("DETECTING CSV STRUCTURE (SINGLE AI CALL)...")
        debug_print(first_10_lines)
        debug_print("=" * 50)

        # SINGLE AI CALL - Only for structure detection
        prompt = f"""Look at these first 10 lines of a CSV file and tell me:
1. Which row number (0-based) contains the actual data (not headers or account info)
2. Which column numbers contain:
   - Date
   - Name/Description (person or company name)
   - Amount (money amount)
   - Extra notes/reference (optional, use -1 if none)

First 10 lines:
{first_10_lines}

Return ONLY a JSON array: [data_start_row, date_column, name_column, amount_column, notes_column]
Use 0-based indexing.

Example: [4, 0, 2, 4, 5] means data starts at row 4, date in column 0, name in column 2, etc."""

        debug_print("Sending structure detection prompt to AI...")

        completion = client.chat.completions.create(
            model="grok-3-mini",
            messages=[{"role": "user", "content": prompt}],
            timeout=120
        )

        ai_response = completion.choices[0].message.content.strip()
        debug_print(f"AI structure response: {ai_response}")

        # Clean and parse response
        if ai_response.startswith('```'):
            ai_response = re.sub(r'```[json]*\n?', '', ai_response).strip()

        result = json.loads(ai_response)

        if len(result) < 4:
            debug_print("AI response incomplete")
            return jsonify({"message": "AI response incomplete"}), 400

        data_start_row = result[0]
        date_col = result[1]
        name_col = result[2]
        amount_col = result[3]
        notes_col = result[4] if len(result) > 4 else -1

        csv_structure = {
            "data_start_row": data_start_row,
            "date_col": date_col,
            "name_col": name_col,
            "amount_col": amount_col,
            "notes_col": notes_col
        }

        debug_print(f"CSV STRUCTURE DETECTED:")
        debug_print(f"DATA STARTS AT ROW: {data_start_row}")
        debug_print(f"DATE COLUMN: {date_col}")
        debug_print(f"NAME COLUMN: {name_col}")
        debug_print(f"AMOUNT COLUMN: {amount_col}")
        debug_print(f"NOTES COLUMN: {notes_col}")

        if data_start_row == -1 or date_col == -1 or name_col == -1 or amount_col == -1:
            debug_print("Could not detect required columns")
            return jsonify({"message": "Could not detect required columns in CSV"}), 400

        # Parse all data and filter positive amounts - NO MORE AI CALLS
        all_lines = csv_content.strip().split('\n')
        data_lines = all_lines[data_start_row:]

        debug_print(f"Total lines in CSV: {len(all_lines)}")
        debug_print(f"Data lines to process: {len(data_lines)}")

        positive_transactions = []

        # Detect delimiter by checking the first data line
        if data_lines:
            delimiters = [',', ';', '\t', '|']
            best_delimiter = ','
            max_columns = 0

            for delimiter in delimiters:
                columns = data_lines[0].split(delimiter)
                if len(columns) > max_columns:
                    max_columns = len(columns)
                    best_delimiter = delimiter

            debug_print(f"Detected delimiter: '{best_delimiter}' (found {max_columns} columns)")

        # Parse all transactions and return positive ones
        for line_index, line in enumerate(data_lines):
            try:
                columns = line.split(best_delimiter)
                columns = [col.strip().strip('"') for col in columns]

                if len(columns) <= amount_col:
                    debug_print(f"Line {line_index}: Not enough columns ({len(columns)} <= {amount_col})")
                    continue

                amount_str = columns[amount_col].strip()
                debug_print(f"Line {line_index}: Raw amount string: '{amount_str}'")

                # Handle different number formats
                clean_amount = amount_str

                # Remove currency symbols and spaces
                clean_amount = re.sub(r'[€$£¥\s]', '', clean_amount)

                # Handle European vs US number formats
                if ',' in clean_amount and '.' in clean_amount:
                    # Both comma and dot present - determine which is decimal separator
                    comma_pos = clean_amount.rindex(',')
                    dot_pos = clean_amount.rindex('.')

                    if comma_pos > dot_pos:
                        # European format: 1.234.567,89 (dot=thousands, comma=decimal)
                        clean_amount = clean_amount.replace('.', '').replace(',', '.')
                    else:
                        # US format: 1,234,567.89 (comma=thousands, dot=decimal)
                        clean_amount = clean_amount.replace(',', '')
                elif ',' in clean_amount:
                    # Only comma present
                    if clean_amount.count(',') == 1 and len(clean_amount.split(',')[1]) <= 2:
                        # Likely decimal separator: 123,45
                        clean_amount = clean_amount.replace(',', '.')
                    else:
                        # Likely thousands separator: 1,234 or 12,345
                        clean_amount = clean_amount.replace(',', '')
                elif '.' in clean_amount:
                    # Only dot present - could be thousands or decimal separator
                    dot_parts = clean_amount.split('.')
                    if len(dot_parts) == 2:
                        # One dot - check if it's thousands or decimal
                        if len(dot_parts[1]) == 3 and dot_parts[1].isdigit():
                            # Likely thousands separator: 1.600 = 1600
                            clean_amount = clean_amount.replace('.', '')
                        # else: assume decimal separator: 123.45 stays as is
                    else:
                        # Multiple dots - thousands separators: 1.234.567
                        clean_amount = clean_amount.replace('.', '')

                # Remove any remaining non-numeric characters except decimal point and minus
                clean_amount = re.sub(r'[^\d.-]', '', clean_amount)

                if not clean_amount or clean_amount == '.' or clean_amount == '-':
                    debug_print(f"Line {line_index}: Empty or invalid amount after cleaning")
                    continue

                try:
                    amount = float(clean_amount)
                    debug_print(f"Line {line_index}: Parsed amount: {amount}")
                except ValueError as ve:
                    debug_print(f"Line {line_index}: Failed to parse amount '{clean_amount}': {ve}")
                    continue

                # Only include positive amounts (incoming transactions)
                if amount > 0:
                    date_value = columns[date_col].strip() if date_col < len(columns) else ""
                    name_value = columns[name_col].strip() if name_col < len(columns) else ""
                    notes_value = columns[notes_col].strip() if notes_col != -1 and notes_col < len(columns) else ""

                    transaction = {
                        "date": date_value,
                        "sender": name_value,
                        "amount": amount,
                        "reference": notes_value,
                        "csv_line": data_start_row + line_index,
                        "data_index": line_index,
                        "full_row": columns
                    }

                    positive_transactions.append(transaction)
                    debug_print(f"Line {line_index}: Added positive transaction: {name_value} - €{amount}")

            except Exception as e:
                debug_print(f"Error parsing line {line_index}: {e}")
                continue

        debug_print(f"FOUND {len(positive_transactions)} POSITIVE TRANSACTIONS")

        if len(positive_transactions) == 0:
            return jsonify({
                "message": "No positive amounts found - all transactions appear to be outgoing",
                "summary": {
                    "file_size_mb": round(len(csv_content) / (1024 * 1024), 2),
                    "total_positive_transactions": 0,
                    "auto_inserted_count": 0,
                    "auto_inserted_amount": 0.0,
                    "manual_review_count": 0,
                    "manual_review_amount": 0.0,
                    "api_calls_made": 1,
                    "processing_method": "structure_only"
                },
                "auto_inserted_payments": [],
                "manual_review_transactions": [],
                "auto_insert_errors": []
            }), 200

        # Calculate total amount
        total_amount = sum(t['amount'] for t in positive_transactions)

        debug_print(f"Total amount of positive transactions: €{total_amount}")

        # Return all positive transactions for frontend to handle
        return jsonify({
            "message": f"Found {len(positive_transactions)} positive transactions",
            "summary": {
                "file_size_mb": round(len(csv_content) / (1024 * 1024), 2),
                "total_positive_transactions": len(positive_transactions),
                "auto_inserted_count": 0,
                "auto_inserted_amount": 0.0,
                "manual_review_count": len(positive_transactions),
                "manual_review_amount": total_amount,
                "api_calls_made": 1,  # Only one AI call for structure detection
                "processing_method": "structure_only"
            },
            "csv_structure": csv_structure,
            "auto_inserted_payments": [],
            "manual_review_transactions": positive_transactions,  # All positive transactions
            "auto_insert_errors": []
        }), 200

    except Exception as e:
        debug_print(f"ERROR in structure-only processing: {e}")
        return jsonify({"message": str(e)}), 500

# Keep the old chunked processing for backward compatibility if needed
@csv_payments_bp.route("/process-csv-chunked", methods=["POST"])
@token_required
@role_required("admin")
def process_csv_chunked():
    """Start chunked processing for large files (legacy - now uses structure-only approach)"""
    try:
        debug_print("Chunked processing endpoint called - redirecting to structure-only processing...")

        client = get_grok_client()
        if not client:
            return jsonify({"message": "Grok AI not configured"}), 500

        if 'file' not in request.files:
            return jsonify({"message": "No file provided"}), 400

        file = request.files['file']
        if not file:
            return jsonify({"message": "No file selected"}), 400

        debug_print(f"Processing large file: {file.filename}")

        # Read file
        try:
            csv_content = file.read().decode('utf-8')
        except:
            file.seek(0)
            csv_content = file.read().decode('latin-1')

        # Use the same structure-only processing
        return process_csv_structure_only(csv_content, client)

    except Exception as e:
        debug_print(f"ERROR in chunked processing: {e}")
        return jsonify({"message": str(e)}), 500

@csv_payments_bp.route("/process-chunk/<temp_file_id>/<int:chunk_number>", methods=["POST"])
@token_required
@role_required("admin")
def process_chunk(temp_file_id, chunk_number):
    """Legacy endpoint - no longer needed with structure-only approach"""
    return jsonify({
        "message": "Chunk processing is no longer needed. All transactions are processed immediately.",
        "chunk_processed": chunk_number + 1,
        "rent_payments_found": 0,
        "chunk_results": [],
        "processing_complete": True
    }), 200

@csv_payments_bp.route("/get-results/<temp_file_id>", methods=["GET"])
@token_required
def get_processing_results(temp_file_id):
    """Legacy endpoint for getting processing results"""
    return jsonify({
        "message": "Results are now returned immediately from the main processing endpoint",
        "summary": {
            "total_transactions_found": 0,
            "total_amount": 0.0,
            "processing_complete": True
        },
        "rent_payments": [],
        "processing_complete": True
    }), 200

@csv_payments_bp.route("/manual-assign-payment", methods=["POST"])
@token_required
@role_required("admin")
def manual_assign_payment():
    """Manually assign a CSV transaction to a tenant and apartment"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Extract transaction and assignment data
        transaction_data = data.get('transaction_data', {})
        assignment_data = data.get('assignment_data', {})

        debug_print(f"Manual assignment request: {data}")

        # Validate required fields
        required_transaction_fields = ['csv_line', 'sender', 'original_amount', 'date']
        required_assignment_fields = ['tenant_id', 'apartment_id', 'amount', 'payment_date']

        for field in required_transaction_fields:
            if field not in transaction_data:
                return jsonify({"message": f"Missing required transaction field: {field}"}), 400

        for field in required_assignment_fields:
            if field not in assignment_data:
                return jsonify({"message": f"Missing required assignment field: {field}"}), 400

        # Validate that tenant and apartment exist
        tenant_id = assignment_data['tenant_id']
        apartment_id = assignment_data['apartment_id']

        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Parse payment date
        payment_date_str = assignment_data['payment_date']
        try:
            payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({"message": "Invalid payment date format. Use YYYY-MM-DD"}), 400

        # Extract payment details
        amount = float(assignment_data['amount'])
        notes = assignment_data.get('notes', f"CSV Import - Line {transaction_data['csv_line']}")

        # Create unique month identifier for CSV payments
        month_identifier = f"csv_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Create tenant data structure
        tenant_data = [{
            "id": tenant.id,
            "name": tenant.name,
            "amountPaid": amount,
            "amountDue": amount,
            "paid": True
        }]

        # Create new payment record
        new_payment = Payment(
            apartment_id=apartment_id,
            month=month_identifier,
            year=payment_date.year,
            status='paid',
            tenants=json.dumps(tenant_data),
            internet=0.0,
            electricity=0.0,
            other=0.0,
            extraPayments="{}",
            paymentDate=payment_date,
            paymentMethod='bank_transfer',
            notes=notes,
            updated_at=datetime.utcnow()
        )

        db.session.add(new_payment)
        db.session.commit()

        debug_print(f"Successfully created payment record for tenant {tenant.name} - €{amount}")

        return jsonify({
            "message": "Payment successfully assigned and recorded",
            "payment_id": new_payment.id,
            "tenant_name": tenant.name,
            "apartment_address": apartment.address,
            "amount": amount,
            "payment_date": payment_date.strftime('%Y-%m-%d')
        }), 201

    except Exception as e:
        db.session.rollback()
        debug_print(f"ERROR in manual assignment: {e}")
        return jsonify({"message": str(e)}), 500

@csv_payments_bp.route("/test", methods=["GET"])
def test_endpoint():
    """Test endpoint to verify blueprint is working"""
    return jsonify({"message": "CSV Payments API is working!", "timestamp": datetime.now().isoformat()}), 200

@csv_payments_bp.route("/tenants", methods=["GET"])
@token_required
def get_tenants():
    """Get all tenants for assignment dropdown"""
    try:
        tenants = Tenant.query.all()
        tenant_list = []
        for tenant in tenants:
            tenant_data = {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "apartment_id": tenant.apartment_id,
                "apartment_address": tenant.apartment.address if tenant.apartment else "No apartment"
            }
            tenant_list.append(tenant_data)

        debug_print(f"Retrieved {len(tenant_list)} tenants")
        return jsonify(tenant_list), 200
    except Exception as e:
        debug_print(f"Error getting tenants: {e}")
        return jsonify({"message": str(e)}), 500

@csv_payments_bp.route("/apartments", methods=["GET"])
@token_required
def get_apartments():
    """Get all apartments for assignment dropdown"""
    try:
        apartments = Apartment.query.all()
        apartment_list = []
        for apartment in apartments:
            apartment_data = {
                "id": apartment.id,
                "address": apartment.address,
                "rent": apartment.rent,
                "rooms": apartment.rooms,
                "status": apartment.status
            }
            apartment_list.append(apartment_data)

        debug_print(f"Retrieved {len(apartment_list)} apartments")
        return jsonify(apartment_list), 200
    except Exception as e:
        debug_print(f"Error getting apartments: {e}")
        return jsonify({"message": str(e)}), 500
