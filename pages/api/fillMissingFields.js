import { getLeads, updateCellM, updateCellN, updateCellO, updateCellP, updateCellQ } from '../../lib/sheets';

const BATCH_SIZE = 5; // Define the batch size for updates
const BASE_URL = 'https://vapi.profiton.pace'; // Base URL for API calls
let updatesBatch = []; // Array to hold batched updates

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    console.log('Received request to check for missing data');

    try {
        const leads = await getLeads(); // Fetch all leads from Google Sheets
        const updatePromises = [];

        // Loop through each row and check for missing fields
        leads.forEach((lead, index) => {
            const phoneCallProviderId = lead[6]; // Assuming phoneCallProviderId is in column G

            if (!phoneCallProviderId) {
                console.warn(`Skipping row ${index + 1} due to missing phoneCallProviderId`);
                return; // Skip rows with missing phoneCallProviderId
            }

            // Queue updates for missing fields
            if (!lead[12]) updatePromises.push(queueUpdate(index + 1, 'updateClientName', phoneCallProviderId, updateCellM));
            if (!lead[13]) updatePromises.push(queueUpdate(index + 1, 'tradingAnywhere', phoneCallProviderId, updateCellN));
            if (!lead[14]) updatePromises.push(queueUpdate(index + 1, 'lostAnything', phoneCallProviderId, updateCellO));
            if (!lead[15]) updatePromises.push(queueUpdate(index + 1, 'howMuch', phoneCallProviderId, updateCellP));
            if (!lead[16]) updatePromises.push(queueUpdate(index + 1, 'makeAppointment', phoneCallProviderId, updateCellQ));
        });

        // Wait for all updates to finish
        await Promise.all(updatePromises);
        await processBatchUpdates(); // Process remaining batch updates

        res.status(200).json({ message: 'Checked and updated missing fields successfully' });
    } catch (error) {
        console.error('Error updating missing fields:', error);
        res.status(500).json({ error: 'Internal server error' });
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
    if (updatesBatch.length === 0) return; // Skip if no updates in batch

    try {
        await Promise.all(updatesBatch.map(async (update) => {
            await update.updateCellFunction(update.rowIndex, update.value);
        }));
        console.log(`Processed ${updatesBatch.length} updates successfully.`);
    } catch (error) {
        console.error('Error processing batch updates:', error);
    } finally {
        updatesBatch = []; // Clear the batch after processing
    }
};

// Fetch data from the specific API
const fetchDataFromAPI = async (apiName, phoneCallProviderId) => {
    try {
        const response = await fetch(`${BASE_URL}/api/${apiName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneCallProviderId }),
        });

        if (!response.ok) {
            throw new Error(`API call failed for ${apiName}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.updatedArgument || ''; // Adjust based on actual response structure
    } catch (error) {
        console.error(`Error fetching data from API (${apiName}):`, error);
        return null;
    }
};
