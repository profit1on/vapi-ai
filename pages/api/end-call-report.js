import Cors from 'cors';
import { processEndCallReport, getLeads, getActivePhoneNumbers } from '../../lib/sheets';
import { makeCall } from '../../lib/vapi';

const cors = Cors({
    methods: ['POST'],
    origin: '*',
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method === 'POST') {
        try {
            const report = req.body;

            console.log('Received end-call report:', report);

            // Process the end-call report
            await processEndCallReport(report);

            // Fetch new leads and active phone numbers
            const leads = await getLeads();
            const notCalledLeads = leads.filter((lead) => lead[5] === 'not-called');
            const activePhoneNumbers = await getActivePhoneNumbers();

            // Initiate a new call if there are leads left
            if (notCalledLeads.length > 0) {
                const lead = notCalledLeads[0];
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
                    await makeCall(phoneNumberId, customerData, assistantOverrides);
                } catch (error) {
                    console.error('Error making new call after report:', error);
                }
            }

            res.status(200).json({ message: 'Report processed and new call initiated if necessary.' });
        } catch (error) {
            console.error('Error processing report:', error);
            res.status(500).json({ message: 'Failed to process report' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
