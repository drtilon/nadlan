import pandas as pd
from io import BytesIO
from datetime import datetime
from flask import Blueprint, request, jsonify, g, current_app, send_file, Response
from models.models import Apartment, Tenant
from extentions import db
from typing import Tuple, List
from schemas import ApartmentData, TenantData
from flasgger import swag_from
from pydantic import ValidationError, BaseModel
from .auth import token_required, role_required
from docx import Document
from docx.shared import Pt, Cm
from num2words import num2words

documents_bp = Blueprint("documents_bp", __name__)


class ContractDetails(BaseModel):
    startDate: datetime
    endDate: datetime
    rentAmount: float
    securityDeposit: float
    specialTerms: str = ""


class ContractRequest(BaseModel):
    apartmentId: int
    tenantId: int
    contractDetails: ContractDetails


@documents_bp.route("/add_apartment", methods=["POST"])
@token_required
@role_required("admin")
def add_apartment_route() -> Tuple[Response, int]:
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400
        try:
            new_apartment = ApartmentData(**data["new_apartment"])
            new_tenants = [
                TenantData(**tenant) for tenant in data.get("new_tenants", [])
            ]
        except ValidationError as e:
            return jsonify({"message": "Invalid data", "errors": e.errors()}), 400
        current_app.logger.error(new_apartment)
        apartment = Apartment(**new_apartment.model_dump(exclude={"tenants"}))
        db.session.add(apartment)
        db.session.flush()  # Ensure apartment ID is assigned before adding tenants
        tenants = [
            Tenant(**tenant.dict(), apartment_id=apartment.id) for tenant in new_tenants
        ]
        db.session.add_all(tenants)
        db.session.commit()
        return jsonify({"message": "Apartment added successfully"}), 201
    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500


