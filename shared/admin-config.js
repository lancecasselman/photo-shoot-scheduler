/**
 * Admin Configuration
 * Centralized admin email list to prevent mismatches across the codebase
 */

const ADMIN_EMAILS = [
    'lancecasselman@icloud.com',
    'lancecasselman2011@gmail.com', 
    'lance@thelegacyphotography.com',
    'm_casselman@icloud.com'
];

/**
 * Check if an email address is an admin
 * @param {string} email - Email address to check
 * @returns {boolean} - True if the email is an admin email
 */
function isAdminEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Get the complete list of admin emails
 * @returns {string[]} - Array of admin email addresses
 */
function getAdminEmails() {
    return [...ADMIN_EMAILS]; // Return a copy to prevent mutations
}

module.exports = {
    ADMIN_EMAILS,
    isAdminEmail,
    getAdminEmails
};