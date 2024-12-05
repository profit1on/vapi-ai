import { getLeads, getActivePhoneNumbers, updateLeadInfo } from '../../lib/sheets'; // Import necessary functions
import { makeCall } from '../../lib/vapi';

// Variables to track state
let ongoingCalls = 0;
const maxConcurrentCalls = 20;
let pendingLeads = [];
let activePhoneNumbers = [];

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to process a lead
const processLead = async (lead) => {
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

        const rowIndex = pendingLeads.indexOf(lead) + 1;
        await updateLeadInfo(rowIndex, 'called', phoneCallProviderId, callId);

        console.log(`Call successful for ${customerData.name}`);
    } catch (error) {
        console.error(`Error calling lead ${customerData.name}:`, error.message);
    } finally {
        // Reduce the count of ongoing calls and trigger the next one if available
        ongoingCalls--;
        triggerNextCall();
    }
};

// Function to trigger the next call
const triggerNextCall = () => {
    if (pendingLeads.length > 0 && ongoingCalls < maxConcurrentCalls) {
        const nextLead = pendingLeads.shift(); // Get the next lead from the queue
        ongoingCalls++;
        processLead(nextLead);
    }
};

// Main API handler
export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            // Fetch leads and active phone numbers
            const leads = await getLeads();
            activePhoneNumbers = await getActivePhoneNumbers();

            if (activePhoneNumbers.length === 0) {
                return res.status(400).json({ message: 'No active phone numbers available.' });
            }

            // Filter leads with "not-called" status
            pendingLeads = leads.filter((lead) => lead[5] === 'not-called');

            // Start with 20 concurrent calls
            const initialCalls = pendingLeads.splice(0, maxConcurrentCalls);
            ongoingCalls = initialCalls.length;

            initialCalls.forEach((lead) => processLead(lead));

            res.status(200).json({ message: 'Initial batch of calls started.' });
        } catch (error) {
            console.error('Error in makeCalls:', error);
            res.status(500).json({ error: 'Failed to start calls.' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
