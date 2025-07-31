const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Contract templates
const CONTRACT_TEMPLATES = {
  photo_release: {
    title: 'Photo Print Release Form',
    content: `PHOTO PRINT RELEASE AGREEMENT

This Photo Print Release Agreement ("Agreement") is entered into between:

PHOTOGRAPHER: {{photographer_name}}
EMAIL: {{photographer_email}}

CLIENT: {{client_name}}
EMAIL: {{client_email}}

SESSION DETAILS:
Session Type: {{session_type}}
Date: {{session_date}}
Location: {{location}}

TERMS AND CONDITIONS:

1. PRINT RELEASE AUTHORIZATION
The Client hereby grants permission to print, reproduce, and distribute photographs taken during the photography session for personal use only.

2. USAGE RIGHTS
Client may:
- Print photographs for personal use
- Share photographs on personal social media accounts
- Create personal photo albums and gifts

Client may NOT:
- Use photographs for commercial purposes
- Sell or license photographs to third parties
- Alter or edit photographs beyond basic cropping
- Remove photographer's watermark or copyright notice

3. COPYRIGHT
All photographs remain the intellectual property of the photographer. This release does not transfer copyright ownership.

4. QUALITY ASSURANCE
Photographer guarantees professional quality prints when using authorized print services. Quality cannot be guaranteed for third-party printing services.

5. DURATION
This print release is valid indefinitely for the photographs from this specific session.

By signing below, both parties agree to the terms outlined in this Photo Print Release Agreement.

CLIENT SIGNATURE: _______________________ DATE: _________

PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________`
  },

  wedding_contract: {
    title: 'Wedding Photography Contract',
    content: `WEDDING PHOTOGRAPHY CONTRACT

This Wedding Photography Contract ("Contract") is entered into between:

PHOTOGRAPHER: {{photographer_name}}
BUSINESS: The Legacy Photography
EMAIL: {{photographer_email}}
PHONE: (Insert Phone Number)

CLIENT(S): {{client_name}}
EMAIL: {{client_email}}

WEDDING DETAILS:
Wedding Date: {{session_date}}
Ceremony Location: {{location}}
Reception Location: {{reception_location}}
Coverage Hours: {{coverage_hours}} hours
Package Price: $\{{price\}}

TERMS AND CONDITIONS:

1. SERVICES PROVIDED
Photographer will provide professional wedding photography services including:
- Ceremony coverage
- Reception coverage
- Getting ready photos (if included in package)
- Formal portraits
- Candid moments throughout the event

2. PAYMENT TERMS
Total Investment: $\{{price\}}
\{{#if payment_plan\}}
Payment Schedule: \{{payment_schedule\}}
\{{else\}}
50% retainer due upon signing: $\{{deposit_amount\}}
Balance due 30 days before wedding: $\{{balance_amount\}}
\{{/if\}}

3. DELIVERY
- Online gallery with high-resolution digital files
- Print release included for personal use

4. CANCELLATION POLICY
- 90+ days before wedding: 50% refund of payments made
- 30-89 days before wedding: 25% refund of payments made
- Less than 30 days: No refund

5. FORCE MAJEURE
In case of circumstances beyond photographer's control (illness, natural disaster, etc.), photographer will provide qualified substitute or full refund.

6. LIABILITY
Photographer's liability is limited to the amount paid for services.

7. COPYRIGHT
Photographer retains copyright to all images. Client receives unlimited personal use rights.

By signing below, both parties agree to all terms and conditions outlined in this contract.

CLIENT SIGNATURE: _______________________ DATE: _________

PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________`
  },

  general_contract: {
    title: 'Photography Services Contract',
    content: `PHOTOGRAPHY SERVICES CONTRACT

This Photography Services Contract ("Contract") is entered into between:

PHOTOGRAPHER: {{photographer_name}}
BUSINESS: The Legacy Photography
EMAIL: {{photographer_email}}

CLIENT: {{client_name}}
EMAIL: {{client_email}}

SESSION DETAILS:
Service Type: {{session_type}}
Date & Time: {{session_date}}
Location: {{location}}
Duration: \{{duration\}} minutes
Investment: $\{{price\}}

TERMS AND CONDITIONS:

1. SERVICES
Photographer will provide professional photography services as described above, including:
- Professional photo session
- Image editing and post-processing
- Online gallery for viewing and downloading
- Print release for personal use

2. PAYMENT
\{{#if payment_plan\}}
Total Investment: $\{{price\}}
Payment Plan: \{{payment_schedule\}}
\{{else\}}
Session fee: $\{{price\}}
Payment due: Upon completion of session
\{{/if\}}

3. CANCELLATION
- 48+ hours notice: Full refund or reschedule
- 24-48 hours notice: 50% refund
- Less than 24 hours: No refund

4. WEATHER POLICY
For outdoor sessions, photographer will work with client to reschedule if weather conditions are unsuitable.

5. DELIVERY
- Online gallery with high-resolution digital images
- Minimum of \{{min_photos\}} edited photos guaranteed

6. USAGE RIGHTS
Client receives personal use rights to all delivered images. Commercial usage requires separate agreement.

7. COPYRIGHT
Photographer retains copyright. Client may share images on social media with photographer credit appreciated.

8. LIABILITY
Photographer is not responsible for lost or damaged personal items during session.

By signing below, both parties agree to all terms outlined in this contract.

CLIENT SIGNATURE: _______________________ DATE: _________

PHOTOGRAPHER SIGNATURE: _______________________ DATE: _________`
  }
};

