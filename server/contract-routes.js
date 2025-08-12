const express = require('express');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const ContractSystem = require('./contract-system');

module.exports = function(pool, r2FileManager) {
  const router = express.Router();
  const contractSystem = new ContractSystem(pool);
  
  // Initialize contract tables on startup
  contractSystem.initializeTables().catch(console.error);

// Get available templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await contractSystem.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new contract
router.post('/create', async (req, res) => {
  try {
    const { sessionId, clientId, templateKey, title } = req.body;
    const userId = req.user?.id || req.session?.userId || 'system';
    
    if (!sessionId || !templateKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const contract = await contractSystem.createContract(
      sessionId,
      clientId,
      templateKey,
      title,
      userId
    );
    
    res.json(contract);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contracts for a session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const contracts = await contractSystem.getContractsBySession(req.params.sessionId);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific contract
router.get('/:id', async (req, res) => {
  try {
    const contract = await contractSystem.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send contract for signature
router.post('/send', async (req, res) => {
  try {
    const { contractId } = req.body;
    
    if (!contractId) {
      return res.status(400).json({ error: 'Contract ID required' });
    }

    // Get contract details
    const contract = await contractSystem.getContract(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get session and client data
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [contract.session_id]
    );
    const session = sessionResult.rows[0];

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = {
      clientName: session.client_name,
      clientEmail: session.email,
      eventDate: new Date(session.date_time).toLocaleDateString(),
      eventLocation: session.location,
      totalPrice: session.price,
      depositAmount: session.deposit_amount || '0'
    };

    const studioData = {
      photographerName: 'Lance Casselman',
      photographerEmail: 'lance@thelegacyphotography.com',
      studioName: 'The Legacy Photography'
    };

    const result = await contractSystem.sendContract(
      contractId,
      sessionData,
      { clientName: session.client_name, clientEmail: session.email },
      studioData
    );

    // Get the full URL for the sign link
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const fullSignUrl = `${protocol}://${host}${result.signUrl}`;

    res.json({ 
      signUrl: fullSignUrl,
      token: result.token,
      clientEmail: session.email,
      clientName: session.client_name
    });
  } catch (error) {
    console.error('Error sending contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark contract as viewed
router.post('/:id/viewed', async (req, res) => {
  try {
    await contractSystem.markViewed(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking contract viewed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sign contract
router.post('/:id/sign', async (req, res) => {
  try {
    const { signatureDataUrl, signerIp, token } = req.body;
    const contractId = req.params.id;

    // Verify token
    const contract = await contractSystem.verifyToken(contractId, token);
    if (!contract) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get session data for client name
    const sessionResult = await pool.query(
      'SELECT client_name FROM sessions WHERE id = $1',
      [contract.session_id]
    );
    const session = sessionResult.rows[0];
    const clientName = session?.client_name || 'Client';

    // Create PDF with signature
    const pdfBuffer = await createSignedPDF(contract, signatureDataUrl, clientName, signerIp);
    
    // Calculate hash
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    
    // Upload to R2 using the file manager
    const filename = `contract-${contract.client_id}-${contract.session_id}-${Date.now()}.pdf`;
    const pdfUrl = await r2FileManager.uploadFile(
      pdfBuffer, 
      filename, 
      contract.client_id, 
      contract.session_id,
      'application/pdf'
    );

    // Update contract record
    await pool.query(`
      UPDATE contracts SET
        status = 'signed',
        signed_at = CURRENT_TIMESTAMP,
        signer_ip = $1,
        pdf_url = $2,
        pdf_hash = $3,
        timeline = timeline || $4::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [
      signerIp,
      pdfUrl,
      pdfHash,
      JSON.stringify([{ at: Date.now(), action: 'signed', by: clientName }]),
      contractId
    ]);

    res.json({ pdfUrl, success: true });
  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update contract (draft only)
router.put('/:id', async (req, res) => {
  try {
    const contract = await contractSystem.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit draft contracts' });
    }

    await contractSystem.updateContract(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete contract (draft only)
router.delete('/:id', async (req, res) => {
  try {
    const contract = await contractSystem.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete draft contracts' });
    }

    await contractSystem.deleteContract(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to create signed PDF
async function createSignedPDF(contract, signatureDataUrl, clientName, signerIp) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      
      // Add contract content
      doc.fontSize(12);
      
      // Parse HTML content (simplified - in production use a proper HTML to PDF library)
      const htmlContent = contract.resolved_html || contract.html;
      const lines = htmlContent
        .replace(/<h2>/g, '\n\n')
        .replace(/<\/h2>/g, '\n\n')
        .replace(/<h3>/g, '\n')
        .replace(/<\/h3>/g, '\n')
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<[^>]+>/g, '');
      
      doc.text(lines, 50, 50, { width: 500 });
      
      // Add signature if provided
      if (signatureDataUrl) {
        doc.addPage();
        doc.text('ELECTRONIC SIGNATURE', 50, 50);
        
        // Convert data URL to buffer and add to PDF
        const base64Data = signatureDataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 50, 100, { width: 200 });
        
        // Add audit footer
        doc.fontSize(10);
        doc.text(
          `Signed electronically by ${clientName} on ${new Date().toISOString()} from IP ${signerIp}`,
          50, 350
        );
      }
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

  return router;
};