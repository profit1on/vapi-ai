// lib/vapi.js
import axios from 'axios';

const apiKey = process.env.VAPI_API_KEY; // Fetch the API key from environment variables
const assistantId = process.env.VAPI_ASSISTANT_ID; // Fetch the assistant ID from environment variables

export const makeCall = async (phoneNumberId, customerData) => {
    const requestBody = {
        phoneNumberId,
        customer: {
            number: customerData.number,
            name: customerData.name,
            extension: customerData.extension || "",
        },
        assistantId, // Use the assistantId from the environment variable
    };

    console.log('Request Body:', JSON.stringify(requestBody, null, 2)); // Log the request payload

    try {
        const response = await axios.post('https://api.vapi.ai/call', requestBody, {
            headers: {
                Authorization: `Bearer ${apiKey}`, // Set the Authorization header
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error making call:', error.response ? error.response.data : error.message);
        throw error; // Propagate the error to be handled in the calling function
    }
};
