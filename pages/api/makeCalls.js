// pages/api/makeCalls.js
import { getLeads, getActivePhoneNumbers, updateLeadStatus } from '../../lib/sheets'; // Import necessary functions
import { makeCall } from '../../lib/vapi';

// Function to create a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            // Step 1: Fetch leads from Google Sheets
            const leads = await getLeads();

            // Step 2: Filter leads to only include those with "not-called" status
            const notCalledLeads = leads.filter(lead => lead[5] === 'not-called');

            const callResults = [];
            // Step 3: Fetch active phone numbers
            const activePhoneNumbers = await getActivePhoneNumbers();

            for (const lead of notCalledLeads) {
                // Select a random active phone number ID
                const randomIndex = Math.floor(Math.random() * activePhoneNumbers.length);
                const phoneNumberId = activePhoneNumbers[randomIndex]; // Get a random active phone number ID

                const customerData = {
                    name: lead[0], // Adjust index as per your data structure
                    number: `+${lead[2]}`, // Assuming lead[2] contains the number without the '+' prefix
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

                // Make the call and store the result
                const result = await makeCall(phoneNumberId, customerData, assistantOverrides);
                callResults.push(result);

                // Log the result for debugging purposes
                console.log(`Call Result for ${customerData.name}:`, result);

                // Get the phoneCallProviderId from the result
                const phoneCallProviderId = result.phoneCallProviderId;

                // Update the lead status to "called" in Google Sheets
                const rowIndex = leads.indexOf(lead) + 1; // Get the row index (1-based index)
                await updateLeadStatus(rowIndex, 'called', phoneCallProviderId); // Pass the phoneCallProviderId to the update function

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