class ContractManager {
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
          client_name, client_email, photographer_name, photographer_email,
          access_token, custom_fields
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        customData.photographer_name || 'Lance Casselman',
        customData.photographer_email || 'lance@thelegacyphotography.com',
        accessToken,
        JSON.stringify(customData)
      ]);

      console.log(`SUCCESS: Contract created: ${template.title} for session ${sessionId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating contract:', error);
      throw error;
    }
  }

  // Get contracts for a session
  async getSessionContracts(sessionId) {
    try {
      const result = await pool.query(
        'SELECT * FROM contracts WHERE session_id = $1 ORDER BY created_at DESC',
        [sessionId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching session contracts:', error);
      throw error;
    }
  }

  // Get contract by ID
  async getContract(contractId) {
    try {
      const result = await pool.query(
        'SELECT * FROM contracts WHERE id = $1',
        [contractId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching contract:', error);
      throw error;
    }
  }

  // Get contract by access token (for client access)
  async getContractByToken(accessToken) {
    try {
      const result = await pool.query(
        'SELECT * FROM contracts WHERE access_token = $1',
        [accessToken]
      );
      
      // Mark as viewed if first time
      if (result.rows[0] && !result.rows[0].viewed_at) {
        await pool.query(
          'UPDATE contracts SET viewed_at = NOW() WHERE access_token = $1',
          [accessToken]
        );
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching contract by token:', error);
      throw error;
    }
  }

  // Sign contract (client signature)
  async signContract(contractId, signatureData) {
    try {
      const result = await pool.query(`
        UPDATE contracts SET 
          client_signature = $2,
          client_signature_date = NOW(),
          status = 'signed',
          signed_date = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [contractId, signatureData]);

      if (result.rows.length === 0) {
        throw new Error('Contract not found');
      }

      console.log(`SUCCESS: Contract signed: ${contractId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error signing contract:', error);
      throw error;
    }
  }

  // Send contract to client
  async sendContract(contractId) {
    try {
      const result = await pool.query(`
        UPDATE contracts SET 
          status = 'sent',
          sent_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [contractId]);

      console.log(`SUCCESS: Contract sent: ${contractId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error sending contract:', error);
      throw error;
    }
  }

  // Generate secure access token
  generateAccessToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Populate template with session data
  populateTemplate(template, data) {
    let populatedContent = template;
    
    // Replace basic variables
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = data[key] || '';
      populatedContent = populatedContent.replace(new RegExp(placeholder, 'g'), value);
    });

    // Handle payment plan conditional logic
    if (data.payment_plan) {
      populatedContent = populatedContent.replace(/{{#if payment_plan}}(.*?){{else}}(.*?){{\/if}}/gs, '$1');
    } else {
      populatedContent = populatedContent.replace(/{{#if payment_plan}}(.*?){{else}}(.*?){{\/if}}/gs, '$2');
    }

    // Clean up any remaining template variables
    populatedContent = populatedContent.replace(/{{[^}]*}}/g, '[TO BE FILLED]');

    return populatedContent;
  }

  // Get contract templates
  getContractTemplates() {
    return Object.keys(CONTRACT_TEMPLATES).map(key => ({
      type: key,
      title: CONTRACT_TEMPLATES[key].title,
      description: this.getTemplateDescription(key)
    }));
  }

  getTemplateDescription(type) {
    const descriptions = {
      photo_release: 'Grants clients permission to print and share photos for personal use',
      wedding_contract: 'Comprehensive contract for wedding photography services',
      general_contract: 'Standard contract for portrait sessions and general photography services'
    };
    return descriptions[type] || 'Photography contract';
  }

  // Get individual contract details
  async getContract(contractId) {
    try {
      const result = await pool.query(`
        SELECT * FROM contracts 
        WHERE id = $1
      `, [contractId]);

      if (result.rows.length === 0) {
        throw new Error('Contract not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting contract:', error);
      throw error;
    }
  }

  // Update contract content
  async updateContract(contractId, title, content) {
    try {
      const result = await pool.query(`
        UPDATE contracts 
        SET contract_title = $1, contract_content = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [title, content, contractId]);

      if (result.rows.length === 0) {
        throw new Error('Contract not found');
      }

      console.log(`SUCCESS: Contract updated: ${contractId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating contract:', error);
      throw error;
    }
  }
}

module.exports = ContractManager;