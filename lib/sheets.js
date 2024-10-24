// lib/sheets.js
import { google } from 'googleapis';

// Create a JWT client using environment variables
const getClient = async () => {
    const { 
        GOOGLE_TYPE, 
        GOOGLE_PROJECT_ID, 
        GOOGLE_PRIVATE_KEY_ID, 
        GOOGLE_PRIVATE_KEY, 
        GOOGLE_CLIENT_EMAIL, 
        GOOGLE_CLIENT_ID, 
        GOOGLE_AUTH_URI, 
        GOOGLE_TOKEN_URI, 
        GOOGLE_AUTH_PROVIDER_X509_CERT_URL, 
        GOOGLE_CLIENT_X509_CERT_URL, 
        GOOGLE_UNIVERSE_DOMAIN 
    } = process.env;

    const jwtClient = new google.auth.JWT(
        GOOGLE_CLIENT_EMAIL,
        null,
        GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newlines
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    await jwtClient.authorize();
    return jwtClient;
};

// Define getLeads function
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

// Updated updateLeadStatus function to include phoneCallProviderId
export const updateLeadStatus = async (rowIndex, status, phoneCallProviderId) => {
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

    // Update the phoneCallProviderId in another column (e.g., column G)
    const providerIdRange = `'Lead list'!G${rowIndex}`; // Assuming phoneCallProviderId is to be stored in column G
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: providerIdRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[phoneCallProviderId]], // Update with the phoneCallProviderId
        },
    });
};

// New function to get active phone numbers
export const getActivePhoneNumbers = async () => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Your spreadsheet ID
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
