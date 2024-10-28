// pages/api/makeCalls.js 
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
            if (error.response && error.response.data && error.response.data.error && error.response.data.error.reason === 'rateLimitExceeded') {
                const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
                console.warn(`Rate limit exceeded. Retrying in ${waitTime}ms...`);
                await delay(waitTime);
            } else {
                console.error(`Error during request: ${error.message}`);
                throw error; // Rethrow other errors
            }
        }
    }
    throw new Error('Max retries exceeded.');
};

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { numberOfCalls } = req.body; // Get the number of calls from the request body

        // Validate the number of calls
        if (!Number.isInteger(numberOfCalls) || numberOfCalls <= 0) {
            return res.status(400).json({ message: 'Please provide a valid number of calls.' });
        }

        try {
            // Step 1: Fetch leads from Google Sheets
            const leads = await getLeads();

            // Step 2: Filter leads to only include those with "not-called" status
            const notCalledLeads = leads.filter(lead => lead[5] === 'not-called');

            const callResults = [];
            // Step 3: Fetch active phone numbers
            const activePhoneNumbers = await getActivePhoneNumbers();

            if (activePhoneNumbers.length === 0) {
                console.error('No active phone numbers available for making calls.');
                return res.status(400).json({ message: 'No active phone numbers available.' });
            }

            // Calculate the actual number of calls to be made
            const callsToMake = Math.min(numberOfCalls, notCalledLeads.length);

            // Make calls to the specified number of leads or until there are no more leads left
            for (let i = 0; i < callsToMake; i++) {
                const lead = notCalledLeads[i]; // Select the lead based on the current index

                // Select a random active phone number ID
                const randomIndex = Math.floor(Math.random() * activePhoneNumbers.length);
                const phoneNumberId = activePhoneNumbers[randomIndex]; // Get a random active phone number ID

                const customerData = {
                    name: lead[0], // Adjust index as per your data structure
                    number: `+${lead[2]}`, // Assuming lead[2] contains the number without the '+' prefix
                    extension: lead[6] || "", // If extension is stored in lead[6], adjust accordingly
                };

                // Prepare the assistant overrides with dynamic variables
                const assistantOverrides = {
                    variableValues: {
                        user_firstname: lead[0], // Assuming first name is in lead[0]
                        user_lastname: lead[1], // Assuming last name is in lead[1]
                        user_email: lead[3], // Assuming email is in lead[3]
                        user_country: lead[4], // Assuming country is in lead[4]
                    },
                };

                let attempt = 0; // Track the number of attempts for the current lead
                let success = false; // Track if the call was successful

                while (attempt < 5 && !success) {
                    attempt++;

                    try {
                        // Make the call with backoff and store the result
                        const result = await makeRequestWithBackoff(() => makeCall(phoneNumberId, customerData, assistantOverrides));
                        callResults.push(result);

                        // Log the result for debugging purposes
                        console.log(`Call Result for ${customerData.name}:`, result);

                        // Get the phoneCallProviderId and callId from the result
                        const phoneCallProviderId = result.phoneCallProviderId;
                        const callId = result.id; // Use the ID from the result

                        // Check if the result contains the required IDs
                        if (!phoneCallProviderId || !callId) {
                            console.error(`Missing phoneCallProviderId or callId for ${customerData.name}`);
                            continue; // Skip this lead if any ID is missing
                        }

                        // Update the lead status and call information in Google Sheets
                        const rowIndex = leads.indexOf(lead) + 1; // Get the row index (1-based index)
                        await updateLeadInfo(rowIndex, 'called', phoneCallProviderId, callId); // Pass the status, provider ID, and call ID

                        success = true; // Mark success
                    } catch (error) {
                        console.error(`Error making call for ${customerData.name}:`, error.message);
                        // Log the specific error response for further investigation
                        if (error.response) {
                            console.error('Error response from VAPI:', error.response.data);
                        }
                        // If it was a rate limit error, wait and retry
                        if (error.response && error.response.data && error.response.data.error && error.response.data.error.reason === 'rateLimitExceeded') {
                            console.warn(`Rate limit exceeded for ${customerData.name}. Retrying...`);
                            await delay(2000); // Short delay before retrying
                        } else {
                            break; // Break out of the loop for other errors
                        }
                    }
                }

                // Introduce a delay of 2 seconds between calls
                await delay(2000); // Adjust the delay time as needed (in milliseconds)
            }

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
