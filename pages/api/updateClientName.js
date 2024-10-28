// pages/api/updateClientName.js
import { updateCellM } from '../../lib/sheets'; // Import the function to update Google Sheets

export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log('Testing updateClientName Received request body:', req.body); // Log the incoming request body

        // Extract relevant information from the request body
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'No message data found in the request.' });
        }

        const { toolCallList, customer } = message; // Include customer for potential extraction

        // Check if toolCallList exists and is not empty
        if (!toolCallList || toolCallList.length === 0) {
            return res.status(400).json({ error: 'No toolCallList data found in the request.' });
        }

        // Log toolCalls to inspect their structure
        console.log('Tool Calls:', JSON.stringify(toolCallList, null, 2));

        // Assuming you want to get the first object in the toolCallList
        const firstToolCall = toolCallList[0];

        // Extract the specific argument you need
        const argumentToUpdate = firstToolCall.clientName || customer?.name; // Fallback to customer.name if clientName is undefined

        // Ensure argumentToUpdate exists before updating
        if (!argumentToUpdate) {
            return res.status(400).json({ error: 'No argument found to update in Google Sheets.' });
        }

        // Log the argument to update for verification
        console.log(`Updating cell M with argument: ${argumentToUpdate}`);

        try {
            // Example: Update cell M with the extracted argument
            const rowIndex = 2; // Adjust this to the correct row index where you want to update cell M
            const result = await updateCellM(rowIndex, argumentToUpdate); // Call the function to update cell M

            if (result) {
                // Send back a success response with the updated data
                res.status(200).json({
                    message: 'Data received successfully and Google Sheets updated.',
                    updatedArgument: argumentToUpdate
                });
            } else {
                res.status(500).json({ error: 'Failed to update Google Sheets.' });
            }
        } catch (error) {
            console.error('Error updating Google Sheets:', error);
            res.status(500).json({ error: 'Internal server error while updating Google Sheets.' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
