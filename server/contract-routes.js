const express = require('express');
const ContractSystem = require('./contract-system');

module.exports = function(pool, r2FileManager) {
  const router = express.Router();
  const contractSystem = new ContractSystem(pool);

  // Initialize tables on startup
  contractSystem.initializeTables();

  // Get all contracts for authenticated user
  router.get('/', async (req, res) => {
    try {
      if (!req.session?.user?.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const contracts = await contractSystem.getAllContracts(req.session.user.uid);
      res.json(contracts);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  // Get contracts for a specific session
  router.get('/session/:sessionId', async (req, res) => {
    try {
      if (!req.session?.user?.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const contracts = await contractSystem.getContractsBySession(req.params.sessionId);
      res.json(contracts);
    } catch (error) {
      console.error('Error fetching session contracts:', error);
      res.status(500).json({ error: 'Failed to fetch session contracts' });
    }
  });

  // Get a specific contract
  router.get('/:id', async (req, res) => {
    try {
      const contract = await contractSystem.getContract(req.params.id);
      
      // Allow access if authenticated user owns it or if accessing via token
      if (req.session?.user?.uid) {
        // Authenticated access
        res.json(contract);
      } else if (req.query.k) {
        // Token-based access for clients
        const verified = await contractSystem.verifyToken(req.params.id, req.query.k);
        if (verified) {
          res.json(contract);
        } else {
          res.status(401).json({ error: 'Invalid or expired token' });
        }
      } else {
        res.status(401).json({ error: 'Authentication required' });
      }
    } catch (error) {
      console.error('Error fetching contract:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  });

  // Get available templates
  router.get('/templates/list', async (req, res) => {
    try {
      const templates = await contractSystem.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create a new contract
  router.post('/create', async (req, res) => {
    try {
      if (!req.session?.user?.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { sessionId, clientId, templateKey, title } = req.body;
      
      if (!sessionId || !templateKey) {
        return res.status(400).json({ error: 'sessionId and templateKey are required' });
      }
      
      const contract = await contractSystem.createContract(
        sessionId, 
        clientId, 
        templateKey, 
        title,
        req.session.user.uid
      );
      
      res.json(contract);
    } catch (error) {
      console.error('Error creating contract:', error);
      res.status(500).json({ error: 'Failed to create contract' });
    }
  });

  // Update contract (draft only)
  router.put('/:id', async (req, res) => {
    try {
      if (!req.session?.user?.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const contract = await contractSystem.getContract(req.params.id);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      if (contract.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft contracts can be edited' });
      }
      
      await contractSystem.updateContract(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating contract:', error);
      res.status(500).json({ error: 'Failed to update contract' });
    }
  });

  // Send contract for signature
  router.post('/send', async (req, res) => {
    try {
      if (!req.session?.user?.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { contractId } = req.body;
      
      if (!contractId) {
        return res.status(400).json({ error: 'contractId is required' });
      }
      
      // Get contract and session data
      const contract = await contractSystem.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Get session data
      const sessionResult = await pool.query(
        'SELECT * FROM photography_sessions WHERE id = $1',
        [contract.session_id]
      );
      const session = sessionResult.rows[0];
      
      // Prepare merge data
      const sessionData = {
        clientName: session?.client_name || contract.client_name,
        clientEmail: session?.email || contract.client_email,
        eventDate: session?.date_time ? new Date(session.date_time).toLocaleDateString() : '',
        eventLocation: session?.location || '',
        totalPrice: session?.price || '0',
        depositAmount: session?.deposit_amount || '0'
      };
      
      const clientData = {
        clientName: contract.client_name,
        clientEmail: contract.client_email
      };
      
      const studioData = {
        photographerName: contract.photographer_name || 'Lance Casselman',
        photographerEmail: contract.photographer_email || 'lance@thelegacyphotography.com',
        studioName: 'The Legacy Photography'
      };
      
      const result = await contractSystem.sendContract(contractId, sessionData, clientData, studioData);
      
      // Build full sign URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers.host;
      const fullSignUrl = `${protocol}://${host}${result.signUrl}`;
      
      res.json({ 
        success: true, 
        signUrl: fullSignUrl,
        token: result.token 
      });
    } catch (error) {
      console.error('Error sending contract:', error);
      res.status(500).json({ error: 'Failed to send contract' });
    }
  });

  // Mark contract as viewed
  router.post('/:id/viewed', async (req, res) => {
    try {
      const { id } = req.params;
      const { k } = req.body;
      
      // Verify token if provided
      if (k) {
        const verified = await contractSystem.verifyToken(id, k);
        if (!verified) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
      }
      
      await contractSystem.markViewed(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking contract viewed:', error);
      res.status(500).json({ error: 'Failed to mark contract as viewed' });
    }
  });

  // Sign contract
  router.post('/:id/sign', async (req, res) => {
    try {
      const { id } = req.params;
      const { signatureDataUrl, signerIp, k } = req.body;
      
      if (!signatureDataUrl) {
        return res.status(400).json({ error: 'Signature is required' });
      }
      
      // Verify token
      const contract = await contractSystem.verifyToken(id, k);
      if (!contract) {
        return res.status(401).json({ error: 'Invalid or expired signing link' });
      }
      
      // TODO: Generate PDF with signature
      // For now, we'll just update the status
      await pool.query(`
        UPDATE contracts SET
          status = 'signed',
          signed_date = CURRENT_TIMESTAMP,
          signer_ip = $1,
          signature_data = $2
        WHERE id = $3
      `, [signerIp || req.ip, signatureDataUrl, id]);
      
      res.json({ 
        success: true,
        message: 'Contract signed successfully'
      });
    } catch (error) {
      console.error('Error signing contract:', error);
      res.status(500).json({ error: 'Failed to sign contract' });
    }
  });

  // Delete draft contract
  router.delete('/:id', async (req, res) => {
    try {
      if (!req.session?.user?.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const contract = await contractSystem.getContract(req.params.id);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      if (contract.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft contracts can be deleted' });
      }
      
      await pool.query('DELETE FROM contracts WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting contract:', error);
      res.status(500).json({ error: 'Failed to delete contract' });
    }
  });

  return router;
};