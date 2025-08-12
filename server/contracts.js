
const { v4: uuidv4 } = require('uuid');

class ContractManager {
    constructor() {
        this.contractTemplates = {
            'photo_release': {
                type: 'photo_release',
                title: 'Photo Release Agreement',
                content: this.getPhotoReleaseTemplate()
            },
            'wedding_contract': {
                type: 'wedding_contract', 
                title: 'Wedding Photography Contract',
                content: this.getWeddingContractTemplate()
            },
            'general_contract': {
                type: 'general_contract',
                title: 'General Photography Contract', 
                content: this.getGeneralContractTemplate()
            }
        };
    }

    getContractTemplates() {
        return Object.values(this.contractTemplates);
    }

    async createContract(sessionId, userId, contractType, contractData) {
        const template = this.contractTemplates[contractType];
        if (!template) {
            throw new Error(`Contract template not found: ${contractType}`);
        }

        const contractId = uuidv4();
        const accessToken = this.generateAccessToken();

        // Replace template variables with actual data
        let contractContent = template.content;
        Object.keys(contractData).forEach(key => {
            const placeholder = `{{${key}}}`;
            contractContent = contractContent.replace(new RegExp(placeholder, 'g'), contractData[key] || '');
        });

        const contract = {
            id: contractId,
            sessionId: sessionId,
            userId: userId,
            contractType: contractType,
            contractTitle: template.title,
            contractContent: contractContent,
            status: 'draft',
            clientName: contractData.client_name,
            clientEmail: contractData.client_email,
            photographerName: contractData.photographer_name,
            photographerEmail: contractData.photographer_email,
            accessToken: accessToken,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return contract;
    }

    generateAccessToken() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    getPhotoReleaseTemplate() {
        return `
PHOTO RELEASE AGREEMENT

I, {{client_name}}, hereby grant {{photographer_name}} the right to take photographs of me and to use said photographs in any lawful manner and medium.

Client Name: {{client_name}}
Client Email: {{client_email}}
Client Phone: {{client_phone}}

Photographer: {{photographer_name}}
Email: {{photographer_email}}

Session Details:
Type: {{session_type}}
Date: {{session_date}}
Location: {{location}}

By signing below, I acknowledge that I have read and understood this agreement.

Client Signature: ___________________________ Date: _______________

Photographer Signature: ___________________________ Date: _______________
        `;
    }

    getWeddingContractTemplate() {
        return `
WEDDING PHOTOGRAPHY CONTRACT

This agreement is between {{photographer_name}} ("Photographer") and {{client_name}} ("Client").

WEDDING DETAILS:
Date: {{session_date}}
Ceremony Location: {{location}}
Reception Location: {{reception_location}}
Coverage Hours: {{coverage_hours}} hours

INVESTMENT:
Total Investment: ` + '${{price}}' + `
{{#if payment_plan}}
Payment Schedule: {{payment_schedule}}
Deposit: ` + '${{deposit_amount}}' + `
Balance: ` + '${{balance_amount}}' + `
{{else}}
Payment in full due by wedding date
{{/if}}

DELIVERABLES:
- Minimum {{min_photos}} edited high-resolution images
- Online gallery for viewing and downloading
- Usage rights for personal use

TERMS:
1. This contract becomes binding when signed by both parties and deposit is received
2. Cancellation policy: Deposit is non-refundable
3. Photographer retains copyright to all images
4. Client receives usage rights for personal use

Client Signature: ___________________________ Date: _______________
{{client_name}}

Photographer Signature: ___________________________ Date: _______________
{{photographer_name}}
        `;
    }

    getGeneralContractTemplate() {
        return `
PHOTOGRAPHY SERVICES CONTRACT

This agreement is between {{photographer_name}} ("Photographer") and {{client_name}} ("Client").

SESSION DETAILS:
Type: {{session_type}}
Date: {{session_date}}
Location: {{location}}
Duration: {{duration}} minutes

INVESTMENT:
Total: ` + '${{price}}' + `

DELIVERABLES:
- Professional edited high-resolution images
- Online gallery for viewing and downloading
- Usage rights for personal use

TERMS AND CONDITIONS:
1. This contract becomes binding when signed by both parties
2. Payment is due before or at the time of the session
3. Photographer retains copyright to all images
4. Client receives usage rights for personal use
5. Cancellation must be made 48 hours in advance

Client Information:
Name: {{client_name}}
Email: {{client_email}}
Phone: {{client_phone}}

Client Signature: ___________________________ Date: _______________

Photographer Signature: ___________________________ Date: _______________
{{photographer_name}}
        `;
    }
}

module.exports = ContractManager;
