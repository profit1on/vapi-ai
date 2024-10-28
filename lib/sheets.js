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

// Function to batch update multiple cells in Google Sheets
export const batchUpdateCells = async (updates) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    const resource = {
        valueInputOption: 'RAW',
        data: updates.map(update => ({
            range: update.range,
            values: [update.values],
        })),
    };

    try {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource,
        });
    } catch (error) {
        console.error('Error in batch updating Google Sheets:', error);
        throw new Error('Failed to batch update Google Sheets');
    }
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

// Function to process the call result when received
export const handleCallResult = async (callResult) => {
    const { phoneCallProviderId, callId } = callResult; // Extract values from the call result

    if (!phoneCallProviderId || !callId) {
        console.error('Missing phoneCallProviderId or callId in the result.');
        return; // Handle the error as needed
    }

    const leads = await getLeads(); // Fetch leads to find the correct index

    // Find the index of the lead based on the phoneCallProviderId in column G
    const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId); // Adjust based on your identifier

    // If rowIndex is -1, that means no match was found
    if (rowIndex === -1) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return; // Skip to the next result
    }

    // Update the lead info with phoneCallProviderId and callId immediately
    await updateLeadInfo(rowIndex + 1, 'called', phoneCallProviderId, callId); // Update to "called" status
};

// Function to process the end call report and update Google Sheets
export const processEndCallReport = async (report) => {
    if (!report || !report.message || !report.message.call) {
        console.error('Invalid report structure:', report);
        return; // Skip processing if the report structure is invalid
    }

    const endedReason = report.message.endedReason; // Get the ended reason
    const recordingUrl = report.message.artifact.recordingUrl; // Get the recording URL
    const phoneCallProviderId = report.message.call.phoneCallProviderId; // Extract the phoneCallProviderId from the report

    const leads = await getLeads(); // Fetch leads to find the correct index

    // Find the index of the lead based on the phoneCallProviderId in column G
    const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId); // Adjust based on your identifier

    // If rowIndex is -1, that means no match was found
    if (rowIndex === -1) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return; // Skip to the next result
    }

    // Fetch call details from Twilio after verifying rowIndex
    let duration, price;
    try {
        const callDetails = await fetchCallDetails(phoneCallProviderId);
        duration = callDetails.duration; // Call duration in seconds
        price = callDetails.price; // Call price in your currency
    } catch (error) {
        console.error(`Failed to fetch call details for provider ID: ${phoneCallProviderId}`, error);
        return; // Skip to the next result if fetching call details fails
    }

    // Prepare updates for batch update
    const updates = [
        {
            range: `Lead list!I${rowIndex + 1}`, // Ended reason in column I
            values: [endedReason],
        },
        {
            range: `Lead list!J${rowIndex + 1}`, // Duration in column J
            values: [duration], // Update duration
        },
        {
            range: `Lead list!K${rowIndex + 1}`, // Price in column K
            values: [price], // Update price
        },
        {
            range: `Lead list!L${rowIndex + 1}`, // Recording URL in column L
            values: [recordingUrl],
        },
    ];

    // Batch update the Google Sheets with the prepared updates
    await batchUpdateCells(updates);
};

// Function to update lead info
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

// Function to update cell M
export const updateCellM = async (rowIndex, value) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the value in column M
    const cellMRange = `Lead list!M${rowIndex}`; // Assuming you want to update column M
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellMRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[value]], // Update with the extracted argument
        },
    });
};

// Function to update cell N
export const updateCellN = async (rowIndex, value) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the value in column N
    const cellNRange = `Lead list!N${rowIndex}`; // Update cell in column N
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellNRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[value]], // Update with the extracted argument
        },
    });
};
// Function to update cell O
export const updateCellO = async (rowIndex, value) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

    // Update the value in column O
    const cellORange = `Lead list!O${rowIndex}`; // Update cell in column N
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellORange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[value]], // Update with the extracted argument
        },
    });
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
