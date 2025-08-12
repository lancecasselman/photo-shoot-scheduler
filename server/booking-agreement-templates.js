const bookingAgreementTemplates = {
    wedding: {
        name: 'Wedding Photography Agreement',
        category: 'Wedding',
        content: [
            '<h2>Wedding Photography Agreement</h2>',
            '<p><strong>This Agreement</strong> is made between {{photographerName}} ("Photographer") and {{clientName}} ("Client") for photography services.</p>',
            '<h3>Event Details</h3>',
            '<ul>',
            '    <li><strong>Date:</strong> {{sessionDate}}</li>',
            '    <li><strong>Ceremony Location:</strong> {{location}}</li>',
            '    <li><strong>Reception Location:</strong> {{receptionLocation}}</li>',
            '    <li><strong>Coverage Time:</strong> {{startTime}} to {{endTime}}</li>',
            '</ul>',
            '<h3>Investment</h3>',
            '<ul>',
            '    <li><strong>Total Package Price:</strong> ${{price}}</li>',
            '    <li><strong>Deposit Required:</strong> ${{depositAmount}}</li>',
            '    <li><strong>Balance Due:</strong> ${{balanceAmount}}</li>',
            '    <li><strong>Payment Due Date:</strong> {{paymentDueDate}}</li>',
            '</ul>',
            '<h3>Services Included</h3>',
            '<ul>',
            '    <li>Professional photography coverage for specified hours</li>',
            '    <li>Edited high-resolution digital images</li>',
            '    <li>Online gallery for viewing and downloading</li>',
            '    <li>Print release for personal use</li>',
            '</ul>',
            '<h3>Terms and Conditions</h3>',
            '<ol>',
            '    <li><strong>Deposit:</strong> A non-refundable deposit of ${{depositAmount}} is required to secure the date.</li>',
            '    <li><strong>Payment:</strong> The remaining balance is due 14 days before the wedding date.</li>',
            '    <li><strong>Cancellation:</strong> In the event of cancellation by the Client, the deposit is non-refundable.</li>',
            '    <li><strong>Image Delivery:</strong> Images will be delivered within 6-8 weeks after the wedding date.</li>',
            '    <li><strong>Copyright:</strong> The Photographer retains copyright of all images. Client receives personal use license.</li>',
            '    <li><strong>Model Release:</strong> Client grants permission for images to be used in Photographer\'s portfolio and marketing.</li>',
            '</ol>',
            '<h3>Liability</h3>',
            '<p>In the unlikely event of severe medical, natural, or other emergency, the Photographer will attempt to secure a replacement photographer. If unable to do so, liability is limited to the return of all payments received.</p>',
            '<h3>Agreement</h3>',
            '<p>By signing below, both parties agree to the terms outlined in this agreement.</p>',
            '<div class="signature-section">',
            '    <p><strong>Client Signature:</strong> ___________________________ Date: _______________</p>',
            '    <p>{{clientName}}</p>',
            '    <p>{{clientEmail}} | {{clientPhone}}</p>',
            '</div>'
        ].join('\n')
    },
    portrait: {
        name: 'Portrait Session Agreement',
        category: 'Portrait',
        content: [
            '<h2>Portrait Photography Agreement</h2>',
            '<p><strong>This Agreement</strong> is made between {{photographerName}} ("Photographer") and {{clientName}} ("Client") for portrait photography services.</p>',
            '<h3>Session Details</h3>',
            '<ul>',
            '    <li><strong>Session Type:</strong> {{sessionType}}</li>',
            '    <li><strong>Date:</strong> {{sessionDate}}</li>',
            '    <li><strong>Time:</strong> {{sessionTime}}</li>',
            '    <li><strong>Location:</strong> {{location}}</li>',
            '    <li><strong>Duration:</strong> {{duration}} minutes</li>',
            '</ul>',
            '<h3>Investment</h3>',
            '<ul>',
            '    <li><strong>Session Fee:</strong> ${{price}}</li>',
            '    <li><strong>Deposit Required:</strong> ${{depositAmount}}</li>',
            '    <li><strong>Balance Due:</strong> ${{balanceAmount}}</li>',
            '</ul>',
            '<h3>What\'s Included</h3>',
            '<ul>',
            '    <li>Professional photography session</li>',
            '    <li>Minimum of {{imageCount}} edited digital images</li>',
            '    <li>Online gallery for viewing and downloading</li>',
            '    <li>Print release for personal use</li>',
            '</ul>',
            '<h3>Terms and Conditions</h3>',
            '<ol>',
            '    <li><strong>Payment:</strong> Full payment is due at the time of the session.</li>',
            '    <li><strong>Rescheduling:</strong> Sessions may be rescheduled with 48 hours notice.</li>',
            '    <li><strong>Weather:</strong> Outdoor sessions may be rescheduled due to inclement weather.</li>',
            '    <li><strong>Image Delivery:</strong> Images will be delivered within 2-3 weeks via online gallery.</li>',
            '    <li><strong>Copyright:</strong> Photographer retains copyright. Client receives personal use license.</li>',
            '</ol>',
            '<div class="signature-section">',
            '    <p><strong>Client Signature:</strong> ___________________________ Date: _______________</p>',
            '    <p>{{clientName}}</p>',
            '    <p>{{clientEmail}} | {{clientPhone}}</p>',
            '</div>'
        ].join('\n')
    },
    commercial: {
        name: 'Commercial Photography Agreement',
        category: 'Commercial',
        content: [
            '<h2>Commercial Photography Agreement</h2>',
            '<p><strong>This Agreement</strong> is made between {{photographerName}} ("Photographer") and {{clientName}} ("Client") for commercial photography services.</p>',
            '<h3>Project Details</h3>',
            '<ul>',
            '    <li><strong>Project Type:</strong> {{sessionType}}</li>',
            '    <li><strong>Shoot Date:</strong> {{sessionDate}}</li>',
            '    <li><strong>Location:</strong> {{location}}</li>',
            '    <li><strong>Duration:</strong> {{duration}} hours</li>',
            '</ul>',
            '<h3>Investment</h3>',
            '<ul>',
            '    <li><strong>Photography Fee:</strong> ${{price}}</li>',
            '    <li><strong>Deposit (50%):</strong> ${{depositAmount}}</li>',
            '    <li><strong>Balance Due:</strong> ${{balanceAmount}}</li>',
            '</ul>',
            '<h3>Deliverables</h3>',
            '<ul>',
            '    <li>High-resolution edited images</li>',
            '    <li>Commercial use license</li>',
            '    <li>Digital delivery via download link</li>',
            '</ul>',
            '<h3>Usage Rights</h3>',
            '<p>Client receives commercial usage rights for:</p>',
            '<ul>',
            '    <li>Website and digital marketing</li>',
            '    <li>Print marketing materials</li>',
            '    <li>Social media</li>',
            '    <li>Internal business use</li>',
            '</ul>',
            '<h3>Terms and Conditions</h3>',
            '<ol>',
            '    <li><strong>Payment:</strong> 50% deposit due upon signing, balance due upon delivery.</li>',
            '    <li><strong>Delivery:</strong> Images delivered within 10 business days.</li>',
            '    <li><strong>Revisions:</strong> Includes one round of reasonable editing revisions.</li>',
            '    <li><strong>Copyright:</strong> Photographer retains copyright and may use images for portfolio.</li>',
            '    <li><strong>Cancellation:</strong> 72 hours notice required for rescheduling.</li>',
            '</ol>',
            '<div class="signature-section">',
            '    <p><strong>Client Signature:</strong> ___________________________ Date: _______________</p>',
            '    <p>{{clientName}}</p>',
            '    <p>{{clientEmail}} | {{clientPhone}}</p>',
            '</div>'
        ].join('\n')
    },
    event: {
        name: 'Event Photography Agreement',
        category: 'Event',
        content: [
            '<h2>Event Photography Agreement</h2>',
            '<p><strong>This Agreement</strong> is made between {{photographerName}} ("Photographer") and {{clientName}} ("Client") for event photography services.</p>',
            '<h3>Event Details</h3>',
            '<ul>',
            '    <li><strong>Event Name:</strong> {{eventName}}</li>',
            '    <li><strong>Date:</strong> {{sessionDate}}</li>',
            '    <li><strong>Time:</strong> {{startTime}} to {{endTime}}</li>',
            '    <li><strong>Location:</strong> {{location}}</li>',
            '    <li><strong>Expected Attendance:</strong> {{attendeeCount}}</li>',
            '</ul>',
            '<h3>Investment</h3>',
            '<ul>',
            '    <li><strong>Total Fee:</strong> ${{price}}</li>',
            '    <li><strong>Deposit:</strong> ${{depositAmount}}</li>',
            '    <li><strong>Balance:</strong> ${{balanceAmount}}</li>',
            '</ul>',
            '<h3>Services Provided</h3>',
            '<ul>',
            '    <li>Professional event photography coverage</li>',
            '    <li>Candid and posed photographs</li>',
            '    <li>Edited digital images</li>',
            '    <li>Online gallery for 90 days</li>',
            '</ul>',
            '<h3>Terms</h3>',
            '<ol>',
            '    <li><strong>Payment:</strong> Deposit due upon booking, balance due day of event.</li>',
            '    <li><strong>Delivery:</strong> Images delivered within 2 weeks.</li>',
            '    <li><strong>Coverage:</strong> Photographer will capture key moments and general event atmosphere.</li>',
            '    <li><strong>Usage:</strong> Images may be used for event promotion and attendee sharing.</li>',
            '</ol>',
            '<div class="signature-section">',
            '    <p><strong>Client Signature:</strong> ___________________________ Date: _______________</p>',
            '    <p>{{clientName}}</p>',
            '    <p>{{clientEmail}} | {{clientPhone}}</p>',
            '</div>'
        ].join('\n')
    },
    mini: {
        name: 'Mini Session Agreement',
        category: 'Mini Session',
        content: [
            '<h2>Mini Session Photography Agreement</h2>',
            '<p><strong>This Agreement</strong> is made between {{photographerName}} ("Photographer") and {{clientName}} ("Client").</p>',
            '<h3>Session Details</h3>',
            '<ul>',
            '    <li><strong>Date:</strong> {{sessionDate}}</li>',
            '    <li><strong>Time Slot:</strong> {{sessionTime}}</li>',
            '    <li><strong>Location:</strong> {{location}}</li>',
            '    <li><strong>Duration:</strong> {{duration}} minutes</li>',
            '</ul>',
            '<h3>Investment</h3>',
            '<ul>',
            '    <li><strong>Session Fee:</strong> ${{price}}</li>',
            '    <li><strong>Payment:</strong> Due in full at booking</li>',
            '</ul>',
            '<h3>Includes</h3>',
            '<ul>',
            '    <li>{{duration}} minute photo session</li>',
            '    <li>{{imageCount}} edited digital images</li>',
            '    <li>Online gallery</li>',
            '    <li>Print release</li>',
            '</ul>',
            '<h3>Important Notes</h3>',
            '<ul>',
            '    <li>Mini sessions are non-refundable</li>',
            '    <li>Rescheduling subject to availability</li>',
            '    <li>Images delivered within 2 weeks</li>',
            '    <li>Additional images may be purchased</li>',
            '</ul>',
            '<div class="signature-section">',
            '    <p><strong>Client Signature:</strong> ___________________________ Date: _______________</p>',
            '    <p>{{clientName}}</p>',
            '    <p>{{clientEmail}} | {{clientPhone}}</p>',
            '</div>'
        ].join('\n')
    },
    newborn: {
        name: 'Newborn/Maternity Agreement',
        category: 'Newborn/Maternity',
        content: [
            '<h2>Newborn/Maternity Photography Agreement</h2>',
            '<p><strong>This Agreement</strong> is made between {{photographerName}} ("Photographer") and {{clientName}} ("Client").</p>',
            '<h3>Session Details</h3>',
            '<ul>',
            '    <li><strong>Session Type:</strong> {{sessionType}}</li>',
            '    <li><strong>Tentative Date:</strong> {{sessionDate}}</li>',
            '    <li><strong>Location:</strong> {{location}}</li>',
            '    <li><strong>Duration:</strong> Up to {{duration}} hours</li>',
            '</ul>',
            '<h3>Investment</h3>',
            '<ul>',
            '    <li><strong>Session Fee:</strong> ${{price}}</li>',
            '    <li><strong>Deposit:</strong> ${{depositAmount}}</li>',
            '    <li><strong>Balance:</strong> ${{balanceAmount}}</li>',
            '</ul>',
            '<h3>What\'s Included</h3>',
            '<ul>',
            '    <li>Professional photography session</li>',
            '    <li>Props and accessories provided</li>',
            '    <li>{{imageCount}} edited digital images</li>',
            '    <li>Online gallery</li>',
            '    <li>Print release</li>',
            '</ul>',
            '<h3>Special Considerations</h3>',
            '<ul>',
            '    <li><strong>Newborn Sessions:</strong> Best photographed within 5-14 days after birth</li>',
            '    <li><strong>Flexibility:</strong> Session date will be confirmed after baby\'s arrival</li>',
            '    <li><strong>Safety:</strong> Baby\'s safety and comfort are the top priority</li>',
            '    <li><strong>Duration:</strong> Sessions paced according to baby\'s needs (feeding, changing, soothing)</li>',
            '</ul>',
            '<h3>Terms</h3>',
            '<ol>',
            '    <li>Deposit reserves your due date on calendar</li>',
            '    <li>Please contact within 24-48 hours of birth to schedule</li>',
            '    <li>Images delivered within 3 weeks</li>',
            '    <li>Siblings and parents included at no extra charge</li>',
            '</ol>',
            '<div class="signature-section">',
            '    <p><strong>Client Signature:</strong> ___________________________ Date: _______________</p>',
            '    <p>{{clientName}}</p>',
            '    <p>{{clientEmail}} | {{clientPhone}}</p>',
            '</div>'
        ].join('\n')
    }
};

// Function to initialize templates in database
async function initializeTemplates(pool) {
    const client = await pool.connect();
    try {
        // First, check if templates already exist
        for (const [key, template] of Object.entries(bookingAgreementTemplates)) {
            const checkResult = await client.query(
                'SELECT id FROM booking_agreement_templates WHERE name = $1',
                [template.name]
            );
            
            if (checkResult.rows.length === 0) {
                // Insert new template
                await client.query(
                    'INSERT INTO booking_agreement_templates (name, category, content, is_default) ' +
                    'VALUES ($1, $2, $3, $4)',
                    [template.name, template.category, template.content, key === 'portrait']
                );
            } else {
                // Update existing template
                await client.query(
                    'UPDATE booking_agreement_templates ' +
                    'SET content = $2, category = $3, updated_at = NOW() ' +
                    'WHERE name = $1',
                    [template.name, template.content, template.category]
                );
            }
        }
        console.log('✅ Booking agreement templates initialized');
    } catch (error) {
        console.error('Error initializing templates:', error);
    } finally {
        client.release();
    }
}

module.exports = { bookingAgreementTemplates, initializeTemplates };