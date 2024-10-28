// lib/sheets.js
import { google } from 'googleapis';
import { Buffer } from 'buffer';
import twilio from 'twilio'; // Import Twilio SDK

// Initialize Twilio client
const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Load your credentials from the environment variable
const getClient = async () => {
    try {
        const credential = JSON.parse(
            Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'base64').toString()
        );

        const { client_email, private_key } = credential;

        const jwtClient = new google.auth.JWT(
            client_email,
            null,
            private_key,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        await jwtClient.authorize();
        return jwtClient;
    } catch (error) {
        console.error('Error getting Google Sheets client:', error);
        throw new Error('Failed to get Google Sheets client');
    }
};

// Function to get leads from Google Sheets
export const getLeads = async () => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID
    const range = "'Lead list'!A1:H"; // Adjust the range as necessary

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    return response.data.values || []; // Return the fetched rows or an empty array
};

// Function to update a specific cell
export const updateCell = async (rowIndex, column, value) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the value in the specified column
    const cellRange = `Lead list!${column}${rowIndex}`; // e.g., "M2"
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[value]], // Update with the extracted argument
        },
    });
};

// Function to update lead status, phoneCallProviderId, and callId in Google Sheets
export const updateLeadInfo = async (rowIndex, status, phoneCallProviderId, callId) => {
    await updateCell(rowIndex, 'F', status); // Status in column F
    await updateCell(rowIndex, 'G', phoneCallProviderId); // phoneCallProviderId in column G
    await updateCell(rowIndex, 'H', callId); // callId in column H
};

// Function to update endedReason in column I
export const updateEndedReason = async (rowIndex, endedReason) => {
    await updateCell(rowIndex, 'I', endedReason); // Update the endedReason in column I
};

// Function to update recordingUrl in column L
export const updateRecordingUrl = async (rowIndex, recordingUrl) => {
    await updateCell(rowIndex, 'L', recordingUrl); // Update the recordingUrl in column L
};

// Function to update call duration and price in Google Sheets
export const updateCallDetails = async (rowIndex, duration, price) => {
    await updateCell(rowIndex, 'J', duration); // Update call duration in column J
    await updateCell(rowIndex, 'K', price); // Update call price in column K
};

// Function to fill missing cells for rows with status 'called'
export const fillMissingCells = async () => {
    const leads = await getLeads(); // Fetch leads to find the rows with status 'called'

    for (let i = 1; i < leads.length; i++) { // Start from 1 to skip the header row
        const row = leads[i];

        // Check if the status is 'called' (assuming it's in column F)
        if (row[5] === 'called') {
            for (let j = 0; j < row.length; j++) {
                // If a cell is empty, fill it with actual data
                if (!row[j]) {
                    const valueToFill = 'Your data logic here'; // Define your logic to fetch the actual data
                    await updateCell(i + 1, String.fromCharCode(65 + j), valueToFill); // Fill the cell
                }
            }
        }
    }
};
