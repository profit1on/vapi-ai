import { getLeads, getActivePhoneNumbers, updateLeadInfo } from '../../lib/sheets'; // Import necessary functions
import { makeCall } from '../../lib/vapi';

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main API handler
export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { numberOfCalls } = req.body;

        // Validate input
        if (!Number.isInteger(numberOfCalls) || numberOfCalls <= 0) {
            return res.status(400).json({ message: 'Invalid number of calls.' });
        }

        try {
            // Fetch leads and active phone numbers
            const leads = await getLeads();
            const notCalledLeads = leads.filter((lead) => lead[5] === 'not-called');
            const activePhoneNumbers = await getActivePhoneNumbers();

            if (activePhoneNumbers.length === 0) {
                return res.status(400).json({ message: 'No active phone numbers available.' });
            }

            const callResults = [];
            for (let i = 0; i < Math.min(numberOfCalls, notCalledLeads.length); i++) {
                const lead = notCalledLeads[i];
                const randomIndex = Math.floor(Math.random() * activePhoneNumbers.length);
                const phoneNumberId = activePhoneNumbers[randomIndex];

                const customerData = {
                    name: lead[0],
                    number: `+${lead[2]}`,
                    extension: lead[6] || '',
                };

                const assistantOverrides = {
                    variableValues: {
                        user_firstname: lead[0],
                        user_lastname: lead[1],
                        user_email: lead[3],
                        user_country: lead[4],
                    },
                };

                try {
                    const result = await makeCall(phoneNumberId, customerData, assistantOverrides);
                    const phoneCallProviderId = result.phoneCallProviderId;
                    const callId = result.id;

                    const rowIndex = leads.indexOf(lead) + 1;
                    await updateLeadInfo(rowIndex, 'called', phoneCallProviderId, callId);

                    callResults.push({ success: true, lead, result });
                } catch (error) {
                    console.error(`Error calling lead ${lead[0]}:`, error.message);
                    callResults.push({ success: false, lead, error: error.message });
                }

                // Add a delay between calls
                await delay(500);
            }

            res.status(200).json({ message: 'Calls processed.', results: callResults });
        } catch (error) {
            console.error('Error in makeCalls:', error);
            res.status(500).json({ error: 'Failed to process calls.' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
