// pages/api/updateLead.js
import { updateLeadInfo } from '../../lib/sheets'; // Import the specific function

export default async function updateLeadHandler(req, res) {
    if (req.method === 'POST') {
        const { rowIndex, phoneCallProviderId, callId, status } = req.body; // Extract necessary fields from the request body

        try {
            // Check if status is 'called', if not set it to 'Bad Request'
            const finalStatus = status === 'called' ? 'called' : 'Bad Request';
            await updateLeadInfo(rowIndex, finalStatus, phoneCallProviderId, callId); // Call the updateLeadInfo function
            res.status(200).json({ message: 'Lead status updated successfully' });
        } catch (error) {
            console.error('Error updating lead status:', error);
            // If there's an error related to the phone number, update status to 'Bad Request'
            if (error.response && error.response.data.error === 'Bad Request' && 
                error.response.data.message.some(msg => msg.includes('must be a valid phone number'))) {
                const badRequestStatus = 'Bad Request'; // Define the status to be set for bad requests
                await updateLeadInfo(rowIndex, badRequestStatus, phoneCallProviderId, callId);
                return res.status(400).json({ message: 'Lead status updated to Bad Request due to invalid phone number.' });
            }
            res.status(500).json({ message: 'Failed to update lead status' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
