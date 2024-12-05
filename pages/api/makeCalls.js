import { getLeads, getActivePhoneNumbers, updateLeadInfo } from '../../lib/sheets'; // Import necessary functions
import { makeCall } from '../../lib/vapi';

// Function to create a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function for exponential backoff
const makeRequestWithBackoff = async (requestFunction, retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await requestFunction();
        } catch (error) {
            if (error.response && error.response.data.error === 'rateLimitExceeded') {
                const waitTime = Math.pow(2, i) * 300; // Exponential backoff
                console.warn(`Rate limit exceeded. Retrying in ${waitTime}ms...`);
                await delay(waitTime);
            } else if (error.response && error.response.data.error === 'Bad Request' && error.response.data.message.includes('Over Concurrency Limit')) {
                console.warn('Over Concurrency Limit reached. Waiting for 10 seconds before continuing...');
                await delay(10000); // Wait for 10 seconds
            } else {
                console.error(`Error during request: ${error.message}`);
                throw error; // Rethrow other errors
            }
        }
    }
    throw new Error('Max retries exceeded.');
};

const MAX_CONCURRENT_CALLS = 10; // Limit for parallel calls

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { numberOfCalls } = req.body;

        // Validate the number of calls
        if (!Number.isInteger(numberOfCalls) || numberOfCalls <= 0) {
            return res.status(400).json({ message: 'Please provide a valid number of calls.' });
        }

        try {
            const leads = await getLeads();
            const notCalledLeads = leads.filter(lead => lead[5] === 'not-called');
            const activePhoneNumbers = await getActivePhoneNumbers();

            if (activePhoneNumbers.length === 0) {
                console.error('No active phone numbers available for making calls.');
                return res.status(400).json({ message: 'No active phone numbers available.' });
            }

            const totalCallsToMake = Math.min(numberOfCalls, notCalledLeads.length);
            const callResults = [];

            // Helper function to make a single call
            const makeSingleCall = async (lead, phoneNumberId) => {
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

                const result = await makeRequestWithBackoff(() =>
                    makeCall(phoneNumberId, customerData, assistantOverrides)
                );

                const phoneCallProviderId = result.phoneCallProviderId;
                const callId = result.id;

                if (!phoneCallProviderId || !callId) {
                    throw new Error(`Missing phoneCallProviderId or callId for ${customerData.name}`);
                }

                const rowIndex = leads.indexOf(lead) + 1; // 1-based index
                await updateLeadInfo(rowIndex, 'called', phoneCallProviderId, callId);

                return result;
            };

            // Function to manage limited concurrency
            const parallelCallTasks = [];
            for (let i = 0; i < totalCallsToMake; i++) {
                const lead = notCalledLeads[i];
                const randomIndex = Math.floor(Math.random() * activePhoneNumbers.length);
                const phoneNumberId = activePhoneNumbers[randomIndex];

                const task = async () => {
                    try {
                        const result = await makeSingleCall(lead, phoneNumberId);
                        callResults.push(result);
                    } catch (error) {
                        console.error(`Error calling lead ${lead[0]}: ${error.message}`);
                        if (error.response?.data?.error === 'Bad Request' && error.response?.data?.message.includes('E.164')) {
                            const rowIndex = leads.indexOf(lead) + 1;
                            await updateLeadInfo(rowIndex, 'Bad Request');
                        }
                    }
                };

                parallelCallTasks.push(task());

                // Wait for some tasks to finish if concurrency limit is reached
                if (parallelCallTasks.length >= MAX_CONCURRENT_CALLS) {
                    await Promise.all(parallelCallTasks.splice(0, MAX_CONCURRENT_CALLS));
                }
            }

            // Wait for all remaining tasks to complete
            await Promise.all(parallelCallTasks);

            console.log(`Total calls made: ${callResults.length}`);
            res.status(200).json({ message: 'Calls made successfully', results: callResults });
        } catch (error) {
            console.error('Error making calls:', error);
            res.status(500).json({ error: 'Failed to make calls', message: error.message });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
