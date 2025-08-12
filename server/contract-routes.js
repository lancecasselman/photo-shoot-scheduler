const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email sending function
async function sendEmail({ to, subject, html, attachments }) {
    if (!process.env.SENDGRID_API_KEY) {
        console.log('Email would be sent:', { to, subject });
        return;
    }

    const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@photomanagement.com',
        subject,
        html,
        attachments: attachments?.map(att => ({
            content: att.content.toString('base64'),
            filename: att.filename,
            type: att.contentType || 'application/octet-stream',
            disposition: 'attachment'
        }))
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully to:', to);
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
}

// Contract templates (same as frontend)
const contractTemplates = {
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
        name: "Commercial / Branding Contract",
        defaultTitle: "Commercial Photography Agreement",
        sections: [
            { bodyHtml: "<h2>COMMERCIAL PHOTOGRAPHY AGREEMENT</h2><p>Between {photographerName} and {clientName} on {contractDate}.</p>" },
            { bodyHtml: "<h3>1. PROJECT DETAILS</h3><p>Date: {eventDate}<br>Location: {eventLocation}<br>Scope: {shootScope}<br>Deliverables: {deliverableCount} images</p>" },
            { bodyHtml: "<h3>2. USAGE RIGHTS</h3><p>Client is granted a {licenseType} license for {usageTerm} years. All other rights remain with Photographer.</p>" },
            { bodyHtml: "<h3>3. PAYMENT</h3><p>Total: ${totalPrice}<br>Deposit: ${depositAmount} due at signing. Balance due {balanceDueDate}.</p>" },
            { bodyHtml: "<h3>4. LIABILITY</h3><p>Photographer is not liable for consequential damages from image use.</p>" },
            { bodyHtml: "<h3>5. DELIVERY</h3><p>Images delivered by {deliveryDate}.</p>" }
        ]
    },
    model_release: {
        name: "Model Release",
        defaultTitle: "Model Release",
        sections: [
            { bodyHtml: "<h2>MODEL RELEASE</h2><p>I, {modelName}, grant {photographerName} permission to use my likeness in photographs, videos, and other media taken on {shootDate} at {shootLocation}. I authorize editing, publication, distribution, and licensing of the images for commercial, promotional, or artistic purposes in any medium. I waive any right to royalties or compensation.</p>" },
            { bodyHtml: "<p>Signed: __________________ (Model)<br>Date: ___________________</p>" }
        ]
    }
};

