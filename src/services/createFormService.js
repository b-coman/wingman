// Filename: /src/services/createFormService.js

require('dotenv').config();
const axios = require('axios');
const logger = require('../../logger');

class CreateFormService {
    constructor() {
        this.typeformAPIKey = process.env.TYPEFORM_API_KEY;
        this.typeformAPIUrl = 'https://api.typeform.com/forms';
    }

    async createForm(formName, formDescription, questions) {
        try {
            let payload = {
                title: formName,
                fields: questions.map(question => ({
                    title: question.title,
                    type: question.type,
                    ref: question.ref,
                    properties: question.properties || {}
                }))
            };
            logger.info(`Payload: ${JSON.stringify(payload)}`);

            let response = await axios.post(this.typeformAPIUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${this.typeformAPIKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 201) {
                let surveyDetails = response.data;
                const formUrl = surveyDetails._links.display;
                logger.info(`Survey created successfully. URL: ${formUrl}`);

                const formId = this.extractFormIdFromUrl(formUrl);
                logger.info(`Form ID: ${formId}`);

                try {
                    const webhookResponse = await this.createTypeformWebhook(formId);
                    logger.info(`Webhook setup successful: ${webhookResponse}`);
                } catch (error) {
                    logger.error(`Webhook setup failed, ${error}`);
                }

                return { formId, formUrl };
            } else {
                let errorDetails = response.data;
                throw new Error(`Failed to create Typeform survey: ${response.status} ${JSON.stringify(errorDetails)}`);
            }
        } catch (error) {
            logger.error(`Error creating Typeform survey: ${error}`);
            throw error;
        }
    }

    async createTypeformWebhook(formId) {
        const webhookUrl = `${process.env.BASE_URL}${process.env.TYPEFORM_WEBHOOK_ROUTE}`;
        const webhookTag = `webhook_${Date.now()}`;

        try {
            const response = await axios.put(
                `${this.typeformAPIUrl}/${formId}/webhooks/${webhookTag}`,
                {
                    enabled: true,
                    url: webhookUrl,
                    verify_ssl: true
                },
                {
                    headers: { Authorization: `Bearer ${this.typeformAPIKey}` }
                }
            );
            logger.info(`Webhook created or updated: ${response.data}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to create or update webhook: ${error.response ? error.response.data : error.message}`);
            throw error;
        }
    }

    extractFormIdFromUrl(url) {
        const regex = /\/to\/([a-zA-Z0-9]+)$/i;
        const match = regex.exec(url);
        if (match && match.length > 1) {
            return match[1];
        } else {
            return null;
        }
    }
}

module.exports = CreateFormService;