@documents_bp.route("/createContract", methods=["POST"])
@token_required
@role_required("admin")
def create_contract_route() -> Tuple[Response, int]:
    try:
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        try:
            contract_req = ContractRequest(**data)
        except ValidationError as e:
            return jsonify({"message": "Invalid data", "errors": e.errors()}), 400

        # Get apartment and tenant information
        apartment = Apartment.query.get(contract_req.apartmentId)
        tenant = Tenant.query.get(contract_req.tenantId)

        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Create a new Word document
        doc = Document()

        # Set document properties
        section = doc.sections[0]
        section.page_width = Cm(21)
        section.page_height = Cm(29.7)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)

        # Format the dates
        today = datetime.now().strftime("%d.%m.%Y")
        start_date = contract_req.contractDetails.startDate.strftime("%d.%m.%Y")
        end_date = contract_req.contractDetails.endDate.strftime("%d.%m.%Y")

        # Add title with border
        title_p = doc.add_paragraph()
        title_p.add_run(
            "Fixed Term rental agreement for residential space based on sec. 549 para. 2 no. 1 of the German Civil Code (BGB)"
        ).bold = True
        title_p = doc.add_paragraph()
        title_p.add_run(f"{apartment.address}").bold = True

        # Add header
        doc.add_heading("Between", level=1)

        # Add lessor information
        p = doc.add_paragraph()
        p.add_run("Shree Living GmbH").bold = True

        p = doc.add_paragraph()
        p.add_run("Represented by Ori Kigel and Amit Samuel").bold = True

        p = doc.add_paragraph()
        p.add_run("Helmstedter Straße 8, 10717 Berlin").bold = True

        p = doc.add_paragraph()
        p.add_run("E-Mail: shereelivinggmbh@gmail.com").bold = True

        p = doc.add_paragraph()
        p.add_run(
            '- main tenant (also in case of several persons signing) referred to as "Lessor" -'
        )

        doc.add_paragraph("and")

        # Add lessee information
        p = doc.add_paragraph()
        tenant_name = getattr(tenant, "name", "Unknown")
        tenant_email = getattr(tenant, "email", "")
        tenant_phone = getattr(tenant, "phone", "")
        tenant_birth_date = getattr(tenant, "birth_date", "")
        p.add_run(
            f"1. {tenant_name}, born on {tenant_birth_date}, Phone: {tenant_phone}, E-mail: {tenant_email}"
        ).bold = True

        p = doc.add_paragraph()
        p.add_run(
            '- hereinafter (also in case of several persons signing) referred to as "Lessees" -'
        )

        p = doc.add_paragraph()
        p.add_run(
            "the following lease agreement on residential space for temporary use according to sec. 549 para. 2 no. 1 of the German Civil Code (hereinafter: BGB) is concluded as follows:"
        )

        # Add section 1: Rental Property
        doc.add_heading("1. Rental Property", level=2)

        p = doc.add_paragraph()
        p.add_run(
            f"1.1 The subject-matter of this contract is the lease of the apartment located {apartment.address}. The apartment is fully furnished."
        )

        p = doc.add_paragraph()
        p.add_run(
            "1.2 The apartment shall only be used for residential purposes. Any transfer of use of the leased premises to third persons is strictly forbidden without an advanced written permission of the Lessor (see no. 10)."
        )

        # Add section 2: Lease Period
        doc.add_heading("2. Lease Period", level=2)

        p = doc.add_paragraph()
        p.add_run(
            f"2.1 The lease period shall commence on {start_date} and end on {end_date} without the requirement of a separate notice of termination. After the expiration of the agreed lease period the Lessee is obliged to remove all items he brought into the leased apartment and to hand the apartment back to the Lessor in the same condition as it was received by the Lessee."
        ).bold = True

        p = doc.add_paragraph()
        p.add_run(
            "2.2 The lessee has explicitly confirmed that their stay in Germany will be limited to one year due to semester stay for studies abroad with limited visa restrictions. As a result, the contract is also limited to this period."
        )

        p = doc.add_paragraph()
        p.add_run(
            "2.3 Sec. 545 BGB, which states that this lease agreement will merge into a permanent contract in case the Lessee continues using the apartment after the expiration of the agreed lease period unless one of the parties to this contract objects, shall not apply."
        ).bold = True

        # Add section 3: Rent and service charges
        doc.add_heading("3. Rent and service charges", level=2)

        rent_amount = contract_req.contractDetails.rentAmount

        p = doc.add_paragraph()
        try:
            rent_words = num2words(rent_amount, lang="en")
            p.add_run(
                f"3.1 The total rent payable per month is {rent_amount:.2f} EUR, in words: {rent_words} euros."
            ).bold = True
        except:
            # Fallback if num2words fails
            p.add_run(
                f"3.1 The total rent payable per month is {rent_amount:.2f} EUR."
            ).bold = True

        p = doc.add_paragraph()
        p.add_run(
            f"The first rent payment is to be transferred or given in cash before the apartment handover date {start_date} to the account of the Lessor from the Lessee's bank account, after signing the lease agreement."
        )

        p = doc.add_paragraph()
        p.add_run(
            "The apartment service charge includes all additional property expenses, electricity, as well as costs for heating (based on the estimated consumption amount of 200€ per month) and warm water, excluding phone expenses and TV tax;"
        )

        p = doc.add_paragraph()
        p.add_run(
            "3.2 The rent has to be paid in advance until the 3rd day of the relevant month by a standing bank order to the following account:"
        )

        p = doc.add_paragraph()
        p.add_run("Amit Samuel")

        p = doc.add_paragraph()
        p.add_run("IBAN -- DE64500240242070166338")

        p = doc.add_paragraph()
        p.add_run(f"Betreff: Rent Apartment {apartment.address}")

        # Add section 4: Security Deposits
        doc.add_heading("4. Security Deposits", level=2)

        security_deposit = contract_req.contractDetails.securityDeposit

        p = doc.add_paragraph()
        p.add_run(
            f"Lessee shall deposit with Lessor the sum of {security_deposit:.2f} Euro as a security deposit to secure Lessee's faithful performance of the terms of this lease. Lessee will pay the Lessor the sum of {security_deposit:.2f} Euro immediately after signing the contract before receiving the apartment's keys. After the Lessee has vacated, leaving the premises vacant, the Lessor may use the security deposit for the cleaning of the premises, any unusual wear and tear to the premises or common areas, and any rent or other amounts owed pursuant to the lease agreement."
        )

        p = doc.add_paragraph()
        p.add_run(
            "Lessee may not use said deposit for rent owed during the term of the lease. Within 21 days of the Lessee vacating the premises, Lessor shall furnish Lessee a written statement indicating any amounts deducted from the security deposit and returning the balance to the Lessee. If Lessee fails to furnish a forwarding address to Lessor, then Lessor shall send said statement and any security deposit refund to the leased premises."
        )

        # Add section 5: Decorative Repairs
        doc.add_heading("5. Decorative Repairs", level=2)

        p = doc.add_paragraph()
        p.add_run(
            "5.1 Decorative repairs include renovation and/or intensive cleaning that is necessary to eliminate the wear caused by normal use of the apartment."
        )

        p = doc.add_paragraph()
        p.add_run(
            "5.2 The Lessor is not obliged to carry out any decorative repairs during the period of this contract."
        )

        p = doc.add_paragraph()
        p.add_run(
            "5.3 In case the Lessee causes damage to the apartment (e.g., stains, dirt), which exceeds the expectable wear caused by normal use, the Lessee shall be obliged to pay for the decorative repairs in order to remove that damage."
        )

        p = doc.add_paragraph()
        p.add_run(
            "5.4 The tenants have the right to make decorative repairs during the rental period. However, they are required to restore the apartment to its original condition once the lease agreement ends."
        )

        # Add section 6: Smoking
        doc.add_heading("6. Smoking", level=2)
        p = doc.add_paragraph()
        p.add_run("Smoking in the apartment is prohibited.")

        # Add section 7: Cleaning of the apartment
        doc.add_heading("7. Cleaning of the apartment", level=2)
        p = doc.add_paragraph()
        p.add_run(
            "7.1 The Lessee is responsible for cleaning the apartment during the term of this contract."
        )

        p = doc.add_paragraph()
        p.add_run(
            "7.2 At the end of the contract term the Lessee has to clean the apartment before handing it back to the Lessor. In case the Lessee fails to carry out the cleaning accordingly and the Lessor has to have the apartment cleaned, the Lessee will be liable for the resulting costs."
        )

        # Add more sections from the template
        # Continue with other sections...

        # Add special terms if provided
        if contract_req.contractDetails.specialTerms:
            doc.add_heading("Special Terms and Conditions", level=2)
            doc.add_paragraph(contract_req.contractDetails.specialTerms)

        # Add signatures section
        doc.add_paragraph("Berlin, date: " + today)

        p = doc.add_paragraph()
        p.add_run("__________________ __________________ __________________")

        p = doc.add_paragraph()
        p.add_run(
            "Lessee                        Lessee                       Lessee"
        ).bold = True

        p = doc.add_paragraph()
        p.add_run("__________________ __________________ __________________")

        p = doc.add_paragraph()
        p.add_run("Lessor                        Lessee                       Lessee")

        # Add appendix
        doc.add_page_break()
        doc.add_heading(
            "Appendix to the Rental Agreement for the Apartment at "
            + apartment.address,
            level=2,
        )

        # Add the appendix content from the template
        doc.add_heading("1. Cleanliness and Maintenance", level=2)
        p = doc.add_paragraph()
        p.add_run(
            "The apartment is provided to the tenants clean and furnished. Tenants are required to maintain the cleanliness of the apartment throughout the rental period. The landlord or their representatives will conduct periodic inspections of the apartment. If the apartment is found untidy, tenants will receive a notice to clean it. If the apartment remains unclean after the notice, the landlord reserves the right to hire a professional cleaning service at a cost of €100 (per cleaning). This amount will be paid by the tenants or deducted from the security deposit."
        )

        doc.add_heading("2. Lease Term Commitment", level=2)
        p = doc.add_paragraph()
        p.add_run(
            "The rental agreement is for a fixed term. Tenants are obligated to reside in the apartment until the end of the lease term and to pay rent as agreed. In exceptional cases, tenants may terminate the agreement early, but only if they find a replacement tenant to take over their lease, subject to the landlord's approval. In such cases, a one-time administrative fee of €250 will be charged to the outgoing tenant."
        )

        doc.add_heading("3. Payment Obligations", level=2)
        p = doc.add_paragraph()
        p.add_run(
            "Rent must be paid by the 3rd of each month, and the security deposit must be provided as stipulated in the lease. Late payments will incur a penalty of €100. If rent remains unpaid after two notices, the landlord reserves the right to terminate the lease immediately, evict the tenant, and retain the tenant's belongings until the outstanding rent and penalty are paid."
        )

        doc.add_heading("4. Internet Usage", level=2)
        p = doc.add_paragraph()
        p.add_run(
            "The apartment is equipped with an internet connection. Tenants are prohibited from downloading illegal software or files that are not permitted in Germany (e.g., using platforms like eMule). If a third-party complaint is received regarding illegal downloads or usage, the landlord will provide the tenant's details to the authorities. Tenants will be responsible for any fines or legal consequences."
        )

        doc.add_heading("5. Mailbox and Doorbell Nameplates", level=2)
        p = doc.add_paragraph()
        p.add_run(
            "If more than two tenants reside in the apartment, no more than two names may appear on the mailbox or the building's doorbell. Additional tenants may use a registered tenant's name with a 'C/O' designation as is customary in Germany."
        )

        # Add appendix signatures
        p = doc.add_paragraph()
        p.add_run("Berlin, " + today)

        p = doc.add_paragraph()
        p.add_run(
            "__________________ __________________ __________________ __________________"
        )

        p = doc.add_paragraph()
        p.add_run(
            "Tenant                      Tenant                       Tenant                       Tenant"
        )

        p = doc.add_paragraph()
        p.add_run(
            "__________________ __________________ __________________ __________________"
        )

        p = doc.add_paragraph()
        p.add_run(
            "Tenant                      Tenant                       Tenant                       Landlord"
        )

        # Save the document to a BytesIO buffer
        buffer = BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        # Return the document as a downloadable file
        apartment_name = getattr(apartment, "name", "Apartment")
        return send_file(
            buffer,
            download_name=f"Rental_Contract_{apartment_name}_{tenant_name}.docx",
            as_attachment=True,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    except Exception as e:
        current_app.logger.error(f"Error generating contract: {e}")
        return jsonify({"message": "Error generating contract", "error": str(e)}), 500
