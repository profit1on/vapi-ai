// pages/api/updateClientName.js
import { updateCellM, getLeads } from '../../lib/sheets'; // Import the function to update Google Sheets

let updatesBatch = []; // Array to hold batched updates
const BATCH_SIZE = 5; // Define the batch size

export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log('Testing updateClientName Received request body:', req.body); // Log the incoming request body

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'No message data found in the request.' });
        }

        const { toolCallList, call } = message;

        if (!toolCallList || toolCallList.length === 0) {
            return res.status(400).json({ error: 'No toolCallList data found in the request.' });
        }

        console.log('Tool Calls Debug:', JSON.stringify(toolCallList, null, 2));

        const phoneCallProviderId = call.phoneCallProviderId;

        const leads = await getLeads(); 
        const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId) + 1;

        if (rowIndex === 0) {
            console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
            return res.status(404).json({ error: 'No matching phoneCallProviderId found in Google Sheets.' });
        }

        const firstToolCall = toolCallList[0]; // Adjust index as necessary
        const clientNameFromToolCall = firstToolCall.function?.arguments?.clientName || message.customer?.name || '';
        const argumentToUpdate = clientNameFromToolCall;

        console.log(`Updating cell M${rowIndex} with argument: ${argumentToUpdate}`);

        updatesBatch.push({ rowIndex, value: argumentToUpdate });

        try {
            if (updatesBatch.length >= BATCH_SIZE) {
                await Promise.all(updatesBatch.map(async (update) => {
                    await updateCellM(update.rowIndex, update.value);
                }));
                updatesBatch = []; // Clear the batch after processing
            }

            res.status(200).json({
                message: 'Data received successfully and queued for update.',
                updatedArgument: argumentToUpdate
            });
        } catch (error) {
            console.error('Error updating Google Sheets:', error);
            res.status(500).json({ error: 'Internal server error while updating Google Sheets.' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
