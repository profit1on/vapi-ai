// pages/api/updateLead.js
import { updateLeadInfo, getLeads } from '../../lib/sheets';
import { makeCall } from '../../lib/callService'; // Import a hypothetical function to initiate the call

export default async function updateLeadHandler(req, res) {
    if (req.method === 'POST') {
        try {
            // Fetch all leads
            const leads = await getLeads();

            // Filter leads with "not-called" status
            const notCalledLeads = leads.filter(lead => lead[5] === 'not-called'); // Assuming status is in column F (index 5)

            for (const lead of notCalledLeads) {
                const rowIndex = leads.indexOf(lead) + 1; // Get row index for updating
                const phoneCallProviderId = lead[6]; // Assuming phoneCallProviderId is in column G

                try {
                    // Attempt to make the call
                    const callResult = await makeCall(phoneCallProviderId); // Hypothetical function to initiate call

                    // Check if any valid phoneCallProviderId is returned in callResult
                    if (callResult && callResult.phoneCallProviderId) {
                        // Update status to "called" and include the phoneCallProviderId
                        await updateLeadInfo(rowIndex, 'called', callResult.phoneCallProviderId, callResult.callId);
                    }
                } catch (error) {
                    // Check for "Bad Request" error and update accordingly
                    if (error.message && error.message.includes('Bad Request')) {
                        await updateLeadInfo(rowIndex, 'bad-request', phoneCallProviderId, null);
                        console.log(`Bad Request error for lead at row ${rowIndex}. Continuing to next lead.`);
                        continue; // Move to the next lead
                    }
                    // Log other errors and stop the loop if non-recoverable
                    console.error(`Error making call for lead at row ${rowIndex}:`, error);
                    break;
                }
            }

            res.status(200).json({ message: 'Lead calling process completed' });
        } catch (error) {
            console.error('Error updating lead status:', error);
            res.status(500).json({ message: 'Failed to update lead status' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
