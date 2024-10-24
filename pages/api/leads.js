// pages/api/leads.js
import handler from '../../lib/sheets'; // Use the existing handler from sheets.js

export default async function leadsHandler(req, res) {
    if (req.method === 'GET') {
        return handler(req, res); // Directly call the handler function for GET requests
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
