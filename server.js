// server.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // Parse JSON requests

// Endpoint to receive end-call reports
app.post('/api/end-call-report', (req, res) => {
    const report = req.body; // Assuming the report data is sent in the request body

    // Log the received report for debugging
    console.log('Received end-call report:', report);

    try {
        // Process the report as needed here
        
        // Send a response back to vapi
        res.status(200).json({ message: 'Report received successfully' });
    } catch (error) {
        console.error('Error processing report:', error);
        res.status(500).json({ message: 'Failed to process report' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
