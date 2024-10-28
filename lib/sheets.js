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

// Function to update lead status, phoneCallProviderId, and callId in Google Sheets
export const updateLeadInfo = async (rowIndex, status, phoneCallProviderId, callId) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the lead status in column F
    const statusRange = `Lead list!F${rowIndex}`; // Assuming status is in column F
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: statusRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[status]], // Update with the new status
        },
    });

    // Update the phoneCallProviderId in column G
    const providerIdRange = `Lead list!G${rowIndex}`; // Assuming phoneCallProviderId is stored in column G
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: providerIdRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[phoneCallProviderId]], // Update with the phoneCallProviderId
        },
    });

    // Update the callId in column H
    const callIdRange = `Lead list!H${rowIndex}`; // Assuming callId is stored in column H
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: callIdRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[callId]], // Update with the callId
        },
    });
};

// Function to update endedReason in column I
export const updateEndedReason = async (rowIndex, endedReason) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the endedReason in column I
    const endedReasonRange = `Lead list!I${rowIndex}`; // Assuming endedReason is stored in column I
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: endedReasonRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[endedReason]], // Update with the endedReason
        },
    });
};

// Function to update recordingUrl in column L
export const updateRecordingUrl = async (rowIndex, recordingUrl) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the recordingUrl in column L
    const recordingUrlRange = `Lead list!L${rowIndex}`; // Assuming recordingUrl is stored in column L
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: recordingUrlRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[recordingUrl]], // Update with the recordingUrl
        },
    });
};

// Function to update call duration and price in Google Sheets
export const updateCallDetails = async (rowIndex, duration, price) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the call duration in column J
    const durationRange = `Lead list!J${rowIndex}`; // Assuming call duration is stored in column J
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: durationRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[duration]], // Update with the call duration
        },
    });

    // Update the call price in column K
    const priceRange = `Lead list!K${rowIndex}`; // Assuming call price is stored in column K
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: priceRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[price]], // Update with the call price
        },
    });
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

    // Update the lead information without changing the status to "ended"
    await updateLeadInfo(rowIndex, 'called', phoneCallProviderId, callId); // Update to "called" status
    await updateEndedReason(rowIndex, endedReason); // Update the ended reason in column I

    // Fetch call details from Twilio after updating endedReason
    const { duration, price } = await fetchCallDetails(phoneCallProviderId);
    await updateCallDetails(rowIndex, duration, price); // Update the duration and price in the Google Sheet

    // Update the recording URL in column L
    await updateRecordingUrl(rowIndex, recordingUrl); // Update the recording URL in column L
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