// Create contract routes
module.exports = function(pool, r2FileManager) {
    // Get all contracts for current user
    router.get('/', async (req, res) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const result = await pool.query(
                `SELECT * FROM contracts 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC`,
                [req.session.user.uid]
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching contracts:', error);
            res.status(500).json({ error: 'Failed to fetch contracts' });
        }
    });

    // Get single contract
    router.get('/:id', async (req, res) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const result = await pool.query(
                `SELECT * FROM contracts 
                 WHERE id = $1 AND user_id = $2`,
                [req.params.id, req.session.user.uid]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Contract not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching contract:', error);
            res.status(500).json({ error: 'Failed to fetch contract' });
        }
    });

    // View contract (for clients with token)
    router.get('/:id/view', async (req, res) => {
        const { token } = req.query;

        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }

        try {
            const result = await pool.query(
                `SELECT * FROM contracts 
                 WHERE id = $1 AND access_token = $2`,
                [req.params.id, token]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Contract not found or invalid token' });
            }

            const contract = result.rows[0];
            
            // Don't expose sensitive data to clients
            const customFields = contract.custom_fields || {};
            const clientContract = {
                id: contract.id,
                title: contract.contract_title,
                html: customFields.resolvedHtml || contract.contract_content,
                status: contract.status,
                signedAt: contract.signed_date,
                pdfUrl: customFields.pdfUrl
            };

            res.json(clientContract);
        } catch (error) {
            console.error('Error viewing contract:', error);
            res.status(500).json({ error: 'Failed to view contract' });
        }
    });

    // Create new contract
    router.post('/create', async (req, res) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId, clientId, templateKey, title, html } = req.body;

        try {
            const id = crypto.randomUUID();
            const now = Date.now();

            // If templateKey provided, use template
            let contractHtml = html;
            let contractTitle = title;

            if (templateKey && !html) {
                const template = contractTemplates[templateKey];
                if (!template) {
                    return res.status(400).json({ error: 'Invalid template' });
                }
                contractHtml = template.sections.map(s => s.bodyHtml).join('\n');
                contractTitle = title || template.defaultTitle;
            }

            // Create contract record
            const result = await pool.query(
                `INSERT INTO contracts (
                    id, user_id, session_id, 
                    contract_type, contract_title, contract_content, status,
                    photographer_name, photographer_email,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                RETURNING *`,
                [
                    id,
                    req.session.user.uid,
                    sessionId || null,
                    templateKey || 'custom',
                    contractTitle,
                    contractHtml,
                    'draft',
                    req.session.user.displayName || req.session.user.email,
                    req.session.user.email,
                    new Date(),
                    new Date()
                ]
            );

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error creating contract:', error);
            res.status(500).json({ error: 'Failed to create contract' });
        }
    });

    // Send contract for signature
    router.post('/send', async (req, res) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { contractId, clientEmail, message } = req.body;

        try {
            // Get contract
            const contractResult = await pool.query(
                `SELECT * FROM contracts 
                 WHERE id = $1 AND user_id = $2`,
                [contractId, req.session.user.uid]
            );

            if (contractResult.rows.length === 0) {
                return res.status(404).json({ error: 'Contract not found' });
            }

            const contract = contractResult.rows[0];

            // Generate view token
            const viewToken = crypto.randomBytes(32).toString('hex');

            // Get session data if linked
            let sessionData = null;
            if (contract.session_id) {
                const sessionResult = await pool.query(
                    `SELECT * FROM photography_sessions WHERE id = $1`,
                    [contract.session_id]
                );
                if (sessionResult.rows.length > 0) {
                    sessionData = sessionResult.rows[0];
                }
            }

            // Resolve merge fields
            const resolvedHtml = resolveMergeFields(contract.contract_content || '', {
                photographerName: req.session.user.displayName || 'Photographer',
                photographerEmail: req.session.user.email,
                studioName: 'Photography Studio',
                clientName: sessionData?.client_name || clientEmail.split('@')[0],
                clientEmail: clientEmail,
                contractDate: new Date().toLocaleDateString(),
                eventDate: sessionData?.date_time ? new Date(sessionData.date_time).toLocaleDateString() : 'TBD',
                eventLocation: sessionData?.location || 'TBD',
                totalPrice: sessionData?.price || '0',
                depositAmount: sessionData?.deposit_amount || '0',
                deliveryDays: '30',
                rescheduleNoticeDays: '7',
                coverageHours: sessionData?.duration ? `${sessionData.duration / 60} hours` : 'TBD',
                packageName: sessionData?.session_type || 'Standard Package',
                deliverableCount: '50+',
                balanceDueDate: 'on event date',
                mealBreakTime: '30-minute'
            });

            // Update contract with resolved HTML and token
            const now = new Date();
            const customFields = contract.custom_fields || {};
            customFields.resolvedHtml = resolvedHtml;

            await pool.query(
                `UPDATE contracts 
                 SET status = 'sent', 
                     sent_at = $1, 
                     access_token = $2,
                     client_email = $3,
                     custom_fields = $4,
                     updated_at = $5
                 WHERE id = $6`,
                [now, viewToken, clientEmail, JSON.stringify(customFields), now, contractId]
            );

            // Generate signature link
            const signatureLink = `${req.protocol}://${req.get('host')}/sign.html?contractId=${contractId}&token=${viewToken}`;

            // Send email to client
            const emailHtml = `
                <h2>Contract Ready for Signature</h2>
                <p>Hello,</p>
                <p>${message || 'Your contract is ready for review and signature.'}</p>
                <p><a href="${signatureLink}" style="display: inline-block; padding: 12px 24px; background: #C4962D; color: white; text-decoration: none; border-radius: 6px;">Review and Sign Contract</a></p>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>${signatureLink}</p>
                <p>Best regards,<br>${req.session.user.displayName || 'Your Photographer'}</p>
            `;

            await sendEmail({
                to: clientEmail,
                subject: `Contract Ready for Signature - ${contract.contract_title}`,
                html: emailHtml
            });

            // Send notification to photographer
            await sendEmail({
                to: req.session.user.email,
                subject: `Contract Sent - ${contract.contract_title}`,
                html: `<p>Your contract "${contract.contract_title}" has been sent to ${clientEmail} for signature.</p>`
            });

            res.json({ success: true, message: 'Contract sent successfully' });
        } catch (error) {
            console.error('Error sending contract:', error);
            res.status(500).json({ error: 'Failed to send contract' });
        }
    });

    // Mark contract as viewed
    router.post('/:id/viewed', async (req, res) => {
        const { token } = req.body;

        try {
            const now = Date.now();
            const result = await pool.query(
                `UPDATE contracts 
                 SET status = CASE 
                     WHEN status = 'sent' THEN 'viewed' 
                     ELSE status 
                 END,
                 viewed_at = $1,
                 updated_at = $2
                 WHERE id = $3 AND access_token = $4
                 RETURNING id`,
                [now, now, req.params.id, token]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Contract not found' });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error marking as viewed:', error);
            res.status(500).json({ error: 'Failed to mark as viewed' });
        }
    });

    // Sign contract
    router.post('/:id/sign', async (req, res) => {
        const { token, signatureDataUrl, signerName, signerEmail, signerIp } = req.body;

        try {
            // Get contract
            const contractResult = await pool.query(
                `SELECT * FROM contracts 
                 WHERE id = $1 AND access_token = $2`,
                [req.params.id, token]
            );

            if (contractResult.rows.length === 0) {
                return res.status(404).json({ error: 'Contract not found or invalid token' });
            }

            const contract = contractResult.rows[0];

            if (contract.status === 'signed') {
                return res.status(400).json({ error: 'Contract already signed' });
            }

            // Generate PDF with signature
            const pdfBuffer = await generateSignedPDF(contract, signatureDataUrl, signerName, signerIp);

            // Calculate hash
            const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

            // Upload to R2
            const timestamp = Date.now();
            const filename = `contracts/contract-${contract.client_id || 'unknown'}-${contract.session_id || 'nosession'}-${timestamp}.pdf`;
            
            let pdfUrl = null;
            if (r2FileManager) {
                try {
                    const uploadResult = await r2FileManager.uploadFile(
                        pdfBuffer,
                        filename,
                        'application/pdf'
                    );
                    pdfUrl = uploadResult.url;
                } catch (uploadError) {
                    console.error('Failed to upload PDF to R2:', uploadError);
                    // Continue without R2 URL
                }
            }

            // Update contract record
            const now = Date.now();
            const timeline = JSON.parse(contract.timeline || '[]');
            timeline.push({
                at: now,
                action: `Contract signed by ${signerName}`,
                by: signerEmail
            });

            const customFields = contract.custom_fields || {};
            customFields.pdfUrl = pdfUrl;
            customFields.pdfHash = pdfHash;
            customFields.signerIp = signerIp;
            customFields.timeline = timeline;

            await pool.query(
                `UPDATE contracts 
                 SET status = 'signed',
                     signed_date = $1,
                     client_name = $2,
                     client_email = $3,
                     client_signature = $4,
                     client_signature_date = $5,
                     custom_fields = $6,
                     updated_at = $7
                 WHERE id = $8`,
                [
                    new Date(),
                    signerName,
                    signerEmail,
                    signatureDataUrl,
                    new Date(),
                    JSON.stringify(customFields),
                    new Date(),
                    req.params.id
                ]
            );

            // Send emails with PDF attachment
            const emailAttachments = [{
                filename: `${(contract.contract_title || 'contract').replace(/[^a-z0-9]/gi, '_')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }];

            // Email to client
            await sendEmail({
                to: signerEmail,
                subject: `Signed Contract - ${contract.contract_title}`,
                html: `
                    <h2>Contract Signed Successfully</h2>
                    <p>Thank you for signing the contract "${contract.contract_title}".</p>
                    <p>A copy of the signed contract is attached to this email for your records.</p>
                    <p>Signed on: ${new Date().toLocaleString()}</p>
                `,
                attachments: emailAttachments
            });

            // Email to photographer
            const photographerResult = await pool.query(
                `SELECT email, display_name FROM users WHERE uid = $1`,
                [contract.user_id]
            );

            if (photographerResult.rows.length > 0) {
                await sendEmail({
                    to: photographerResult.rows[0].email,
                    subject: `Contract Signed by ${signerName} - ${contract.contract_title}`,
                    html: `
                        <h2>Contract Signed</h2>
                        <p>Great news! Your contract "${contract.contract_title}" has been signed.</p>
                        <p><strong>Signed by:</strong> ${signerName} (${signerEmail})</p>
                        <p><strong>Signed on:</strong> ${new Date(now).toLocaleString()}</p>
                        <p><strong>IP Address:</strong> ${signerIp}</p>
                        <p>A copy of the signed contract is attached.</p>
                    `,
                    attachments: emailAttachments
                });
            }

            res.json({
                success: true,
                signedAt: now,
                signerName,
                pdfUrl,
                signatureImage: signatureDataUrl
            });

        } catch (error) {
            console.error('Error signing contract:', error);
            res.status(500).json({ error: 'Failed to sign contract' });
        }
    });

    // Download PDF
    router.get('/:id/pdf', async (req, res) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const result = await pool.query(
                `SELECT custom_fields, contract_title FROM contracts 
                 WHERE id = $1 AND user_id = $2`,
                [req.params.id, req.session.user.uid]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Contract not found' });
            }

            const contract = result.rows[0];
            const customFields = contract.custom_fields || {};
            const pdfUrl = customFields.pdfUrl;

            if (!pdfUrl) {
                return res.status(404).json({ error: 'PDF not available' });
            }

            // If R2 URL, redirect to it
            if (pdfUrl.startsWith('http')) {
                res.redirect(pdfUrl);
            } else {
                res.status(404).json({ error: 'PDF file not found' });
            }

        } catch (error) {
            console.error('Error downloading PDF:', error);
            res.status(500).json({ error: 'Failed to download PDF' });
        }
    });

    return router;
};

// Helper function to resolve merge fields
function resolveMergeFields(html, data) {
    let resolved = html;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        resolved = resolved.replace(regex, value || '');
    }
    return resolved;
}

// Generate signed PDF
async function generateSignedPDF(contract, signatureDataUrl, signerName, signerIp) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Add content
            doc.fontSize(20).text(contract.contract_title || 'Contract', { align: 'center' });
            doc.moveDown();

            // Convert HTML to plain text (simplified)
            const customFields = contract.custom_fields || {};
            const plainText = (customFields.resolvedHtml || contract.contract_content || '')
                .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n$1\n')
                .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n$1\n')
                .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');

            doc.fontSize(11).text(plainText, { align: 'left' });

            // Add signature if provided
            if (signatureDataUrl) {
                doc.moveDown(2);
                doc.fontSize(12).text('Electronic Signature:', { underline: true });
                
                // Convert data URL to buffer
                const signatureData = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
                const signatureBuffer = Buffer.from(signatureData, 'base64');
                
                doc.image(signatureBuffer, {
                    fit: [200, 60],
                    align: 'left'
                });
            }

            // Add audit footer
            doc.moveDown(2);
            doc.fontSize(9).fillColor('#666666');
            doc.text(`Signed electronically by ${signerName} on ${new Date().toISOString()}`);
            doc.text(`IP Address: ${signerIp}`);
            doc.text(`Document Hash: ${crypto.createHash('sha256').update(contract.resolved_html || contract.html).digest('hex').substring(0, 16)}...`);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}