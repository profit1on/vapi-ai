// pages/api/call.js
import { makeCall } from '../../lib/vapi';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { phoneNumberId, customer } = req.body; // Destructure phoneNumberId and customer

        // Validate required fields
        if (!phoneNumberId || !customer || !customer.number || !customer.name) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        try {
            // Pass customer data to makeCall
            const response = await makeCall(phoneNumberId, customer);
            res.status(200).json({ message: 'Call made successfully', response });
        } catch (error) {
            res.status(error.response?.status || 500).json({ error: 'Error making call', message: error.response?.data });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
