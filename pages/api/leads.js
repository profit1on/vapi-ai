// pages/api/leads.js
import { getLeads } from '../../lib/sheets'; // Import the specific function

export default async function leadsHandler(req, res) {
    if (req.method === 'GET') {
        try {
            const leads = await getLeads(); // Call the getLeads function to fetch leads
            res.status(200).json(leads); // Return the fetched leads
        } catch (error) {
            console.error('Error fetching leads:', error);
            res.status(500).json({ message: 'Failed to fetch leads' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
