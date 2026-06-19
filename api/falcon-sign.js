// api/falcon-sign.js
import { signMessage, signMessageDilithium } from './falcon.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, secretKey, variant = 'falcon512' } = req.body;

    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!secretKey) return res.status(400).json({ error: 'Secret key required (hex)' });

    try {
        if (variant === 'ml_dsa65' || variant === 'dilithium') {
            const result = await signMessageDilithium(message, secretKey);
            return res.status(200).json({ success: true, ...result });
        } else {
            const result = await signMessage(message, secretKey, variant);
            return res.status(200).json({ success: true, ...result });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Signing failed: ' + err.message });
    }
}
