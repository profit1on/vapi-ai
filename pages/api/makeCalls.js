import { google } from 'googleapis';
import { Buffer } from 'buffer';
import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = "'Lead list'!A1:H";

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values;
    return rows || [];
};

// Enhanced batch update function with retry logic
export const batchUpdateCells = async (updates, retries = 3) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;

    const resource = {
        valueInputOption: 'RAW',
        data: updates.map((update) => ({
            range: update.range,
            values: [update.values],
        })),
    };

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource,
            });
            console.log(`Batch update successful: Updated ${updates.length} cells.`);
            return; // Exit after successful update
        } catch (error) {
            if (
                error.response &&
                error.response.status === 429 &&
                error.response.data.error.reason === 'rateLimitExceeded'
            ) {
                console.warn(`Quota exceeded. Retrying in 30 seconds (Attempt ${attempt + 1}/${retries})...`);
                await delay(30000); // Wait 30 seconds before retrying
            } else {
                console.error('Error in batch updating Google Sheets:', error);
                throw new Error('Failed to batch update Google Sheets');
            }
        }
    }
    throw new Error('Max retries exceeded for batch update');
};

// Function to update lead info
export const updateLeadInfo = async (rowIndex, status, phoneCallProviderId, callId) => {
    const updates = [
        {
            range: `Lead list!F${rowIndex}`, // Status column
            values: [status],
        },
        {
            range: `Lead list!G${rowIndex}`, // phoneCallProviderId column
            values: [phoneCallProviderId],
        },
        {
            range: `Lead list!H${rowIndex}`, // callId column
            values: [callId],
        },
    ];
    await batchUpdateCells(updates);
};

// Function to get active phone numbers
export const getActivePhoneNumbers = async () => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = "'Phone Numbers'!A:B";

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (rows && rows.length) {
            const activeNumbers = rows
                .filter((row) => row[1] && row[1].toLowerCase() === 'active')
                .map((row) => row[0]);

            return activeNumbers;
        } else {
            throw new Error('No data found in Phone Numbers sheet.');
        }
    } catch (error) {
        console.error('Error accessing Google Sheets API for phone numbers:', error);
        throw new Error('Failed to fetch active phone numbers');
    }
};

// Function to process the end call report and update Google Sheets
export const processEndCallReport = async (report) => {
    if (!report || !report.message || !report.message.call) {
        console.error('Invalid report structure:', report);
        return;
    }

    const endedReason = report.message.endedReason;
    const recordingUrl = report.message.artifact.recordingUrl;
    const phoneCallProviderId = report.message.call.phoneCallProviderId;
    const cost = report.message.cost;

    const leads = await getLeads();

    const rowIndex = leads.findIndex((lead) => lead[6] === phoneCallProviderId);

    if (rowIndex === -1) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return;
    }

    let duration, price;
    try {
        const callDetails = await fetchCallDetails(phoneCallProviderId);
        duration = callDetails.duration;
        price = callDetails.price;
    } catch (error) {
        console.error(`Failed to fetch call details for provider ID: ${phoneCallProviderId}`, error);
        return;
    }

    const updates = [
        { range: `Lead list!I${rowIndex + 1}`, values: [endedReason] },
        { range: `Lead list!J${rowIndex + 1}`, values: [duration] },
        { range: `Lead list!K${rowIndex + 1}`, values: [price] },
        { range: `Lead list!R${rowIndex + 1}`, values: [cost] },
        { range: `Lead list!L${rowIndex + 1}`, values: [recordingUrl] },
    ];

    await batchUpdateCells(updates);
};

// Function to fetch call details from Twilio
const fetchCallDetails = async (phoneCallProviderId) => {
    try {
        const call = await twilioClient.calls(phoneCallProviderId).fetch();
        return {
            duration: call.duration,
            price: call.price,
        };
    } catch (error) {
        console.error('Error fetching call details from Twilio:', error);
        throw new Error('Failed to fetch call details from Twilio');
    }
};

// Function to update specific cells in Google Sheets
export const updateSpecificCell = async (rowIndex, column, value) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;

    const cellRange = `Lead list!${column}${rowIndex}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRange,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[value]],
        },
    });
};

// Function to update cell M
export const updateCellM = (rowIndex, value) => updateSpecificCell(rowIndex, 'M', value);

// Function to update cell N
export const updateCellN = (rowIndex, value) => updateSpecificCell(rowIndex, 'N', value);

// Function to update cell O
export const updateCellO = (rowIndex, value) => updateSpecificCell(rowIndex, 'O', value);

// Function to update cell P
export const updateCellP = (rowIndex, value) => updateSpecificCell(rowIndex, 'P', value);

// Function to update cell Q
export const updateCellQ = (rowIndex, value) => updateSpecificCell(rowIndex, 'Q', value);