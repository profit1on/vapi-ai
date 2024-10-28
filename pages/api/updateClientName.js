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

        const { toolCallList } = message;

        // Check if toolCallList exists and is not empty
        if (!toolCallList || toolCallList.length === 0) {
            return res.status(400).json({ error: 'No toolCallList data found in the request.' });
        }

        // Assuming you want to get the first object in the toolCallList
        const firstToolCall = toolCallList[0];

        // Extract the specific argument you need from firstToolCall
        const argumentToUpdate = firstToolCall.clientName; // Replace 'yourSpecificArgument' with the actual key you want

        // Ensure argumentToUpdate exists before updating
        if (!argumentToUpdate) {
            return res.status(400).json({ error: 'No argument found to update in Google Sheets.' });
        }

        // Example: Update cell M with the extracted argument
        const rowIndex = 2; // Adjust this to the correct row index where you want to update cell M
        await updateCellM(rowIndex, argumentToUpdate); // Call the function to update cell M

        // Send back the received data as a response for verification
        res.status(200).json({
            message: 'Data received successfully and Google Sheets updated.',
            updatedArgument: argumentToUpdate
        });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
