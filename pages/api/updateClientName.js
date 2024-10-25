// pages/api/testClientName.js

export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log('Received request body:', req.body); // Log the incoming request body

        // Send back the received data as a response for verification
        res.status(200).json({
            message: 'Data received successfully',
            data: req.body
        });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
