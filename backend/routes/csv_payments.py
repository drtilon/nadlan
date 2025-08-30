import os
import json
import sys
import logging
import re
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from .auth import token_required, role_required
from models.models import Tenant, Apartment, Payment, UnassignedPayment, ContractTenant, ContractPeriod
from extentions import db
from openai import OpenAI
from activity_logger import ActivityLogger
# Removed fuzzywuzzy - using exact matching instead
from sqlalchemy import func

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

def create_unassigned_payments_table():
    """Create the unassigned_payments table if it doesn't exist"""
    try:
        db.create_all()
        debug_print("Ensured unassigned_payments table exists")
    except Exception as e:
        debug_print(f"Error creating tables: {e}")

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
    """Process CSV content using AI to identify columns and extract payment data"""
    try:
        client = get_grok_client()
        if not client:
            return {"error": "Grok AI not configured"}

        # Get first 10 lines for column detection
        lines = file_content.strip().split('\n')
        sample_lines = '\n'.join(lines[:10])

        debug_print("Sending to AI for column detection...")
        debug_print("Sample data:")
        debug_print(sample_lines)

        # AI prompt for column identification
        prompt = f"""Analyze this CSV data and identify the structure. Here are the first 10 lines:

{sample_lines}

I need you to identify:
1. Date column (payment/transaction date)
2. Name column (person or business name who SENT the payment)
3. Amount column (money amount)
4. Reference column (additional details, memo, or reference)
5. Which row number contains the actual data (not headers or account info)

Return ONLY a JSON object with this exact structure:
{{
    "date_column": column_index_number,
    "name_column": column_index_number,
    "amount_column": column_index_number,
    "reference_column": column_index_number,
    "data_start_row": row_number_where_data_begins,
    "delimiter": "," or ";" or "|" or "\\t"
}}

Use 0-based indexing. If a column doesn't exist, use -1."""

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
            ai_response = ai_response.replace('```', '').strip()

        try:
            column_info = json.loads(ai_response)
        except json.JSONDecodeError as e:
            debug_print(f"Failed to parse AI response: {e}")
            return {"error": "AI response could not be parsed"}

        # Validate required columns
        if (column_info.get("date_column", -1) == -1 or
            column_info.get("name_column", -1) == -1 or
            column_info.get("amount_column", -1) == -1):
            return {"error": "Could not identify required columns (date, name, amount)"}

        # Extract column indices
        date_col = column_info["date_column"]
        name_col = column_info["name_column"]
        amount_col = column_info["amount_column"]
        reference_col = column_info.get("reference_column", -1)
        data_start_row = column_info.get("data_start_row", 1)
        delimiter = column_info.get("delimiter", ",")

        if delimiter == "\\t":
            delimiter = "\t"

        debug_print(f"Column mapping: date={date_col}, name={name_col}, amount={amount_col}, ref={reference_col}")
        debug_print(f"Data starts at row {data_start_row}, delimiter='{delimiter}'")

        # Process the actual data
        data_lines = lines[data_start_row:]
        payments = []

        for i, line in enumerate(data_lines):
            try:
                if delimiter == "\t":
                    columns = line.split('\t')
                else:
                    columns = line.split(delimiter)

                # Clean columns
                columns = [col.strip().strip('"') for col in columns]

                if len(columns) <= max(date_col, name_col, amount_col):
                    continue

                # Extract data
                date_str = columns[date_col] if date_col < len(columns) else ""
                name_str = columns[name_col] if name_col < len(columns) else ""
                amount_str = columns[amount_col] if amount_col < len(columns) else ""
                reference_str = columns[reference_col] if reference_col != -1 and reference_col < len(columns) else ""

                # Parse amount
                if not amount_str:
                    continue

                # Clean amount string for parsing
                clean_amount = re.sub(r'[€$£¥\s]', '', amount_str)

                # Handle different number formats
                if ',' in clean_amount and '.' in clean_amount:
                    # Both comma and dot - determine decimal separator
                    if clean_amount.rindex(',') > clean_amount.rindex('.'):
                        # European format: 1.234.567,89
                        clean_amount = clean_amount.replace('.', '').replace(',', '.')
                    else:
                        # US format: 1,234,567.89
                        clean_amount = clean_amount.replace(',', '')
                elif ',' in clean_amount:
                    # Only comma - could be decimal or thousands
                    if clean_amount.count(',') == 1 and len(clean_amount.split(',')[1]) <= 2:
                        clean_amount = clean_amount.replace(',', '.')
                    else:
                        clean_amount = clean_amount.replace(',', '')

                # Remove any remaining non-numeric chars except decimal and minus
                clean_amount = re.sub(r'[^\d.-]', '', clean_amount)

                try:
                    amount = float(clean_amount)
                except ValueError:
                    debug_print(f"Could not parse amount: '{amount_str}' -> '{clean_amount}'")
                    continue

                # Only process positive amounts (incoming payments) - FILTER OUT NEGATIVE
                if amount > 0:
                    # Parse date
                    payment_date = None
                    if date_str:
                        # Try different date formats
                        date_formats = ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d.%m.%Y', '%d-%m-%Y', '%Y/%m/%d']
                        for fmt in date_formats:
                            try:
                                payment_date = datetime.strptime(date_str, fmt).date()
                                break
                            except ValueError:
                                continue

                    payments.append({
                        "name": name_str,
                        "amount": amount,
                        "date": payment_date,
                        "description": reference_str,
                        "row_number": data_start_row + i + 1
                    })

                    debug_print(f"Added payment: {name_str} - €{amount}")
                else:
                    debug_print(f"Skipped negative amount: {name_str} - €{amount}")

            except Exception as e:
                debug_print(f"Error processing line {i}: {e}")
                continue

        debug_print(f"Successfully processed {len(payments)} positive transactions (filtered out negative amounts)")

        return {"payments": payments}

    except Exception as e:
        debug_print(f"Error in process_csv_content: {e}")
        return {"error": str(e)}

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

