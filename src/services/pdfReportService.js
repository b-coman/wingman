// file name: /src/services/pdfReportService.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../../logger');
const airtableUtils = require('../lib/airtableUtils');

// Main service function to process agent output, generate a PDF, and update Airtable
async function processAgentOutput(htmlContent, assessmentDetailId, companyName) {
    try {
        const pdfFileName = `${companyName}-${assessmentDetailId}.pdf`;
        const pdfFileURL = await generatePDFWithPDFShift(htmlContent, pdfFileName);

        // Check if an entry exists and update or create accordingly
        var recordPresent = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailId, 'AssessmentDetails:FinalReport');
        if (recordPresent === null) {
            await airtableUtils.createFinalReportEntry(assessmentDetailId, '', htmlContent, pdfFileName, pdfFileURL);
        } else {
            recordPresent = recordPresent[0];
            await airtableUtils.updateFinalReportEntry(recordPresent, assessmentDetailId, '', htmlContent, pdfFileName, pdfFileURL);

        }

        logger.info(`PDF generated and saved at: ${pdfFileURL}`);
        // Optionally return the path or any other data you might need
        return [pdfFileName, pdfFileURL];

    } catch (error) {
        logger.error(`Error in processAgentOutput: ${error}`);
        throw error; // or handle differently
    }
}


// Generate and save a PDF from HTML content
async function generatePDFWithPDFShift(htmlContent, pdfFileName) {
    const apiURL = 'https://api.pdfshift.io/v3/convert/pdf';
    const apiKey = process.env.PDFSHIFT_API_KEY; // Replace with your actual API key
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');

    try {
        const response = await axios.post(apiURL, {
            source: htmlContent,
            sandbox: true, // !!!! set to false to take out the watermark
            filename: pdfFileName,
            format: 'A4',
            use_print: true,
            margin: '50px',
            zoom: 0.8,

        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            responseType: 'json' // Ensure that the response type is JSON to get the URL
        });

        // Write the PDF to a file
        //fs.writeFileSync(outputFilePath, response.data);
        // console.log(`PDF successfully created at ${outputFilePath}`);

        return response.data.url;

    } catch (error) {
        console.error(`Error converting HTML to PDF: ${error}`);
    }
}

module.exports = { processAgentOutput };
