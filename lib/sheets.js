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

    const rows = response.data.values;
    return rows || []; // Return the fetched rows or an empty array
};

// Function to batch update cells in Google Sheets
export const batchUpdateCells = async (updates) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID
    const resource = {
        data: updates.map(update => ({
            range: `Lead list!${update.column}${update.rowIndex}`, // Construct the range
            values: [[update.value]] // Wrap the value in an array
        })),
        valueInputOption: 'RAW',
    };

    try {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource,
        });
        console.log('Batch update successful');
    } catch (error) {
        console.error('Error during batch update:', error);
        throw new Error('Failed to perform batch update');
    }
};

// Function to update lead information and handle batch updates
export const updateLeadInfo = async (rowIndex, status, phoneCallProviderId, callId) => {
    return [
        { rowIndex, value: status, column: 'F' }, // Update status in column F
        { rowIndex, value: phoneCallProviderId, column: 'G' }, // Update phoneCallProviderId in column G
        { rowIndex, value: callId, column: 'H' } // Update callId in column H
    ];
};

// Function to update endedReason in column I
export const updateEndedReason = async (rowIndex, endedReason) => {
    return [{ rowIndex, value: endedReason, column: 'I' }]; // Update endedReason in column I
};

// Function to update recordingUrl in column L
export const updateRecordingUrl = async (rowIndex, recordingUrl) => {
    return [{ rowIndex, value: recordingUrl, column: 'L' }]; // Update recordingUrl in column L
};

// Function to update call duration and price in Google Sheets
export const updateCallDetails = async (rowIndex, duration, price) => {
    return [
        { rowIndex, value: duration, column: 'J' }, // Update duration in column J
        { rowIndex, value: price, column: 'K' } // Update price in column K
    ];
};

// Function to update cell M
export const updateCellM = async (rowIndex, value) => {
    return [{ rowIndex, value, column: 'M' }]; // Update cell M
};

// Function to fetch call details from Twilio
const fetchCallDetails = async (phoneCallProviderId) => {
    try {
        const call = await twilioClient.calls(phoneCallProviderId).fetch();
        return {
            duration: call.duration, // Call duration in seconds
            price: call.price, // Call price in your currency
        };
    } catch (error) {
        console.error('Error fetching call details from Twilio:', error);
        throw new Error('Failed to fetch call details from Twilio');
    }
};

// Function to process the end call report and update Google Sheets
export const processEndCallReport = async (report) => {
    const callId = report.message.call.id; // Get the call ID from the report
    const endedReason = report.message.endedReason; // Get the ended reason
    const recordingUrl = report.message.artifact.recordingUrl; // Get the recording URL from the report

    const leads = await getLeads(); // Fetch leads to find the correct index

    // Find the index of the lead based on the phoneCallProviderId in column G
    const phoneCallProviderId = report.message.call.phoneCallProviderId; // Extract the phoneCallProviderId from the report
    const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId) + 1; // Adjust based on your identifier

    // If rowIndex is -1, that means no match was found
    if (rowIndex === 0) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return; // Skip to the next result
    }

    const updates = [
        ...await updateLeadInfo(rowIndex, 'called', phoneCallProviderId, callId), // Update to "called" status
        ...await updateEndedReason(rowIndex, endedReason), // Update the ended reason in column I
        ...await updateRecordingUrl(rowIndex, recordingUrl), // Update the recording URL in column L
    ];

    // Fetch call details from Twilio after updating endedReason
    const { duration, price } = await fetchCallDetails(phoneCallProviderId);
    updates.push(...await updateCallDetails(rowIndex, duration, price)); // Add duration and price updates

    // Perform a batch update
    await batchUpdateCells(updates);
};

// Function to get active phone numbers
export const getActivePhoneNumbers = async () => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI';
    const range = "'Phone Numbers'!A:B"; // Adjust the range as needed

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (rows && rows.length) {
            // Filter active phone numbers
            const activeNumbers = rows
                .filter(row => row[1] && row[1].toLowerCase() === 'active') // Check if the status is 'active'
                .map(row => row[0]); // Get only the phone number IDs

            return activeNumbers; // Return an array of active phone number IDs
        } else {
            throw new Error('No data found in Phone Numbers sheet.');
        }
    } catch (error) {
        console.error('Error accessing Google Sheets API for phone numbers:', error);
        throw new Error('Failed to fetch active phone numbers');
    }
};
