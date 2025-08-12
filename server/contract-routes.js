const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Create contract routes
function createContractRoutes(pool, r2FileManager) {
    const router = express.Router();

    // Get all contract templates
    router.get('/templates', async (req, res) => {
        try {
            const ContractManager = require('./contracts');
            const contractManager = new ContractManager();
            const templates = contractManager.getContractTemplates();
            res.json(templates);
        } catch (error) {
            console.error('Error fetching contract templates:', error);
            res.status(500).json({ error: 'Failed to fetch contract templates' });
        }
    });

    // Create a new contract
    router.post('/', async (req, res) => {
        try {
            const { sessionId, contractType, contractData } = req.body;
            const userId = req.session?.user?.uid;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const ContractManager = require('./contracts');
            const contractManager = new ContractManager();
            
            const contract = await contractManager.createContract(sessionId, userId, contractType, contractData);

            // Save contract to database
            const client = await pool.connect();
            try {
                const insertQuery = `
                    INSERT INTO contracts (
                        id, session_id, user_id, contract_type, contract_title, 
                        contract_content, status, client_name, client_email,
                        photographer_name, photographer_email, access_token,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING *
                `;
                
                const values = [
                    contract.id, contract.sessionId, contract.userId, contract.contractType,
                    contract.contractTitle, contract.contractContent, contract.status,
                    contract.clientName, contract.clientEmail, contract.photographerName,
                    contract.photographerEmail, contract.accessToken, contract.createdAt, contract.updatedAt
                ];

                const result = await client.query(insertQuery, values);
                res.json(result.rows[0]);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error creating contract:', error);
            res.status(500).json({ error: 'Failed to create contract' });
        }
    });

    // Get contracts for a session
    router.get('/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const userId = req.session?.user?.uid;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const client = await pool.connect();
            try {
                const result = await client.query(
                    'SELECT * FROM contracts WHERE session_id = $1 AND user_id = $2 ORDER BY created_at DESC',
                    [sessionId, userId]
                );
                res.json(result.rows);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching contracts:', error);
            res.status(500).json({ error: 'Failed to fetch contracts' });
        }
    });

    // Update contract status
    router.put('/:contractId/status', async (req, res) => {
        try {
            const { contractId } = req.params;
            const { status } = req.body;
            const userId = req.session?.user?.uid;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const client = await pool.connect();
            try {
                const result = await client.query(
                    'UPDATE contracts SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
                    [status, contractId, userId]
                );
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Contract not found' });
                }
                
                res.json(result.rows[0]);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error updating contract status:', error);
            res.status(500).json({ error: 'Failed to update contract status' });
        }
    });

    // Get public contract view (for client signing)
    router.get('/view/:accessToken', async (req, res) => {
        try {
            const { accessToken } = req.params;

            const client = await pool.connect();
            try {
                const result = await client.query(
                    'SELECT * FROM contracts WHERE access_token = $1',
                    [accessToken]
                );
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Contract not found' });
                }
                
                const contract = result.rows[0];
                // Remove sensitive data for public view
                delete contract.user_id;
                delete contract.access_token;
                
                res.json(contract);
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching public contract:', error);
            res.status(500).json({ error: 'Failed to fetch contract' });
        }
    });

    // Sign contract
    router.post('/sign/:accessToken', async (req, res) => {
        try {
            const { accessToken } = req.params;
            const { signature, signedAt } = req.body;

            const client = await pool.connect();
            try {
                const result = await client.query(
                    `UPDATE contracts SET 
                        status = 'signed', 
                        client_signature = $1, 
                        signed_at = $2, 
                        updated_at = NOW() 
                     WHERE access_token = $3 
                     RETURNING *`,
                    [signature, signedAt, accessToken]
                );
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Contract not found' });
                }
                
                res.json({ success: true, contract: result.rows[0] });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error signing contract:', error);
            res.status(500).json({ error: 'Failed to sign contract' });
        }
    });

    return router;
}

module.exports = createContractRoutes;