// pages/api/fillMissingFields.js
import { getLeads, updateCellM, updateCellN, updateCellO, updateCellP, updateCellQ } from '../../lib/sheets';

const BATCH_SIZE = 5; // Define the batch size for updates
const BASE_URL = 'https://vapi.profiton.pace';
let updatesBatch = []; // Array to hold batched updates

export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log('Received request to check for missing data');
        
        try {
            // Fetch all leads from Google Sheets
            const leads = await getLeads();

            // Loop through each row and check for missing fields
            leads.forEach((lead, index) => {
                const phoneCallProviderId = lead[6]; // Assuming phoneCallProviderId is in column G

                // Queue updates based on missing fields
                if (!lead[12]) queueUpdate(index + 1, 'updateClientName', phoneCallProviderId, updateCellM);
                if (!lead[13]) queueUpdate(index + 1, 'tradingAnywhere', phoneCallProviderId, updateCellN);
                if (!lead[14]) queueUpdate(index + 1, 'lostAnything', phoneCallProviderId, updateCellO);
                if (!lead[15]) queueUpdate(index + 1, 'howMuch', phoneCallProviderId, updateCellP);
                if (!lead[16]) queueUpdate(index + 1, 'makeAppointment', phoneCallProviderId, updateCellQ);
            });

            // Process updates in batches
            await processBatchUpdates();

            res.status(200).json({ message: 'Checked and updated missing fields successfully' });
        } catch (error) {
            console.error('Error updating missing fields:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

// Queue the update for a specific field and tool
const queueUpdate = async (rowIndex, tool, phoneCallProviderId, updateCellFunction) => {
    try {
        const data = await fetchDataFromAPI(tool, phoneCallProviderId);
        if (data) {
            updatesBatch.push({ rowIndex, value: data, updateCellFunction });

            // Process batch if it reaches the defined size
            if (updatesBatch.length >= BATCH_SIZE) {
                await processBatchUpdates();
            }
        }
    } catch (error) {
        console.error(`Error fetching data for ${tool}:`, error);
    }
};

// Process batched updates in Google Sheets
const processBatchUpdates = async () => {
    await Promise.all(updatesBatch.map(async (update) => {
        await update.updateCellFunction(update.rowIndex, update.value);
    }));
    updatesBatch = []; // Clear the batch after processing
};

// Fetch data from the specific API
const fetchDataFromAPI = async (apiName, phoneCallProviderId) => {
    try {
        const response = await fetch(`${BASE_URL}/api/${apiName}`, { // Added BASE_URL here
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneCallProviderId }),
        });
        const data = await response.json();
        return data.updatedArgument || ''; // Adjust based on actual response structure
    } catch (error) {
        console.error(`Error fetching data from ${apiName}:`, error);
        return null;
    }
};
