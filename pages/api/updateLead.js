// pages/api/updateLead.js
import handler from '../../lib/sheets'; // Use the existing handler from sheets.js

export default async function updateLeadHandler(req, res) {
    if (req.method === 'POST') {
        return handler(req, res); // Directly call the handler function for POST requests
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
