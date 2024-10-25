// pages/api/updateLead.js
import { updateLeadStatus } from '../../lib/sheets'; // Import the specific function

export default async function updateLeadHandler(req, res) {
    if (req.method === 'POST') {
        const { rowIndex, status } = req.body; // Extract rowIndex and status from the request body

        try {
            await updateLeadStatus(rowIndex, status); // Call the updateLeadStatus function
            res.status(200).json({ message: 'Lead status updated successfully' });
        } catch (error) {
            console.error('Error updating lead status:', error);
            res.status(500).json({ message: 'Failed to update lead status' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
