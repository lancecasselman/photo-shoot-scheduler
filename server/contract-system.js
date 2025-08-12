const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class ContractSystem {
  constructor(pool = null) {
    this.pool = pool;
    this.templates = {
      portrait: {
        name: "Portrait Photography Contract",
        defaultTitle: "Portrait Photography Agreement",
        sections: [
          { bodyHtml: "<h2>PORTRAIT PHOTOGRAPHY AGREEMENT</h2><p>This Portrait Photography Agreement (\"Agreement\") is made between {photographerName} (\"Photographer\") and {clientName} (\"Client\") as of {contractDate}.</p>" },
          { bodyHtml: "<h3>1. EVENT DETAILS</h3><p>Date: {eventDate}<br>Location: {eventLocation}<br>Package: {packageName}<br>Deliverables: {deliverableCount} edited images in online gallery.</p>" },
          { bodyHtml: "<h3>2. FEES & PAYMENT</h3><p>Total Fee: ${totalPrice}<br>Retainer: ${depositAmount} due at signing (non-refundable). Balance due on {balanceDueDate}.</p>" },
          { bodyHtml: "<h3>3. CANCELLATION & RESCHEDULING</h3><p>Client may reschedule once without fee if notice is given at least {rescheduleNoticeDays} days in advance. Retainer is non-refundable for cancellations.</p>" },
          { bodyHtml: "<h3>4. COPYRIGHT & USAGE</h3><p>Photographer retains full copyright to all images. Client is granted personal, non-commercial usage rights.</p>" },
          { bodyHtml: "<h3>5. LIABILITY</h3><p>Photographer is not liable for circumstances beyond control including weather, accidents, or equipment failure.</p>" },
          { bodyHtml: "<h3>6. DELIVERY TIMELINE</h3><p>Gallery delivered within {deliveryDays} days of session date.</p>" },
          { bodyHtml: "<p>Both parties acknowledge they have read and agree to the terms.</p><p>Signed: _____________________ (Photographer)<br>Signed: _____________________ (Client)<br>Date: _______________________</p>" }
        ]
      },
      wedding: {
        name: "Wedding Photography Contract",
        defaultTitle: "Wedding Photography Agreement",
        sections: [
          { bodyHtml: "<h2>WEDDING PHOTOGRAPHY AGREEMENT</h2><p>Entered on {contractDate} between {photographerName} (\"Photographer\") and {clientName} (\"Client\").</p>" },
          { bodyHtml: "<h3>1. WEDDING DETAILS</h3><p>Date: {eventDate}<br>Ceremony: {ceremonyLocation}<br>Reception: {receptionLocation}<br>Coverage Hours: {coverageHours}</p>" },
          { bodyHtml: "<h3>2. FEES</h3><p>Total Price: ${totalPrice}<br>Deposit: ${depositAmount} due at signing (non-refundable). Balance due {balanceDueDate}.</p>" },
          { bodyHtml: "<h3>3. SCHEDULE & COOPERATION</h3><p>Client will provide a timeline and a day-of contact. Photographer is not responsible for missed moments due to delays or uncooperative subjects.</p>" },
          { bodyHtml: "<h3>4. COPYRIGHT & LICENSE</h3><p>Photographer owns copyright. Client receives a personal-use license.</p>" },
          { bodyHtml: "<h3>5. MEALS & BREAKS</h3><p>Photographer(s) to receive {mealBreakTime} meal break for coverage exceeding 5 hours.</p>" },
          { bodyHtml: "<h3>6. LIABILITY & FORCE MAJEURE</h3><p>Photographer is not liable for failure to perform due to events beyond control.</p>" },
          { bodyHtml: "<h3>7. DELIVERY</h3><p>Final images delivered within {deliveryDays} days.</p>" }
        ]
      },
      event: {
        name: "Event Photography Contract",
        defaultTitle: "Event Photography Agreement",
        sections: [
          { bodyHtml: "<h2>EVENT PHOTOGRAPHY AGREEMENT</h2><p>Between {photographerName} and {clientName}, effective {contractDate}.</p>" },
          { bodyHtml: "<h3>1. EVENT INFO</h3><p>Date: {eventDate}<br>Location: {eventLocation}<br>Type: {eventType}<br>Coverage Hours: {coverageHours}</p>" },
          { bodyHtml: "<h3>2. PAYMENT</h3><p>Total: ${totalPrice}<br>Deposit: ${depositAmount} due at signing. Balance due {balanceDueDate}.</p>" },
          { bodyHtml: "<h3>3. COPYRIGHT</h3><p>Photographer retains copyright. Client has license for event promotion and personal use.</p>" },
          { bodyHtml: "<h3>4. RESCHEDULING & CANCELLATION</h3><p>At least {rescheduleNoticeDays} days notice required to reschedule. Retainer non-refundable.</p>" },
          { bodyHtml: "<h3>5. DELIVERY</h3><p>Images delivered within {deliveryDays} days.</p>" }
        ]
      },
      commercial: {
        name: "Commercial Photography Contract",
        defaultTitle: "Commercial Photography Agreement",
        sections: [
          { bodyHtml: "<h2>COMMERCIAL PHOTOGRAPHY AGREEMENT</h2><p>Between {studioName} and {clientName}, dated {contractDate}.</p>" },
          { bodyHtml: "<h3>1. PROJECT SCOPE</h3><p>Shoot: {shootScope}<br>Date: {shootDate}<br>Location: {shootLocation}<br>Deliverables: {deliverableCount} final images.</p>" },
          { bodyHtml: "<h3>2. FEES & PAYMENT</h3><p>Total: ${totalPrice}<br>Deposit: ${depositAmount} due at signing. Balance due on delivery.</p>" },
          { bodyHtml: "<h3>3. LICENSE & USAGE</h3><p>License Type: {licenseType}<br>Usage Term: {usageTerm}<br>Additional usage requires separate agreement.</p>" },
          { bodyHtml: "<h3>4. COPYRIGHT</h3><p>Photographer retains copyright. Client receives specified usage rights only.</p>" },
          { bodyHtml: "<h3>5. DELIVERY</h3><p>Final images delivered by {deliveryDate}.</p>" }
        ]
      },
      model_release: {
        name: "Model Release Form",
        defaultTitle: "Model Release Agreement",
        sections: [
          { bodyHtml: "<h2>MODEL RELEASE AGREEMENT</h2><p>I, {modelName}, grant {photographerName} permission to use my likeness from the shoot on {shootDate} at {shootLocation}.</p>" },
          { bodyHtml: "<h3>USAGE RIGHTS</h3><p>Images may be used for portfolio, marketing, exhibition, and editorial purposes.</p>" },
          { bodyHtml: "<h3>COMPENSATION</h3><p>Model acknowledges agreed compensation (if any) and waives further claims.</p>" },
          { bodyHtml: "<h3>RELEASE</h3><p>Model releases photographer from any liability related to use of images.</p>" }
        ]
      }
    };
  }

  async initializeTables() {
    if (!this.pool) {
      console.error('No database pool available for contract system');
      return;
    }
    try {
      // Create contracts table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS contracts (
          id VARCHAR(255) PRIMARY KEY,
          session_id VARCHAR(255),
          client_id VARCHAR(255),
          template_key VARCHAR(50),
          title VARCHAR(255),
          html TEXT,
          resolved_html TEXT,
          status VARCHAR(20) DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sent_at TIMESTAMP,
          viewed_at TIMESTAMP,
          signed_at TIMESTAMP,
          signer_ip VARCHAR(45),
          sign_url TEXT,
          sign_token VARCHAR(255),
          token_expires_at TIMESTAMP,
          pdf_url TEXT,
          pdf_hash VARCHAR(64),
          timeline JSONB DEFAULT '[]',
          metadata JSONB DEFAULT '{}'
        )
      `);

      // Create contract_templates table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS contract_templates (
          key VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255),
          default_title VARCHAR(255),
          sections JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Seed templates
      await this.seedTemplates();
      
      console.log('Contract tables initialized successfully');
    } catch (error) {
      console.error('Error initializing contract tables:', error);
    }
  }

  async seedTemplates() {
    for (const [key, template] of Object.entries(this.templates)) {
      try {
        await this.pool.query(`
          INSERT INTO contract_templates (key, name, default_title, sections)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO UPDATE SET
            name = EXCLUDED.name,
            default_title = EXCLUDED.default_title,
            sections = EXCLUDED.sections,
            updated_at = CURRENT_TIMESTAMP
        `, [key, template.name, template.defaultTitle, JSON.stringify(template.sections)]);
      } catch (error) {
        console.error(`Error seeding template ${key}:`, error);
      }
    }
    console.log('Contract templates seeded successfully');
  }

  async createContract(sessionId, clientId, templateKey, title, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const contractId = uuidv4();
      const template = this.templates[templateKey];
      
      if (!template) {
        throw new Error(`Invalid template key: ${templateKey}`);
      }

      const htmlContent = template.sections.map(s => s.bodyHtml).join('\n');
      const contractTitle = title || template.defaultTitle;

      const result = await client.query(`
        INSERT INTO contracts (
          id, session_id, client_id, template_key, title, html, status, timeline
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        contractId,
        sessionId,
        clientId || userId,
        templateKey,
        contractTitle,
        htmlContent,
        'draft',
        JSON.stringify([{ at: Date.now(), action: 'created', by: userId }])
      ]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getContractsBySession(sessionId) {
    const result = await this.pool.query(
      'SELECT * FROM contracts WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    );
    return result.rows;
  }

  async getContract(contractId) {
    const result = await this.pool.query(
      'SELECT * FROM contracts WHERE id = $1',
      [contractId]
    );
    return result.rows[0];
  }

  async sendContract(contractId, sessionData, clientData, studioData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const contract = await this.getContract(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Resolve merge fields
      const resolvedHtml = this.resolveMergeFields(contract.html, {
        ...sessionData,
        ...clientData,
        ...studioData,
        contractDate: new Date().toLocaleDateString()
      });

      // Create sign URL
      const signUrl = `/app/sign.html?contractId=${contractId}&k=${token}`;

      // Update contract
      await client.query(`
        UPDATE contracts SET
          resolved_html = $1,
          status = 'sent',
          sent_at = CURRENT_TIMESTAMP,
          sign_url = $2,
          sign_token = $3,
          token_expires_at = $4,
          timeline = timeline || $5::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        resolvedHtml,
        signUrl,
        token,
        tokenExpiresAt,
        JSON.stringify([{ at: Date.now(), action: 'sent', by: 'system' }]),
        contractId
      ]);

      await client.query('COMMIT');
      return { signUrl, token };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  resolveMergeFields(html, data) {
    let resolved = html;
    
    // Default values for common fields
    const defaults = {
      photographerName: 'Lance Casselman',
      photographerEmail: 'lance@thelegacyphotography.com',
      studioName: 'The Legacy Photography',
      deliveryDays: '30',
      rescheduleNoticeDays: '7',
      mealBreakTime: '30 minute',
      coverageHours: '8',
      deliverableCount: '50+',
      packageName: 'Standard Package',
      depositAmount: '0',
      totalPrice: '0',
      balanceDueDate: 'upon delivery',
      eventType: 'Photography Session',
      shootScope: 'As discussed',
      licenseType: 'Limited Commercial',
      usageTerm: '1 year',
      deliveryDate: 'Within 30 days'
    };

    const mergeData = { ...defaults, ...data };

    // Replace all merge fields
    Object.keys(mergeData).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      resolved = resolved.replace(regex, mergeData[key] || '');
    });

    return resolved;
  }

  async markViewed(contractId) {
    await this.pool.query(`
      UPDATE contracts SET
        viewed_at = CURRENT_TIMESTAMP,
        status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
        timeline = timeline || $1::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [
      JSON.stringify([{ at: Date.now(), action: 'viewed', by: 'client' }]),
      contractId
    ]);
  }

  async verifyToken(contractId, token) {
    const result = await this.pool.query(
      'SELECT * FROM contracts WHERE id = $1 AND sign_token = $2 AND token_expires_at > NOW()',
      [contractId, token]
    );
    return result.rows[0];
  }

  async updateContract(contractId, updates) {
    const allowedFields = ['html', 'title', 'metadata'];
    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(contractId);
    
    await this.pool.query(
      `UPDATE contracts SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`,
      values
    );
  }

  async deleteContract(contractId) {
    await this.pool.query('DELETE FROM contracts WHERE id = $1', [contractId]);
  }
}

module.exports = ContractSystem;