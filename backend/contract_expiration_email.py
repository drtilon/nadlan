# contract_expiration_email.py
import os
import sys
from datetime import datetime, timedelta
import json
from flask import Flask
from sqlalchemy import and_
from config import Config
from extentions import db
from models.models import Apartment, Tenant, Landlord, User
from dotenv import load_dotenv

# Import SendGrid library
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, To, Email, Content, HtmlContent

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# SendGrid configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'property_management@yourdomain.com')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@yourdomain.com')

def send_email(to_emails, subject, html_content):
    """
    Send an email using SendGrid API.
    
    Args:
        to_emails (list): List of recipient email addresses
        subject (str): Email subject
        html_content (str): HTML content of the email
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    if not SENDGRID_API_KEY:
        print("Error: SendGrid API key not found in environment variables.")
        return False
        
    try:
        # Create SendGrid message
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_emails,
            subject=subject,
            html_content=html_content
        )
        
        # Send the email
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        # Log the response
        print(f"SendGrid response: Status {response.status_code}")
        
        # Return success if status code is 2xx
        return response.status_code >= 200 and response.status_code < 300
        
    except Exception as e:
        print(f"Error sending email via SendGrid: {e}")
        return False

def check_expiring_contracts():
    """
    Check for contracts expiring in 45 days (1.5 months) and send email alerts.
    """
    with app.app_context():
        # Calculate the date 45 days from now (1.5 months)
        target_date = datetime.now().date() + timedelta(days=45)
        
        # Find apartments with contracts ending around the target date
        # Allow a 3-day window to avoid missing any
        expiring_soon = Apartment.query.filter(
            and_(
                Apartment.contractEndDate.isnot(None),
                Apartment.contractEndDate >= target_date - timedelta(days=3),
                Apartment.contractEndDate <= target_date + timedelta(days=3)
            )
        ).all()
        
        if not expiring_soon:
            print("No contracts expiring in about 1.5 months.")
            return
        
        print(f"Found {len(expiring_soon)} apartments with contracts expiring soon.")
        
        # Get admin users who should receive notifications
        admin_users = User.query.filter_by(role="admin", is_approved=True).all()
        admin_emails = [user.username for user in admin_users if '@' in user.username]
        
        # Add default admin email if no admin users found
        if not admin_emails and ADMIN_EMAIL:
            admin_emails.append(ADMIN_EMAIL)
        
        # Process each expiring apartment
        for apartment in expiring_soon:
            process_expiring_apartment(apartment, admin_emails)

def process_expiring_apartment(apartment, admin_emails):
    """
    Process a single apartment with an expiring contract and send email notification.
    
    Args:
        apartment: The apartment object with expiring contract
        admin_emails: List of admin email addresses
    """
    # Get landlord details
    landlord = apartment.landlord
    if not landlord:
        print(f"No landlord found for apartment {apartment.id} at {apartment.address}")
        landlord_name = "Unknown"
        landlord_email = None
    else:
        landlord_name = f"{landlord.name} ({landlord.company_name})"
        landlord_email = landlord.email
    
    # Get tenant details
    tenants = apartment.tenants
    tenant_names = ", ".join([tenant.name for tenant in tenants]) if tenants else "No tenants"
    tenant_emails = [tenant.email for tenant in tenants if tenant.email]
    
    # Format the contract end date
    end_date_formatted = apartment.contractEndDate.strftime("%B %d, %Y")
    
    # Prepare recipient list
    recipients = list(admin_emails)  # Start with admin emails
    
    # Add landlord email if available
    if landlord_email:
        recipients.append(landlord_email)
    
    # Add tenant emails if available
    recipients.extend(tenant_emails)
    
    # Remove duplicates and ensure all are valid emails
    recipients = list(set([email for email in recipients if '@' in email]))
    
    if not recipients:
        print(f"No valid recipients for apartment {apartment.id} at {apartment.address}")
        return
    
    # Create email subject
    subject = f"Contract Expiration Notice - {apartment.address}"
    
    # Create email HTML content
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #f8f9fa; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            .footer {{ font-size: 12px; color: #666; text-align: center; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Contract Expiration Notice</h2>
            </div>
            <div class="content">
                <p>This is an automated notification that the rental contract for the following property will expire in approximately 45 days:</p>
                
                <table>
                    <tr>
                        <th>Property</th>
                        <td>{apartment.address}</td>
                    </tr>
                    <tr>
                        <th>Contract End Date</th>
                        <td>{end_date_formatted}</td>
                    </tr>
                    <tr>
                        <th>Landlord</th>
                        <td>{landlord_name}</td>
                    </tr>
                    <tr>
                        <th>Tenant(s)</th>
                        <td>{tenant_names}</td>
                    </tr>
                </table>
                
                <p>Please take appropriate action regarding contract renewal or termination.</p>
            </div>
            <div class="footer">
                <p>This is an automated message from your Property Management System.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Send the email
    success = send_email(recipients, subject, html_content)
    
    if success:
        print(f"Expiration alert sent for {apartment.address} to {', '.join(recipients)}")
    else:
        print(f"Failed to send expiration alert for {apartment.address}")

if __name__ == "__main__":
    # Check if SendGrid API key is set
    if not SENDGRID_API_KEY:
        print("Error: SENDGRID_API_KEY environment variable is not set.")
        print("Please set this variable in your .env file or environment.")
        sys.exit(1)
        
    # Check if sender email is valid
    if '@' not in FROM_EMAIL:
        print(f"Warning: FROM_EMAIL ({FROM_EMAIL}) does not appear to be valid.")
        
    try:
        check_expiring_contracts()
        print("Contract expiration check completed successfully.")
    except Exception as e:
        print(f"Error checking contract expirations: {e}")
        sys.exit(1)
