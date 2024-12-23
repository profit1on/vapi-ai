// pages/api/end-call-report.js
import Cors from 'cors';
import { processEndCallReport } from '../../lib/sheets'; // Import the function to process the end call report

// Initialize CORS middleware
const cors = Cors({
    methods: ['POST'],
    origin: '*', // Adjust this to allow specific origins if needed
});

// Helper method to run middleware
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

// API route handler
export default async function handler(req, res) {
    await runMiddleware(req, res, cors); // Run CORS middleware

    if (req.method === 'POST') {
        const report = req.body; // Get the report from the request body

        // Log the received report for debugging
        console.log('Received end-call report:', report);

        try {
            // Process the report to update Google Sheets
            await processEndCallReport(report); // Call the function to update the sheet

            // Send a response back to the client
            res.status(200).json({ message: 'Report received and processed successfully' });
        } catch (error) {
            console.error('Error processing report:', error);
            res.status(500).json({ message: 'Failed to process report' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
