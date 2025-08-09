const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Contract templates
const CONTRACT_TEMPLATES = {
    photo_print_release: {
        title: 'Photo Print Release Form',
        content: `PHOTO PRINT RELEASE FORM

This Photo Print Release Form ("Release") is entered into between:

PHOTOGRAPHER: {{photographer_name}}
BUSINESS: The Legacy Photography
EMAIL: {{photographer_email}}

CLIENT: {{client_name}}
EMAIL: {{client_email}}
PHONE: {{client_phone}}

SESSION DETAILS:
Service Type: {{session_type}}
Date & Time: {{session_date}}
Location: {{location}}
Duration: {{duration}} minutes
Investment: ${{price}}

PRINT RELEASE AGREEMENT:

1. USAGE RIGHTS
Client receives unlimited personal print rights for all delivered images from this session.

2. PRINT AUTHORIZATION
Client is authorized to print images at any professional lab, retail location, or personal printer for personal use.

3. SHARING RIGHTS
Client may share images on social media, personal websites, and with family/friends with photographer credit appreciated but not required.

4. COMMERCIAL RESTRICTIONS
Images may not be used for commercial purposes, advertising, or resale without separate written agreement.

5. MODIFICATIONS
Client may crop, edit, or apply filters to images for personal use. Original high-resolution files will be provided.

6. DELIVERY
Images will be delivered via online gallery within 2-3 weeks of session date.

7. COPYRIGHT
Photographer retains copyright to all images. Client receives unlimited personal use rights.

By signing below, both parties agree to all terms and conditions outlined in this contract.

CLIENT SIGNATURE: _______________________ DATE: _________

PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________`
    },
    
    service_agreement: {
        title: 'Photography Service Agreement',
        content: `PHOTOGRAPHY SERVICE AGREEMENT

This Photography Service Agreement ("Agreement") is entered into between:

PHOTOGRAPHER: {{photographer_name}}
BUSINESS: The Legacy Photography
EMAIL: {{photographer_email}}

CLIENT: {{client_name}}
EMAIL: {{client_email}}
PHONE: {{client_phone}}

SESSION DETAILS:
Service Type: {{session_type}}
Date & Time: {{session_date}}
Location: {{location}}
Duration: {{duration}} minutes
Total Investment: ${{price}}

TERMS OF SERVICE:

1. SCOPE OF SERVICES
The Photographer agrees to provide professional photography services including:
- {{duration}}-minute photography session
- Professional editing and color correction
- Digital gallery delivery within 2-3 weeks
- High-resolution digital downloads

2. PAYMENT TERMS
- Total session fee: ${{price}}
- Payment schedule as agreed upon booking
- Late payment may result in delayed delivery
- All sales are final, no refunds

3. DELIVERY TIMELINE
- Sneak peek photos: 24-48 hours
- Full gallery delivery: 2-3 weeks from session date
- Gallery access: 1 year from delivery date

4. CLIENT RESPONSIBILITIES
- Arrive on time for scheduled session
- Provide necessary permits for locations if required
- Communicate any special requests in advance
- Ensure all family members/subjects are present as scheduled

5. WEATHER AND RESCHEDULING
- Outdoor sessions may be rescheduled due to inclement weather
- No additional charges for weather-related rescheduling
- Client changes require 48-hour notice

6. LIABILITY
The Photographer's liability is limited to the cost of the photography session. The Photographer is not responsible for lost or damaged personal items during the session.

By signing below, both parties agree to all terms and conditions outlined in this contract.

CLIENT SIGNATURE: _______________________ DATE: _________

PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________`
    },
    
    model_release: {
        title: 'Model Release Form',
        content: `MODEL RELEASE FORM

This Model Release Form ("Release") is entered into between:

PHOTOGRAPHER: {{photographer_name}}
BUSINESS: The Legacy Photography
EMAIL: {{photographer_email}}

CLIENT/MODEL: {{client_name}}
EMAIL: {{client_email}}
PHONE: {{client_phone}}

SESSION DETAILS:
Service Type: {{session_type}}
Date & Time: {{session_date}}
Location: {{location}}

MODEL RELEASE AGREEMENT:

1. GRANT OF RIGHTS
I, {{client_name}}, hereby grant to {{photographer_name}} and The Legacy Photography the absolute right and permission to use, publish, and copyright photographs taken of me during this photography session.

2. USAGE PERMISSIONS
The Photographer may use these photographs for:
- Portfolio and website display
- Social media marketing and promotion
- Print and digital advertising materials
- Photography competition entries
- Educational purposes and workshops

3. CONSIDERATION
In consideration for this release, I acknowledge receiving professional photography services valued at ${{price}}.

4. WAIVER OF CLAIMS
I waive any right to inspect or approve the finished photographs or any advertising copy that may be used in connection with them.

5. RELEASE OF LIABILITY
I release The Legacy Photography and {{photographer_name}} from any claims, damages, or liability arising from the use of these photographs.

6. BINDING AGREEMENT
This release is binding upon my heirs, legal representatives, and assigns.

7. LEGAL CAPACITY
I am of legal age and have the right to contract in my own name. If the subject is a minor, this release is signed by the parent or legal guardian.

By signing below, I agree to be bound by the terms of this release.

MODEL SIGNATURE: _______________________ DATE: _________

PRINT NAME: _______________________

If Minor - PARENT/GUARDIAN SIGNATURE: _______________________ DATE: _________

PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________`
    }
};

