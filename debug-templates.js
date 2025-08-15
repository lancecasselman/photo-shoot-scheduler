
const express = require('express');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debugTemplates() {
    const client = await pool.connect();
    
    try {
        console.log(' Debugging Booking Agreement Templates...\n');
        
        // Check what's in the database
        const dbResult = await client.query('SELECT * FROM booking_agreement_templates ORDER BY created_at');
        console.log(` Found ${dbResult.rows.length} templates in database:`);
        
        dbResult.rows.forEach((template, index) => {
            console.log(`${index + 1}. Name: "${template.name}"`);
            console.log(`   Category: ${template.category}`);
            console.log(`   Is Default: ${template.is_default}`);
            console.log(`   Created: ${template.created_at}`);
            console.log(`   Content Length: ${template.content.length} chars`);
            console.log('---');
        });
        
        // Check the templates from the file
        const { bookingAgreementTemplates } = require('./server/booking-agreement-templates');
        console.log(`\n📁 Templates defined in file: ${Object.keys(bookingAgreementTemplates).length}`);
        
        Object.entries(bookingAgreementTemplates).forEach(([key, template], index) => {
            console.log(`${index + 1}. Key: "${key}"`);
            console.log(`   Name: "${template.name}"`);
            console.log(`   Category: ${template.category}`);
            console.log('---');
        });
        
        // Check for mismatches
        const fileTemplateNames = Object.values(bookingAgreementTemplates).map(t => t.name);
        const dbTemplateNames = dbResult.rows.map(t => t.name);
        
        const missingInDb = fileTemplateNames.filter(name => !dbTemplateNames.includes(name));
        const extraInDb = dbTemplateNames.filter(name => !fileTemplateNames.includes(name));
        
        if (missingInDb.length > 0) {
            console.log(`\n❌ Templates missing from database:`);
            missingInDb.forEach(name => console.log(`   - ${name}`));
        }
        
        if (extraInDb.length > 0) {
            console.log(`\n Extra templates in database (not in file):`);
            extraInDb.forEach(name => console.log(`   - ${name}`));
        }
        
        if (missingInDb.length === 0 && extraInDb.length === 0) {
            console.log(`\n All templates are synchronized between file and database`);
        }
        
    } catch (error) {
        console.error('❌ Error debugging templates:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

debugTemplates();
