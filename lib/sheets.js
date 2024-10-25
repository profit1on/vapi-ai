// lib/sheets.js
import { google } from 'googleapis';
import { Buffer } from 'buffer';

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
    const range = "'Lead list'!A1:F"; // Adjust the range as necessary

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values;
    return rows; // Return the fetched rows
};

// Function to update lead status, phoneCallProviderId, and callId in Google Sheets
export const updateLeadInfo = async (rowIndex, status, phoneCallProviderId, callId) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the lead status in column F
    const statusRange = `'Lead list'!F${rowIndex}`; // Assuming status is in column F
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: statusRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[status]], // Update with the new status
        },
    });

    // Update the phoneCallProviderId in column G
    const providerIdRange = `'Lead list'!G${rowIndex}`; // Assuming phoneCallProviderId is stored in column G
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: providerIdRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[phoneCallProviderId]], // Update with the phoneCallProviderId
        },
    });

    // Update the callId in column H
    const callIdRange = `'Lead list'!H${rowIndex}`; // Assuming callId is stored in column H
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: callIdRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[callId]], // Update with the callId
        },
    });
};

// Function to process the end call report and update Google Sheets
export const processEndCallReport = async (report) => {
    const leads = await getLeads(); // Fetch leads to find the correct index

    for (const result of report.results) {
        const callId = result.id; // Get the call ID
        const phoneCallProviderId = result.phoneCallProviderId; // Get the phone call provider ID

        // Find the index of the lead based on some unique identifier (phoneCallProviderId in column G)
        const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId) + 1; // Adjust based on your identifier

        // If rowIndex is -1, that means no match was found
        if (rowIndex === 0) {
            console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
            continue; // Skip to the next result
        }

        // Update the lead status, phoneCallProviderId, and callId
        await updateLeadInfo(rowIndex, 'ended', phoneCallProviderId, callId);
    }
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
