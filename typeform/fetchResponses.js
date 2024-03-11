require('dotenv').config();
const axios = require('axios');

const TYPEFORM_API = 'https://api.typeform.com';
const FORM_ID = 'your_form_id'; // Replace with your actual form ID from Typeform

async function fetchTypeformResponses() {
  const url = `${TYPEFORM_API}/forms/${FORM_ID}/responses`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.TYPEFORM_API_KEY}` }
    });
    return response.data.items; // This will return the responses from Typeform
  } catch (error) {
    console.error('Error fetching Typeform responses:', error);
    throw error; // Rethrow the error to handle it in the calling function
  }
}

module.exports = { fetchTypeformResponses };