@csv_payments_bp.route('/process-csv-simple', methods=['POST'])
@token_required
def process_csv_simple():
    """
    Process CSV file and return transactions for manual assignment
    Compatible with your existing React component
    """
    try:
        # Ensure unassigned payments table exists
        create_unassigned_payments_table()

        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed. Please upload CSV or TXT files.'}), 400

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

        # Store unassigned payments and attempt automatic matching
        manual_review_transactions = []
        auto_matched = 0

        for i, payment_data in enumerate(result["payments"]):
            # Try to find exact matching tenant
            matched_tenant, similarity_score = exact_match_tenant_name(payment_data["name"])

            matched_apartment_id = None
            status = "unassigned"

            if matched_tenant and similarity_score == 1.0:  # Only exact matches
                matched_apartment_id = get_current_apartment_for_tenant(matched_tenant.id)
                if matched_apartment_id:
                    status = "matched"
                    auto_matched += 1
                    debug_print(f"Auto-matched: {payment_data['name']} -> {matched_tenant.name}")

            # Create unassigned payment record
            unassigned_payment = UnassignedPayment(
                name_from_csv=payment_data["name"][:255],  # Truncate to fit VARCHAR(255)
                amount=payment_data["amount"],
                payment_date=payment_data["date"],
                description=payment_data["description"][:1000] if payment_data["description"] else None,  # Truncate long descriptions
                csv_line=payment_data.get("row_number", i + 1),
                matched_tenant_id=matched_tenant.id if matched_tenant else None,
                matched_apartment_id=matched_apartment_id,
                similarity_score=similarity_score,
                status=status,
                sender=payment_data["name"][:255],  # Truncate to fit VARCHAR(255)
                reference=payment_data["description"][:500] if payment_data["description"] else None  # Truncate to fit VARCHAR(500)
            )

            db.session.add(unassigned_payment)
            db.session.flush()  # Get the ID

            # Convert to format expected by your React component
            transaction = {
                "id": unassigned_payment.id,
                "date": payment_data["date"].isoformat() if payment_data["date"] else None,
                "amount": float(payment_data["amount"]),
                "sender": payment_data["name"],
                "reference": payment_data["description"] or "",
                "csv_line": payment_data.get("row_number", i + 1),
                "manually_assigned": status == "matched",
                "assigned_tenant_id": matched_tenant.id if matched_tenant else None,
                "assigned_apartment_id": matched_apartment_id,
                "confidence": similarity_score if matched_tenant else 0,
                "matched_tenant_name": matched_tenant.name if matched_tenant else None
            }

            manual_review_transactions.append(transaction)

        try:
            db.session.commit()
            debug_print(f"Successfully stored {len(manual_review_transactions)} transactions")
        except Exception as e:
            db.session.rollback()
            debug_print(f"Database error: {e}")
            return jsonify({'error': 'Failed to store transactions in database'}), 500

        return jsonify({
            "transactions": manual_review_transactions,
            "auto_matched": auto_matched,
            "total_processed": len(manual_review_transactions),
            "message": f"Processed {len(manual_review_transactions)} transactions, {auto_matched} auto-matched"
        }), 200

    except Exception as e:
        db.session.rollback()
        debug_print(f"Error in process_csv_simple: {e}")
        return jsonify({'error': str(e)}), 500

