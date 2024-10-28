// pages/api/involvementLevel.js
import { getLeads, updateCellN } from '../../lib/sheets'; // Import the function to update Google Sheets

export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log('Testing involvementLevel Received request body:', req.body); // Log the incoming request body

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
        console.log('Tool Calls Debug:', JSON.stringify(toolCallList, null, 2));

        // Assuming you want to get the first object in the toolCallList
        const firstToolCall = toolCallList[0];

        // Extract involvement level from the tool call's function arguments
        const involvementLevelFromToolCall = firstToolCall.function?.arguments?.involvementLevel;

        // Use involvementLevelFromToolCall or fallback to customer.name, or set to empty string if both are undefined
        const argumentToUpdate = involvementLevelFromToolCall || customer?.name || ''; // Set to empty string if not found

        // Log the argument to update for verification
        console.log(`Updating cell N with argument: ${argumentToUpdate}`);

        try {
            // Fetch leads to find the correct index
            const leads = await getLeads(); 
            // Find the index of the lead based on customer number (or any other unique identifier)
            const rowIndex = leads.findIndex(lead => lead[0] === customer.number); // Assuming customer number is in column A

            if (rowIndex === -1) {
                return res.status(404).json({ error: 'No matching customer found in the leads.' });
            }

            // Update cell N with the involvement level
            await updateCellN(rowIndex + 1, argumentToUpdate); // Update with the correct row index (+1 for Google Sheets)

            res.status(200).json({
                message: 'Data received successfully and updated in Google Sheets.',
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
