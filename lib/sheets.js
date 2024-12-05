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

    const spreadsheetId = process.env.SPREADSHEET_ID; // Your spreadsheet ID
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

    const spreadsheetId = process.env.SPREADSHEET_ID; // Your spreadsheet ID

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

// Function to update leads in batches of 5
export const updateLeadsInBatches = async (updates) => {
    for (let i = 0; i < updates.length; i += 5) {
        const batch = updates.slice(i, i + 5); // Process 5 updates at a time
        await batchUpdateCells(batch);
        console.log(`Batch updated successfully: Batch ${Math.floor(i / 5) + 1}`);
    }
};

// Function to process the call result when received
export const handleCallResult = async (callResults) => {
    const leads = await getLeads(); // Fetch leads to find the correct index

    const updates = callResults.map(callResult => {
        const { phoneCallProviderId, callId } = callResult; // Extract values from the call result

        if (!phoneCallProviderId || !callId) {
            console.error('Missing phoneCallProviderId or callId in the result.');
            return null; // Skip if IDs are missing
        }

        const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId); // Find the row index

        if (rowIndex === -1) {
            console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
            return null; // Skip if no matching row is found
        }

        return [
            {
                range: `Lead list!F${rowIndex + 1}`, // Status in column F
                values: ['called'],
            },
            {
                range: `Lead list!G${rowIndex + 1}`, // PhoneCallProviderId in column G
                values: [phoneCallProviderId],
            },
            {
                range: `Lead list!H${rowIndex + 1}`, // Call ID in column H
                values: [callId],
            },
        ];
    }).flat().filter(Boolean); // Flatten and remove null updates

    if (updates.length > 0) {
        await updateLeadsInBatches(updates); // Update in batches
    } else {
        console.log('No updates to process.');
    }
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
    const cost = report.message.cost; // Extract the cost from the report

    const leads = await getLeads(); // Fetch leads to find the correct index

    const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId); // Find the row index

    if (rowIndex === -1) {
        console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
        return; // Skip if no matching row is found
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
            values: [price], // Update price in column K
        },
        {
            range: `Lead list!R${rowIndex + 1}`, // Cost in column R
            values: [cost], // Update cost in column R
        },
        {
            range: `Lead list!L${rowIndex + 1}`, // Recording URL in column L
            values: [recordingUrl],
        },
    ];

    await batchUpdateCells(updates); // Batch update the Google Sheets with the prepared updates
};

// Function to get active phone numbers
export const getActivePhoneNumbers = async () => {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
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
