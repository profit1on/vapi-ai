import { getLeads, getActivePhoneNumbers, batchUpdateCells } from '../../lib/sheets';
import { makeCall } from '../../lib/vapi';

let activeCalls = 0; // Track active calls
const maxActiveCalls = 20; // Maximum number of simultaneous calls

// Recursive function to handle calls dynamically
const processCalls = async (leads, activePhoneNumbers) => {
    if (leads.length === 0 || activeCalls >= maxActiveCalls) {
        return; // Stop if no more leads or max active calls reached
    }

    const lead = leads.shift(); // Get the next lead
    activeCalls++; // Increment active calls

    try {
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

        const result = await makeCall(phoneNumberId, customerData, assistantOverrides);
        const rowIndex = leads.indexOf(lead) + 1;

        // Update Google Sheets with success
        await batchUpdateCells([
            { range: `Lead list!F${rowIndex}`, values: ['called'] },
            { range: `Lead list!G${rowIndex}`, values: [result.phoneCallProviderId] },
            { range: `Lead list!H${rowIndex}`, values: [result.id] },
        ]);
    } catch (error) {
        const rowIndex = leads.indexOf(lead) + 1;

        // Update Google Sheets with error
        await batchUpdateCells([
            { range: `Lead list!F${rowIndex}`, values: ['error'] },
            { range: `Lead list!H${rowIndex}`, values: [error.message] },
        ]);
    } finally {
        activeCalls--; // Decrement active calls
        // Continue with the next call
        processCalls(leads, activePhoneNumbers);
    }
};

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { numberOfCalls } = req.body;

            if (!Number.isInteger(numberOfCalls) || numberOfCalls <= 0) {
                return res.status(400).json({ message: 'Please provide a valid number of calls.' });
            }

            const leads = await getLeads();
            const notCalledLeads = leads.filter((lead) => lead[5] === 'not-called');
            const activePhoneNumbers = await getActivePhoneNumbers();

            if (activePhoneNumbers.length === 0) {
                return res.status(400).json({ message: 'No active phone numbers available.' });
            }

            // Start the initial batch of calls
            for (let i = 0; i < Math.min(maxActiveCalls, notCalledLeads.length); i++) {
                processCalls(notCalledLeads, activePhoneNumbers);
            }

            res.status(200).json({ message: 'Calls initiated successfully.' });
        } catch (error) {
            console.error('Error processing calls:', error);
            res.status(500).json({ error: 'Failed to process calls', message: error.message });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
