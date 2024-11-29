import { google } from 'googleapis';
import { Buffer } from 'buffer';
import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Load your Google Sheets client credentials from the environment variable
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

// Fetch leads from Google Sheets
export const getLeads = async () => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI';
    const range = "'Lead list'!A1:H";

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        return response.data.values || [];
    } catch (error) {
        console.error('Error fetching leads from Google Sheets:', error);
        throw new Error('Failed to fetch leads');
    }
};

// Batch update multiple cells in Google Sheets
export const batchUpdateCells = async (updates) => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI';

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

// Fetch call details from Twilio
const fetchCallDetails = async (phoneCallProviderId) => {
    try {
        const call = await twilioClient.calls(phoneCallProviderId).fetch();
        return {
            duration: call.duration,
            price: call.price,
        };
    } catch (error) {
        console.error('Error fetching call details from Twilio:', error);
        throw new Error('Failed to fetch call details');
    }
};

// Process call result and update lead info
export const handleCallResult = async (callResult) => {
    const { phoneCallProviderId, callId } = callResult;

    if (!phoneCallProviderId || !callId) {
        console.error('Missing phoneCallProviderId or callId');
        return;
    }

    const leads = await getLeads();
    const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId);

    if (rowIndex === -1) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return;
    }

    await updateLeadInfo(rowIndex + 1, 'called', phoneCallProviderId, callId);
};

// Process the end call report and update Google Sheets
export const processEndCallReport = async (report) => {
    if (!report?.message?.call) {
        console.error('Invalid report structure:', report);
        return;
    }

    const {
        message: { endedReason, artifact, call, cost },
    } = report;
    const { recordingUrl } = artifact;
    const { phoneCallProviderId } = call;

    const leads = await getLeads();
    const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId);

    if (rowIndex === -1) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return;
    }

    try {
        const { duration, price } = await fetchCallDetails(phoneCallProviderId);

        const updates = [
            { range: `Lead list!I${rowIndex + 1}`, values: [endedReason] },
            { range: `Lead list!J${rowIndex + 1}`, values: [duration] },
            { range: `Lead list!K${rowIndex + 1}`, values: [price] },
            { range: `Lead list!R${rowIndex + 1}`, values: [cost] },
            { range: `Lead list!L${rowIndex + 1}`, values: [recordingUrl] },
        ];

        await batchUpdateCells(updates);
    } catch (error) {
        console.error('Error processing end call report:', error);
    }
};

// Update lead info in Google Sheets
export const updateLeadInfo = async (rowIndex, status, phoneCallProviderId, callId) => {
    const updates = [
        { range: `Lead list!F${rowIndex}`, values: [status] },
        { range: `Lead list!G${rowIndex}`, values: [phoneCallProviderId] },
        { range: `Lead list!H${rowIndex}`, values: [callId] },
    ];

    await batchUpdateCells(updates);
};
