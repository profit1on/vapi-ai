// pages/api/webhook.js

export default function handler(req, res) {
    if (req.method === 'POST') {
      // Handle webhook data (req.body contains the incoming data)
      const data = req.body;
  
      console.log('Webhook received:', data);
  
      // Send a success response
      res.status(200).json({ status: 'Webhook received', data });
    } else {
      // Handle any other HTTP method
      res.setHeader('Allow', ['POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  }