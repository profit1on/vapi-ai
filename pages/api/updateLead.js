// pages/api/updateLead.js
import { updateLeadInfo, getLeads } from '../../lib/sheets'; // Import necessary functions

export default async function updateLeadHandler(req, res) {
    if (req.method === 'POST') {
        const { phoneCallProviderId, callId, error } = req.body; // Extract phoneCallProviderId, callId, and error from the request body

        try {
            // Fetch leads to find the correct index based on phoneCallProviderId
            const leads = await getLeads();
            const rowIndex = leads.findIndex(lead => lead[6] === phoneCallProviderId);

            if (rowIndex === -1) {
                console.error(`No matching row found for phoneCallProviderId: ${phoneCallProviderId}`);
                return res.status(404).json({ message: 'Lead not found' });
            }

            // Determine the status based on the error
            const status = error && error.message.includes('must be a valid phone number in the E.164 format')
                ? 'Bad Request'
                : 'called';

            // Update lead info in Google Sheets
            await updateLeadInfo(rowIndex + 1, status, phoneCallProviderId, callId);
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
