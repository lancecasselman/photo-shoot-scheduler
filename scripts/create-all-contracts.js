const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Contract templates - using string concatenation to avoid template literal issues
const CONTRACT_TEMPLATES = {
    photo_print_release: {
        title: 'Photo Print Release Form',
        getContent: () => 'PHOTO PRINT RELEASE FORM\n\n' +
            'This Photo Print Release Form ("Release") is entered into between:\n\n' +
            'PHOTOGRAPHER: {{photographer_name}}\n' +
            'BUSINESS: The Legacy Photography\n' +
            'EMAIL: {{photographer_email}}\n\n' +
            'CLIENT: {{client_name}}\n' +
            'EMAIL: {{client_email}}\n' +
            'PHONE: {{client_phone}}\n\n' +
            'SESSION DETAILS:\n' +
            'Service Type: {{session_type}}\n' +
            'Date & Time: {{session_date}}\n' +
            'Location: {{location}}\n' +
            'Duration: {{duration}} minutes\n' +
            'Investment: ${{price}}\n\n' +
            'PRINT RELEASE AGREEMENT:\n\n' +
            '1. USAGE RIGHTS\n' +
            'Client receives unlimited personal print rights for all delivered images from this session.\n\n' +
            '2. PRINT AUTHORIZATION\n' +
            'Client is authorized to print images at any professional lab, retail location, or personal printer for personal use.\n\n' +
            '3. SHARING RIGHTS\n' +
            'Client may share images on social media, personal websites, and with family/friends with photographer credit appreciated but not required.\n\n' +
            '4. COMMERCIAL RESTRICTIONS\n' +
            'Images may not be used for commercial purposes, advertising, or resale without separate written agreement.\n\n' +
            '5. MODIFICATIONS\n' +
            'Client may crop, edit, or apply filters to images for personal use. Original high-resolution files will be provided.\n\n' +
            '6. DELIVERY\n' +
            'Images will be delivered via online gallery within 2-3 weeks of session date.\n\n' +
            '7. COPYRIGHT\n' +
            'Photographer retains copyright to all images. Client receives unlimited personal use rights.\n\n' +
            'By signing below, both parties agree to all terms and conditions outlined in this contract.\n\n' +
            'CLIENT SIGNATURE: _______________________ DATE: _________\n\n' +
            'PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________'
    },
    
    service_agreement: {
        title: 'Photography Service Agreement',
        getContent: () => 'PHOTOGRAPHY SERVICE AGREEMENT\n\n' +
            'This Photography Service Agreement ("Agreement") is entered into between:\n\n' +
            'PHOTOGRAPHER: {{photographer_name}}\n' +
            'BUSINESS: The Legacy Photography\n' +
            'EMAIL: {{photographer_email}}\n\n' +
            'CLIENT: {{client_name}}\n' +
            'EMAIL: {{client_email}}\n' +
            'PHONE: {{client_phone}}\n\n' +
            'SESSION DETAILS:\n' +
            'Service Type: {{session_type}}\n' +
            'Date & Time: {{session_date}}\n' +
            'Location: {{location}}\n' +
            'Duration: {{duration}} minutes\n' +
            'Total Investment: ${{price}}\n\n' +
            'TERMS OF SERVICE:\n\n' +
            '1. SCOPE OF SERVICES\n' +
            'The Photographer agrees to provide professional photography services including:\n' +
            '- {{duration}}-minute photography session\n' +
            '- Professional editing and color correction\n' +
            '- Digital gallery delivery within 2-3 weeks\n' +
            '- High-resolution digital downloads\n\n' +
            '2. PAYMENT TERMS\n' +
            '- Total session fee: ${{price}}\n' +
            '- Payment schedule as agreed upon booking\n' +
            '- Late payment may result in delayed delivery\n' +
            '- All sales are final, no refunds\n\n' +
            '3. DELIVERY TIMELINE\n' +
            '- Sneak peek photos: 24-48 hours\n' +
            '- Full gallery delivery: 2-3 weeks from session date\n' +
            '- Gallery access: 1 year from delivery date\n\n' +
            '4. CLIENT RESPONSIBILITIES\n' +
            '- Arrive on time for scheduled session\n' +
            '- Provide necessary permits for locations if required\n' +
            '- Communicate any special requests in advance\n' +
            '- Ensure all family members/subjects are present as scheduled\n\n' +
            '5. WEATHER AND RESCHEDULING\n' +
            '- Outdoor sessions may be rescheduled due to inclement weather\n' +
            '- No additional charges for weather-related rescheduling\n' +
            '- Client changes require 48-hour notice\n\n' +
            '6. LIABILITY\n' +
            'The Photographer\'s liability is limited to the cost of the photography session. The Photographer is not responsible for lost or damaged personal items during the session.\n\n' +
            'By signing below, both parties agree to all terms and conditions outlined in this contract.\n\n' +
            'CLIENT SIGNATURE: _______________________ DATE: _________\n\n' +
            'PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________'
    },
    
    model_release: {
        title: 'Model Release Form',
        getContent: () => 'MODEL RELEASE FORM\n\n' +
            'This Model Release Form ("Release") is entered into between:\n\n' +
            'PHOTOGRAPHER: {{photographer_name}}\n' +
            'BUSINESS: The Legacy Photography\n' +
            'EMAIL: {{photographer_email}}\n\n' +
            'CLIENT/MODEL: {{client_name}}\n' +
            'EMAIL: {{client_email}}\n' +
            'PHONE: {{client_phone}}\n\n' +
            'SESSION DETAILS:\n' +
            'Service Type: {{session_type}}\n' +
            'Date & Time: {{session_date}}\n' +
            'Location: {{location}}\n\n' +
            'MODEL RELEASE AGREEMENT:\n\n' +
            '1. GRANT OF RIGHTS\n' +
            'I, {{client_name}}, hereby grant to {{photographer_name}} and The Legacy Photography the absolute right and permission to use, publish, and copyright photographs taken of me during this photography session.\n\n' +
            '2. USAGE PERMISSIONS\n' +
            'The Photographer may use these photographs for:\n' +
            '- Portfolio and website display\n' +
            '- Social media marketing and promotion\n' +
            '- Print and digital advertising materials\n' +
            '- Photography competition entries\n' +
            '- Educational purposes and workshops\n\n' +
            '3. CONSIDERATION\n' +
            'In consideration for this release, I acknowledge receiving professional photography services valued at ${{price}}.\n\n' +
            '4. WAIVER OF CLAIMS\n' +
            'I waive any right to inspect or approve the finished photographs or any advertising copy that may be used in connection with them.\n\n' +
            '5. RELEASE OF LIABILITY\n' +
            'I release The Legacy Photography and {{photographer_name}} from any claims, damages, or liability arising from the use of these photographs.\n\n' +
            '6. BINDING AGREEMENT\n' +
            'This release is binding upon my heirs, legal representatives, and assigns.\n\n' +
            '7. LEGAL CAPACITY\n' +
            'I am of legal age and have the right to contract in my own name. If the subject is a minor, this release is signed by the parent or legal guardian.\n\n' +
            'By signing below, I agree to be bound by the terms of this release.\n\n' +
            'MODEL SIGNATURE: _______________________ DATE: _________\n\n' +
            'PRINT NAME: _______________________\n\n' +
            'If Minor - PARENT/GUARDIAN SIGNATURE: _______________________ DATE: _________\n\n' +
            'PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________'
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

            // Get template content and replace variables with session data
            const contractContent = this.populateTemplate(template.getContent(), customData);

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
                customData.client_name || '',
                customData.client_email || '',
                customData.client_phone || '',
                customData.photographer_name || '',
                customData.photographer_email || '',
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

async function createAllContracts() {
    try {
        console.log('🚀 Starting complete contract creation for all sessions...');
        
        // Get all sessions
        const sessionsResult = await pool.query(`
            SELECT DISTINCT s.* FROM photography_sessions s
            ORDER BY s.created_at DESC
        `);

        const allSessions = sessionsResult.rows;
        console.log(`📋 Found ${allSessions.length} sessions to process`);

        const contractManager = new ContractManager();
        const contractTypes = ['photo_print_release', 'service_agreement', 'model_release'];
        let createdCount = 0;
        let skippedCount = 0;

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
                    skippedCount++;
                }
            }
        }

        console.log(`\n🎉 Contract creation completed!`);
        console.log(`📊 Results:`);
        console.log(`   • Created: ${createdCount} new contracts`);
        console.log(`   • Skipped: ${skippedCount} existing contracts`);

        // Show final summary
        const contractsResult = await pool.query('SELECT COUNT(*) as total FROM contracts');
        console.log(`📊 Total contracts in database: ${contractsResult.rows[0].total}`);

    } catch (error) {
        console.error('❌ Error in createAllContracts:', error);
    } finally {
        await pool.end();
    }
}

// Run the script
createAllContracts();