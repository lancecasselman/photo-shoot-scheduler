const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');

// Initialize services when API keys are available
let sendGridConfigured = false;
let twilioClient = null;

function initializeNotificationServices() {
    // Initialize SendGrid
    if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        sendGridConfigured = true;
        console.log('📧 SendGrid configured successfully');
    } else {
        console.log('⚠️ SendGrid API key not provided - email notifications disabled');
    }

    // Initialize Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('📱 Twilio configured successfully');
    } else {
        console.log('⚠️ Twilio credentials not provided - SMS notifications disabled');
    }
}

// Email Templates for Subscribers
const emailTemplates = {
    welcome: (photographerName, businessName) => ({
        subject: '🎉 Welcome to The Client Management Area!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px;">Welcome to The Client Management Area!</h1>
                    <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Professional Photography Session Management</p>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                    <h2 style="color: #333; margin-top: 0;">Hi ${photographerName}! 👋</h2>
                    <p style="color: #666; line-height: 1.6;">Welcome to your professional photography business management platform. You now have access to:</p>
                    
                    <ul style="color: #666; line-height: 1.8;">
                        <li>📅 <strong>Session Scheduling</strong> - Manage all your photography sessions</li>
                        <li>📸 <strong>Photo Gallery System</strong> - Share galleries with clients securely</li>
                        <li>💰 <strong>Stripe Invoicing</strong> - Professional billing and payment processing</li>
                        <li>📱 <strong>Mobile Optimization</strong> - Manage your business from anywhere</li>
                        <li>🔐 <strong>Secure Client Access</strong> - Private gallery links for each session</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://photomanagementsystem.com/" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Your Dashboard</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Your business "${businessName}" is now set up and ready to streamline your photography workflow!</p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                    <p>The Client Management Area - Professional Photography Business Management</p>
                    <p>Need help? Reply to this email for support.</p>
                </div>
            </div>
        `
    }),

    billing: (photographerName, amount, plan, dueDate) => ({
        subject: `💳 Invoice for The Client Management Area - $${amount}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #2c3e50; color: white; padding: 20px; border-radius: 10px;">
                    <h1 style="margin: 0; font-size: 24px;">Invoice - The Client Management Area</h1>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                    <h2 style="color: #333; margin-top: 0;">Hi ${photographerName},</h2>
                    <p style="color: #666; line-height: 1.6;">Your monthly subscription invoice is ready:</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Plan:</strong></td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${plan}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 18px; color: #667eea;"><strong>$${amount}</strong></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0;"><strong>Due Date:</strong></td>
                                <td style="padding: 10px 0; text-align: right;">${dueDate}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://photomanagementsystem.com/billing" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay Invoice</a>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                    <p>Questions about your bill? Reply to this email for support.</p>
                </div>
            </div>
        `
    }),

    featureUpdate: (title, features) => ({
        subject: `✨ New Features Available - ${title}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px;">
                    <h1 style="margin: 0; font-size: 24px;">✨ ${title}</h1>
                    <p style="margin: 10px 0 0; opacity: 0.9;">New features to enhance your photography business</p>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                    <h2 style="color: #333; margin-top: 0;">What's New:</h2>
                    
                    <div style="margin: 20px 0;">
                        ${Array.isArray(features) ? features.map(feature => `
                            <div style="background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea;">
                                <h3 style="margin: 0 0 10px; color: #333;">${feature.title || 'New Feature'}</h3>
                                <p style="margin: 0; color: #666; line-height: 1.6;">${feature.description || 'Feature update available'}</p>
                            </div>
                        `).join('') : '<p>Feature updates available in your dashboard!</p>'}
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://photomanagementsystem.com/" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Try New Features</a>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                    <p>The Client Management Area - Always improving your photography workflow</p>
                </div>
            </div>
        `
    }),

    reminder: (photographerName, message) => ({
        subject: '📝 Reminder from The Client Management Area',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #f39c12; color: white; padding: 20px; border-radius: 10px;">
                    <h1 style="margin: 0; font-size: 24px;">📝 Reminder</h1>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                    <h2 style="color: #333; margin-top: 0;">Hi ${photographerName},</h2>
                    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f39c12;">
                        <p style="margin: 0; color: #666; line-height: 1.6;">${message}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://photomanagementsystem.com/" style="background: #f39c12; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
                    </div>
                </div>
            </div>
        `
    })
};

// Send email notification
async function sendEmail(to, template, ...args) {
    if (!sendGridConfigured) {
        console.log('📧 Email not sent - SendGrid not configured');
        return { success: false, error: 'SendGrid not configured' };
    }

    try {
        const emailContent = emailTemplates[template](...args);
        
        const msg = {
            to: to,
            from: {
                email: 'lance@thelegacyphotography.com',
                name: 'The Legacy Photography'
            },
            subject: emailContent.subject,
            html: emailContent.html
        };

        await sgMail.send(msg);
        console.log(`📧 Email sent successfully to ${to}: ${emailContent.subject}`);
        return { success: true };
    } catch (error) {
        console.error('📧 Email send error:', error);
        return { success: false, error: error.message };
    }
}

// Send SMS notification
async function sendSMS(to, message) {
    if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
        console.log('📱 SMS not sent - Twilio not configured');
        return { success: false, error: 'Twilio not configured' };
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });

        console.log(`📱 SMS sent successfully to ${to}: ${result.sid}`);
        return { success: true, messageId: result.sid };
    } catch (error) {
        console.error('📱 SMS send error:', error);
        return { success: false, error: error.message };
    }
}

// Subscriber notification functions
async function sendWelcomeEmail(photographerEmail, photographerName, businessName) {
    return await sendEmail(photographerEmail, 'welcome', photographerName, businessName);
}

async function sendBillingNotification(photographerEmail, photographerName, amount, plan, dueDate) {
    return await sendEmail(photographerEmail, 'billing', photographerName, amount, plan, dueDate);
}

async function sendFeatureUpdate(photographerEmail, title, features) {
    return await sendEmail(photographerEmail, 'featureUpdate', title, features);
}

async function sendReminder(photographerEmail, photographerName, message) {
    return await sendEmail(photographerEmail, 'reminder', photographerName, message);
}

async function sendUrgentSMS(phoneNumber, message) {
    return await sendSMS(phoneNumber, `🚨 URGENT: ${message} - The Client Management Area`);
}

// Broadcast functions for all subscribers
async function broadcastFeatureUpdate(subscribers, title, features) {
    const results = [];
    for (const subscriber of subscribers) {
        const result = await sendFeatureUpdate(subscriber.email, title, features);
        results.push({ subscriber: subscriber.email, ...result });
    }
    return results;
}

async function broadcastReminder(subscribers, message) {
    const results = [];
    for (const subscriber of subscribers) {
        const result = await sendReminder(subscriber.email, subscriber.name, message);
        results.push({ subscriber: subscriber.email, ...result });
    }
    return results;
}

module.exports = {
    initializeNotificationServices,
    sendWelcomeEmail,
    sendBillingNotification,
    sendFeatureUpdate,
    sendReminder,
    sendUrgentSMS,
    broadcastFeatureUpdate,
    broadcastReminder
};