class ContractManager {
    // Generate secure access token
    generateAccessToken() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // Populate template with session data
    populateTemplate(template, data) {
        let populatedContent = template;
        
        // Replace basic variables
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            populatedContent = populatedContent.replace(placeholder, data[key] || '');
        });
        
        return populatedContent;
    }

    // Create a new contract
    async createContract(sessionId, userId, contractType, customData = {}) {
        try {
            const contractId = uuidv4();
            const accessToken = this.generateAccessToken();
            
            const template = CONTRACT_TEMPLATES[contractType];
            if (!template) {
                throw new Error(`Invalid contract type: ${contractType}`);
            }

            // Replace template variables with session data
            const contractContent = this.populateTemplate(template.content, customData);

            const result = await pool.query(`
                INSERT INTO contracts (
                    id, session_id, user_id, contract_type, contract_title, contract_content,
                    client_name, client_email, client_phone, photographer_name, photographer_email,
                    access_token, custom_fields
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                contractId,
                sessionId,
                userId,
                contractType,
                template.title,
                contractContent,
                customData.client_name || 'Client Name',
                customData.client_email || 'client@example.com',
                customData.client_phone || 'No phone',
                customData.photographer_name || 'Lance Casselman',
                customData.photographer_email || 'lance@thelegacyphotography.com',
                accessToken,
                JSON.stringify(customData)
            ]);

            console.log(`✅ Contract created: ${template.title} for session ${sessionId}`);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating contract:', error);
            throw error;
        }
    }
}

async function createMissingContracts() {
    try {
        console.log('🚀 Starting contract creation for sessions...');
        
        // Get all sessions and check which contracts they're missing
        const sessionsResult = await pool.query(`
            SELECT DISTINCT s.* FROM photography_sessions s
            ORDER BY s.created_at DESC
        `);

        const allSessions = sessionsResult.rows;
        console.log(`📋 Found ${allSessions.length} sessions to process`);

        const contractManager = new ContractManager();
        const contractTypes = ['photo_print_release', 'service_agreement', 'model_release'];
        let createdCount = 0;

        for (const session of allSessions) {
            console.log(`\n📝 Processing session: ${session.client_name} (${session.session_type})`);
            
            // Check which contracts already exist for this session
            const existingContracts = await pool.query(`
                SELECT contract_type FROM contracts WHERE session_id = $1
            `, [session.id]);
            
            const existingTypes = existingContracts.rows.map(row => row.contract_type);
            console.log(`   Existing contracts: ${existingTypes.join(', ') || 'None'}`);
            
            // Prepare session data for contract templates
            const contractData = {
                client_name: session.client_name,
                client_email: session.email,
                client_phone: session.phone_number,
                photographer_name: 'Lance Casselman',
                photographer_email: 'lance@thelegacyphotography.com',
                session_type: session.session_type,
                session_date: new Date(session.date_time).toLocaleDateString(),
                location: session.location,
                price: parseFloat(session.price).toFixed(0),
                duration: session.duration || 60
            };

            // Create missing contract types
            for (const contractType of contractTypes) {
                if (!existingTypes.includes(contractType)) {
                    try {
                        await contractManager.createContract(
                            session.id, 
                            session.user_id, 
                            contractType, 
                            contractData
                        );
                        
                        console.log(`   ✅ Created: ${contractType.replace(/_/g, ' ').toUpperCase()}`);
                        createdCount++;
                        
                    } catch (error) {
                        console.error(`   ❌ Failed to create ${contractType}:`, error.message);
                    }
                } else {
                    console.log(`   ⏭️  Skipped: ${contractType.replace(/_/g, ' ').toUpperCase()} (already exists)`);
                }
            }
        }

        console.log(`\n🎉 Contract creation completed! Created ${createdCount} new contracts.`);

        console.log('🎉 Contract creation completed!');

        // Show summary
        const contractsResult = await pool.query('SELECT COUNT(*) as total FROM contracts');
        console.log(`📊 Total contracts in database: ${contractsResult.rows[0].total}`);

    } catch (error) {
        console.error('❌ Error in createMissingContracts:', error);
    } finally {
        await pool.end();
    }
}

// Run the script
createMissingContracts();