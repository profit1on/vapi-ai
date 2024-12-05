import Cors from 'cors';
import { processEndCallReport, getLeads, batchUpdateCells } from '../../lib/sheets';
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

let activeCalls = 0; // Tracks the number of active calls
const maxActiveCalls = 20; // Maximum number of simultaneous calls

const initiateNewCall = async () => {
    const leads = await getLeads();
    const notCalledLeads = leads.filter((lead) => lead[5] === 'not-called');
    const activePhoneNumbers = await getActivePhoneNumbers();

    if (notCalledLeads.length > 0 && activeCalls < maxActiveCalls) {
        const lead = notCalledLeads[0];
        activeCalls++;
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
            activeCalls--;
        }
    }
};

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method === 'POST') {
        try {
            const report = req.body;

            console.log('Received end-call report:', report);

            await processEndCallReport(report);

            // Start a new call if active calls are below the limit
            await initiateNewCall();

            res.status(200).json({ message: 'Report processed and new call initiated successfully.' });
        } catch (error) {
            console.error('Error processing report:', error);
            res.status(500).json({ message: 'Failed to process report' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