@csv_payments_bp.route('/previous-uploads', methods=['GET'])
@token_required
def get_previous_uploads():
    """Get summary and details of previous CSV uploads"""
    try:
        # Get summary counts
        summary = db.session.query(
            UnassignedPayment.status,
            func.count(UnassignedPayment.id).label('count'),
            func.sum(UnassignedPayment.amount).label('total_amount')
        ).group_by(UnassignedPayment.status).all()

        summary_dict = {}
        for status, count, total_amount in summary:
            summary_dict[status] = {
                "count": count,
                "total_amount": float(total_amount) if total_amount else 0.0
            }

        # Get unassigned and matched payments
        unassigned_payments = UnassignedPayment.query.filter_by(status='unassigned').all()
        matched_payments = UnassignedPayment.query.filter_by(status='matched').all()

        def format_payment(payment):
            return {
                "id": payment.id,
                "name_from_csv": payment.name_from_csv,
                "amount": float(payment.amount),
                "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
                "description": payment.description,
                "csv_line": payment.csv_line,
                "status": payment.status,
                "similarity_score": payment.similarity_score,
                "matched_tenant_id": payment.matched_tenant_id,
                "matched_apartment_id": payment.matched_apartment_id,
                "created_at": payment.created_at.isoformat() if hasattr(payment, 'created_at') and payment.created_at else None
            }

        return jsonify({
            "summary": summary_dict,
            "unassigned": [format_payment(p) for p in unassigned_payments],
            "matched": [format_payment(p) for p in matched_payments]
        }), 200

    except Exception as e:
        debug_print(f"Error getting previous uploads: {e}")
        return jsonify({'error': str(e)}), 500

