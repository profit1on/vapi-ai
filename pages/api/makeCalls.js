import { getLeads, getActivePhoneNumbers, batchUpdateCells } from '../../lib/sheets'; // Import necessary functions
import { makeCall } from '../../lib/vapi';

// Helper function to chunk an array into smaller arrays of a given size
const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { numberOfCalls } = req.body; // Number of calls from the request body

        // Validate the number of calls
        if (!Number.isInteger(numberOfCalls) || numberOfCalls <= 0) {
            return res.status(400).json({ message: 'Please provide a valid number of calls.' });
        }

        try {
            // Fetch leads and filter for "not-called"
            const leads = await getLeads();
            const notCalledLeads = leads.filter(lead => lead[5] === 'not-called');

            // Fetch active phone numbers
            const activePhoneNumbers = await getActivePhoneNumbers();
            if (activePhoneNumbers.length === 0) {
                return res.status(400).json({ message: 'No active phone numbers available.' });
            }

            const batches = chunkArray(notCalledLeads.slice(0, numberOfCalls), 5); // Chunk leads into batches of 5

            for (const batch of batches) {
                const callResults = await Promise.all(
                    batch.map(async (lead) => {
                        const randomIndex = Math.floor(Math.random() * activePhoneNumbers.length);
                        const phoneNumberId = activePhoneNumbers[randomIndex];

                        const customerData = {
                            name: lead[0],
                            number: `+${lead[2]}`,
                            extension: lead[6] || "",
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
                            return {
                                success: true,
                                lead,
                                phoneCallProviderId: result.phoneCallProviderId,
                                callId: result.id,
                            };
                        } catch (error) {
                            console.error(`Error calling ${lead[0]}:`, error.message);
                            return { success: false, lead, error: error.message };
                        }
                    })
                );

                // Prepare Google Sheets updates
                const updates = callResults.map((result) => {
                    const rowIndex = leads.indexOf(result.lead) + 1; // Find the row index
                    if (result.success) {
                        return [
                            { range: `Lead list!F${rowIndex}`, values: ['called'] },
                            { range: `Lead list!G${rowIndex}`, values: [result.phoneCallProviderId] },
                            { range: `Lead list!H${rowIndex}`, values: [result.callId] },
                        ];
                    } else {
                        return [
                            { range: `Lead list!F${rowIndex}`, values: ['error'] },
                            { range: `Lead list!H${rowIndex}`, values: [result.error] },
                        ];
                    }
                }).flat();

                // Batch update Google Sheets
                if (updates.length > 0) {
                    await batchUpdateCells(updates);
                }

                // Add a delay between batches to avoid rate limits
                await delay(2000);
            }

            res.status(200).json({ message: 'Calls processed successfully' });
        } catch (error) {
            console.error('Error processing calls:', error);
            res.status(500).json({ error: 'Failed to process calls', message: error.message });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
