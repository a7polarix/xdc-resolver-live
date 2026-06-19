// api/falcon-verify.js
import { verifySignature, verifySignatureDilithium } from './falcon.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, signature, publicKey, variant = 'falcon512' } = req.body;

    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!signature) return res.status(400).json({ error: 'Signature required (hex)' });
    if (!publicKey) return res.status(400).json({ error: 'Public key required (hex)' });

    try {
        if (variant === 'ml_dsa65' || variant === 'dilithium') {
            const result = await verifySignatureDilithium(message, signature, publicKey);
            return res.status(200).json({ success: true, ...result });
        } else {
            const result = await verifySignature(message, signature, publicKey, variant);
            return res.status(200).json({ success: true, ...result });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Verification failed: ' + err.message });
    }
}
