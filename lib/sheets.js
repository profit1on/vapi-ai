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

// Define individual cell update functions
export const updateCellM = async (auth, rowIndex, value) => {
    await batchUpdateCells([
        {
            range: `Lead list!M${rowIndex + 1}`,
            values: [value],
        },
    ]);
};

export const updateCellN = async (auth, rowIndex, value) => {
    await batchUpdateCells([
        {
            range: `Lead list!N${rowIndex + 1}`,
            values: [value],
        },
    ]);
};

export const updateCellO = async (auth, rowIndex, value) => {
    await batchUpdateCells([
        {
            range: `Lead list!O${rowIndex + 1}`,
            values: [value],
        },
    ]);
};

export const updateCellP = async (auth, rowIndex, value) => {
    await batchUpdateCells([
        {
            range: `Lead list!P${rowIndex + 1}`,
            values: [value],
        },
    ]);
};

export const updateCellQ = async (auth, rowIndex, value) => {
    await batchUpdateCells([
        {
            range: `Lead list!Q${rowIndex + 1}`,
            values: [value],
        },
    ]);
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
