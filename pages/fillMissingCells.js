// pages/api/fillMissingCells.js
import { getLeads, updateCell } from '../../lib/sheets'; // Import your existing functions

const fillMissingCells = async () => {
    try {
        const leads = await getLeads(); // Fetch existing data from Google Sheets
        const spreadsheetId = '1lh9Sd3dOfRdmoPmuZQonRwCol089DN34Qh9TFFLfjCI'; // Your spreadsheet ID

        for (let rowIndex = 1; rowIndex < leads.length; rowIndex++) { // Start from rowIndex 1 to skip header
            const row = leads[rowIndex];

            // Check if the status in column F (index 5) is 'called'
            if (row[5] && row[5].toLowerCase() === 'called') {
                // Check if the cell in column A is missing (adjust column index as needed)
                if (!row[0]) { // Check if column A is missing
                    const actualData = 'Your Actual Data'; // Replace with logic to fetch actual data
                    await updateCell(rowIndex + 1, 1, actualData); // Update column A (index 0 in row array)
                }

                // Repeat for other columns (B, C, etc.) as needed
                // Example for column B
                if (!row[1]) { // Check if column B is missing
                    const actualDataB = 'Your Actual Data for B'; // Replace with logic to fetch actual data
                    await updateCell(rowIndex + 1, 2, actualDataB); // Update column B
                }

                // Add more columns as necessary...
            }
        }

        console.log('Missing cells filled successfully for "called" status rows!');
    } catch (error) {
        console.error('Error filling missing cells:', error);
    }
};

// Function to handle API requests
export default async function handler(req, res) {
    if (req.method === 'POST') {
        await fillMissingCells();
        res.status(200).json({ message: 'Missing cells fill process started for "called" status rows.' });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
