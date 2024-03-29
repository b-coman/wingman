// Filename: /src/services/typeformService.js

require('dotenv').config();
const axios = require('axios');

const logger = require('../../logger');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const airtableUtils = require('../lib/airtableUtils');

class CreateFormService {

    constructor() {
        this.typeformAPIKey = process.env.TYPEFORM_API_KEY;
        this.typeformAPIUrl = 'https://api.typeform.com/forms';
    }


    async createForm(formName, formDescription, questionIDs) {
        try {
            const questions = await this.fetchQuestionsFromAirtable(questionIDs);
            let payload = {
                title: formName,
                fields: questions.map(question => ({
                    title: question.title,
                    type: question.type,
                    ref: question.ref,
                    properties: {}
                }))
            };
            logger.info(`Payload: ${JSON.stringify(payload)}`);

            let response = await fetch(this.typeformAPIUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.typeformAPIKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });


            if (!response.ok) {
                let errorDetails = await response.text();
                throw new Error(`Failed to create Typeform survey: ${response.status} ${errorDetails}`);
            }

            let surveyDetails = await response.json();
            const formUrl = surveyDetails._links.display;
            logger.info(`Survey created successfully. URL: ${formUrl}`);

            const formId = this.extractFormIdFromUrl(formUrl);
            logger.info(`Form ID: ${formId}`);

            this.createTypeformWebhook(formId)
                .then(webhookResponse => logger.info('Webhook setup successful', webhookResponse))
                .catch(error => logger.error('Webhook setup failed', error));

            return { formId, formUrl };
            
        } catch (error) {
            logger.error(`Error creating Typeform survey: ${error}`);
            throw error;
        }
    }

    async fetchQuestionsFromAirtable(questionIDs) {
        try {
            let questions = [];
            for (let questionID of questionIDs) {
                let questionDetails = await airtableUtils.getFieldsForRecordById('Questions', questionID);
                questions.push({
                    title: questionDetails['Statement'],
                    type: questionDetails['AnswerType'],
                    ref: questionDetails['QuestionSKU'],

                    // Add more details based on your schema
                });
            }
            return questions;
        } catch (error) {
            logger.error(`Error fetching questions from Airtable: ${error}`);
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
            logger.info('Webhook created or updated:', response.data);
            return response.data;
        } catch (error) {
            logger.error('Failed to create or update webhook:', error.response ? error.response.data : error.message);
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
