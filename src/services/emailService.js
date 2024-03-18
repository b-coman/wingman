// Filename: /src/services/emailService.js

require('dotenv').config();
const nodemailer = require('nodemailer');
const logger = require('../../logger'); 

/**
 * Sends an email using nodemailer with customizable subject and body.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} textBody - The plain text body of the email.
 * @param {string} htmlBody - The HTML body of the email.
 */
exports.sendEmail = async (toEmail, subject, body) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: `"Wingman App" <${process.env.EMAIL_USER}>`, // Use the EMAIL_USER environment variable
        to: toEmail, // Recipient's email address
        subject: subject, // Subject line
        html: body, // HTML body
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
        logger.error(`Error sending email to ${toEmail}:`, error);
    }
};
