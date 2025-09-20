const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Import database schema and ORM
const { 
  downloadTokens, 
  digitalTransactions
} = require('../shared/schema');
const { eq } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/node-postgres');

// Database connection for webhook handler
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = drizzle(pool);

async function handleDownloadWebhook(session) {
  try {
    console.log(`💳 Processing download payment completion: ${session.id}`);
    
    const { sessionId, photoId, token, photographerId, clientEmail, clientName } = session.metadata;
    
    if (!sessionId || !photoId || !token) {
      console.error('❌ Missing required metadata in webhook:', session.metadata);
      return;
    }
    
    // Verify token is valid and belongs to session
    const downloadToken = await db
      .select()
      .from(downloadTokens)
      .where(eq(downloadTokens.token, token))
      .limit(1);

    if (downloadToken.length === 0 || downloadToken[0].sessionId !== sessionId) {
      console.error('❌ Invalid token in webhook metadata:', token);
      return;
    }
    
    // Check for existing transaction to prevent duplicates
    const existingTransaction = await db
      .select()
      .from(digitalTransactions)
      .where(eq(digitalTransactions.stripeSessionId, session.id))
      .limit(1);
      
    if (existingTransaction.length > 0) {
      console.log(`✅ Transaction already recorded for session ${session.id}`);
      return;
    }
    
    // Record the transaction
    const transactionId = uuidv4();
    await db.insert(digitalTransactions).values({
      id: transactionId,
      sessionId,
      userId: photographerId,
      photoId,
      stripeSessionId: session.id,
      amount: session.amount_total / 100, // Convert from cents
      downloadToken: token,
      status: 'completed',
      clientEmail: clientEmail || session.customer_email,
      clientName: clientName || 'Unknown',
      createdAt: new Date()
    });
    
    console.log(`✅ Webhook: Payment recorded for photo ${photoId}, transaction: ${transactionId}`);
    
  } catch (error) {
    console.error('❌ Error processing download checkout completion:', error);
    throw error;
  }
}

module.exports = { handleDownloadWebhook };