// server.js
import express from 'express';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Endpoint to receive end-call reports
app.post('/api/end-call-report', (req, res) => {
    const report = req.body; // Assuming the report data is sent in the request body
    
    // Log the received report for debugging
    console.log('Received end-call report:', report);

    // Process the report as needed here
    
    // Send a response back to vapi
    res.status(200).json({ message: 'Report received successfully' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});