@csv_payments_bp.route('/auto-assign-matched', methods=['POST'])
@token_required
def auto_assign_matched():
    """Auto-assign all matched payments to create Payment records"""
    try:
        matched_payments = UnassignedPayment.query.filter_by(status='matched').all()
        assigned_count = 0

        for payment in matched_payments:
            if payment.matched_tenant_id and payment.matched_apartment_id:
                # Get tenant info
                tenant = Tenant.query.get(payment.matched_tenant_id)
                if not tenant:
                    continue

                # Create payment record
                tenant_data = [{
                    "id": tenant.id,
                    "name": tenant.name,
                    "amountPaid": float(payment.amount),
                    "amountDue": float(payment.amount),
                    "paid": True
                }]

                # Create unique month identifier
                month_identifier = f"csv_{payment.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

                new_payment = Payment(
                    apartment_id=payment.matched_apartment_id,
                    month=month_identifier,
                    year=payment.payment_date.year if payment.payment_date else datetime.now().year,
                    status='paid',
                    tenants=json.dumps(tenant_data),
                    internet=0.0,
                    electricity=0.0,
                    other=0.0,
                    extraPayments="{}",
                    paymentDate=payment.payment_date or datetime.now().date(),
                    paymentMethod='bank_transfer',
                    notes=f"Auto-assigned CSV payment from {payment.name_from_csv}",
                    updated_at=datetime.utcnow()
                )

                db.session.add(new_payment)

                # Update unassigned payment status
                payment.status = 'assigned'
                assigned_count += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "assigned_count": assigned_count,
            "message": f"Successfully auto-assigned {assigned_count} payments"
        }), 200

    except Exception as e:
        db.session.rollback()
        debug_print(f"Error in auto-assign: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

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

        if not tenant_id or not apartment_id:
            return jsonify({"success": False, "error": "Missing tenant_id or apartment_id"}), 400

        # Get the unassigned payment
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
        payment = UnassignedPayment.query.get(payment_id)
        if not payment:
            return jsonify({"success": False, "error": "Payment not found"}), 404

        payment.status = 'rejected'
        db.session.commit()

        debug_print(f"Payment {payment_id} rejected")

        return jsonify({"success": True, "message": "Payment rejected"}), 200

    except Exception as e:
        db.session.rollback()
        debug_print(f"Error rejecting payment: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@csv_payments_bp.route('/manual-assign-payment', methods=['POST'])
@token_required
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

@csv_payments_bp.route("/tenants/search", methods=["GET"])
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
            current_contract = db.session.query(ContractTenant, ContractPeriod, Apartment).join(
                ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
            ).join(
                Apartment, ContractPeriod.apartment_id == Apartment.id
            ).filter(
                ContractTenant.tenant_id == tenant.id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).first()

            apartment_info = None
            if current_contract:
                contract_tenant, contract_period, apartment = current_contract
                apartment_info = {
                    "id": apartment.id,
                    "address": apartment.get_short_address(),
                    "contract_number": contract_period.contract_number,
                    "monthly_rent": float(contract_period.monthly_rent) if contract_period.monthly_rent else 0
                }

            results.append({
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "current_apartment": apartment_info
            })

        debug_print(f"Found {len(results)} tenants matching '{query}'")
        return jsonify(results), 200

    except Exception as e:
        debug_print(f"Error searching tenants: {e}")
        return jsonify({"error": str(e)}), 500

@csv_payments_bp.route("/apartments/search", methods=["GET"])
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
            current_tenants = db.session.query(Tenant, ContractTenant, ContractPeriod).join(
                ContractTenant, Tenant.id == ContractTenant.tenant_id
            ).join(
                ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
            ).filter(
                ContractPeriod.apartment_id == apartment.id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).all()

            tenant_info = []
            for tenant, contract_tenant, contract_period in current_tenants:
                tenant_info.append({
                    "id": tenant.id,
                    "name": tenant.name,
                    "is_primary": contract_tenant.is_primary
                })

            results.append({
                "id": apartment.id,
                "address": apartment.get_short_address(),
                "rent": float(apartment.rent) if apartment.rent else 0,
                "rooms": apartment.rooms,
                "status": apartment.status,
                "current_tenants": tenant_info
            })

        debug_print(f"Found {len(results)} apartments matching '{query}'")
        return jsonify(results), 200

    except Exception as e:
        debug_print(f"Error searching apartments: {e}")
        return jsonify({"error": str(e)}), 500

@csv_payments_bp.route("/test", methods=["GET"])
def test_endpoint():
    """Test endpoint to verify blueprint is working"""
    return jsonify({"message": "CSV Payments API is working!", "timestamp": datetime.now().isoformat()}), 200
