// api/falcon-keys.js
import { generateFalconKeys, generateDilithiumKeys, getFalconInfo } from './falcon.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET') {
        return res.status(200).json(getFalconInfo());
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { variant = 'falcon512' } = req.body;

    try {
        if (variant === 'ml_dsa65' || variant === 'dilithium') {
            const keys = await generateDilithiumKeys();
            return res.status(200).json({ success: true, ...keys, algorithm: 'ML-DSA', standard: 'NIST FIPS 204', quantumResistant: true });
        } else if (variant === 'falcon1024') {
            const keys = await generateFalconKeys('falcon1024');
            return res.status(200).json({ success: true, ...keys, algorithm: 'FALCON-1024', standard: 'NIST PQC Round 3', quantumResistant: true });
        } else {
            const keys = await generateFalconKeys('falcon512');
            return res.status(200).json({ success: true, ...keys, algorithm: 'FALCON-512', standard: 'NIST PQC Round 3', quantumResistant: true });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Key generation failed: ' + err.message });
    }
}
