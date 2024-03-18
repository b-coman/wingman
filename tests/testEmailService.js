const { sendEmailNotification } = require('../src/services/emailService');

async function testSendEmail() {
    try {
        await sendEmailNotification('bogdan.coman@moduscreate.com', 'Test Company', 'Test Contact');
        console.log('Test email sent successfully.');
    } catch (error) {
        console.error('Failed to send test email:', error);
    }
}

testSendEmail();
