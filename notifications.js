
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// SendGrid configuration using nodemailer
const emailTransporter = nodemailer.createTransporter({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});

// Twilio configuration
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@photographyschedule.com';
const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER;

// Email templates
const getSessionReminderEmailTemplate = (session) => {
  const sessionDate = new Date(session.date_time);
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = sessionDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    subject: `Photography Session Reminder - Tomorrow at ${formattedTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">📸 Session Reminder</h2>
        <p>Hi ${session.client_name},</p>
        
        <p>This is a friendly reminder that your <strong>${session.session_type}</strong> photography session is scheduled for tomorrow!</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #555;">Session Details:</h3>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Location:</strong> ${session.location}</p>
          <p><strong>Duration:</strong> ${session.duration} minutes</p>
          ${session.notes ? `<p><strong>Notes:</strong> ${session.notes}</p>` : ''}
        </div>
        
        <p>Looking forward to capturing amazing moments with you!</p>
        
        <p>If you need to reschedule or have any questions, please don't hesitate to contact me.</p>
        
        <p>Best regards,<br>Your Photographer</p>
      </div>
    `
  };
};

const getGalleryReadyEmailTemplate = (session) => {
  return {
    subject: `Your Photography Gallery is Ready! 📸`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🎉 Your Gallery is Ready!</h2>
        <p>Hi ${session.client_name},</p>
        
        <p>Great news! Your photos from the <strong>${session.session_type}</strong> session are now ready for viewing and download.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #555;">Session Information:</h3>
          <p><strong>Session Type:</strong> ${session.session_type}</p>
          <p><strong>Date:</strong> ${new Date(session.date_time).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${session.location}</p>
        </div>
        
        <p>Your photos have been carefully edited and are ready for you to enjoy and share with your loved ones.</p>
        
        <p>Please contact me to access your gallery and discuss delivery options.</p>
        
        <p>Thank you for choosing me as your photographer!</p>
        
        <p>Best regards,<br>Your Photographer</p>
      </div>
    `
  };
};

// SMS templates
const getSessionReminderSMS = (session) => {
  const sessionDate = new Date(session.date_time);
  const formattedTime = sessionDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `📸 Session Reminder: Hi ${session.client_name}, your ${session.session_type} photography session is tomorrow at ${formattedTime} at ${session.location}. Looking forward to it!`;
};

const getGalleryReadySMS = (session) => {
  return `🎉 Hi ${session.client_name}, your photos from the ${session.session_type} session are ready! Please contact me to access your gallery. Thank you!`;
};

// Send session reminder
async function sendSessionReminder(session) {
  const results = {
    email: { sent: false, error: null },
    sms: { sent: false, error: null }
  };

  // Send email reminder
  if (process.env.SENDGRID_API_KEY) {
    try {
      const emailTemplate = getSessionReminderEmailTemplate(session);
      await emailTransporter.sendMail({
        from: FROM_EMAIL,
        to: session.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
      });
      results.email.sent = true;
      console.log(`Session reminder email sent to ${session.email}`);
    } catch (error) {
      console.error('Error sending reminder email:', error);
      results.email.error = error.message;
    }
  } else {
    console.warn('SendGrid API key not configured, skipping email reminder');
    results.email.error = 'SendGrid not configured';
  }

  // Send SMS reminder
  if (twilioClient && FROM_PHONE) {
    try {
      const smsMessage = getSessionReminderSMS(session);
      await twilioClient.messages.create({
        from: FROM_PHONE,
        to: session.phone_number,
        body: smsMessage
      });
      results.sms.sent = true;
      console.log(`Session reminder SMS sent to ${session.phone_number}`);
    } catch (error) {
      console.error('Error sending reminder SMS:', error);
      results.sms.error = error.message;
    }
  } else {
    console.warn('Twilio not configured, skipping SMS reminder');
    results.sms.error = 'Twilio not configured';
  }

  return results;
}

// Send gallery ready notification
async function sendGalleryReadyNotification(session) {
  const results = {
    email: { sent: false, error: null },
    sms: { sent: false, error: null }
  };

  // Send email notification
  if (process.env.SENDGRID_API_KEY) {
    try {
      const emailTemplate = getGalleryReadyEmailTemplate(session);
      await emailTransporter.sendMail({
        from: FROM_EMAIL,
        to: session.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
      });
      results.email.sent = true;
      console.log(`Gallery ready email sent to ${session.email}`);
    } catch (error) {
      console.error('Error sending gallery ready email:', error);
      results.email.error = error.message;
    }
  } else {
    console.warn('SendGrid API key not configured, skipping gallery ready email');
    results.email.error = 'SendGrid not configured';
  }

  // Send SMS notification
  if (twilioClient && FROM_PHONE) {
    try {
      const smsMessage = getGalleryReadySMS(session);
      await twilioClient.messages.create({
        from: FROM_PHONE,
        to: session.phone_number,
        body: smsMessage
      });
      results.sms.sent = true;
      console.log(`Gallery ready SMS sent to ${session.phone_number}`);
    } catch (error) {
      console.error('Error sending gallery ready SMS:', error);
      results.sms.error = error.message;
    }
  } else {
    console.warn('Twilio not configured, skipping gallery ready SMS');
    results.sms.error = 'Twilio not configured';
  }

  return results;
}

module.exports = {
  sendSessionReminder,
  sendGalleryReadyNotification
};
