// api/pqc.js — Post-Quantum Cryptography API (ESM for Vercel)
import {
    falcon512, falcon1024
} from '@noble/post-quantum/falcon.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { slh_dsa_sha2_128s } from '@noble/post-quantum/slh-dsa.js';
import { ml_kem512 } from '@noble/post-quantum/ml-kem.js';

// Master keypair (deterministic, same for all API signatures)
const MASTER_SEED = Buffer.from('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', 'hex');
const MASTER_KEYS = falcon512.keygen(MASTER_SEED);
const MASTER_PK = MASTER_KEYS.publicKey;
const MASTER_SK = MASTER_KEYS.secretKey;

// Deterministic key derivation per domain
function deriveKey(domainSeed, algorithm) {
    const buf = Buffer.from(domainSeed);
    switch (algorithm) {
        case 'falcon': {
            const seed = Buffer.alloc(48);
            for (let i = 0; i < 48; i++) seed[i] = buf[i % buf.length] ^ (i * 17 + 31);
            return falcon512.keygen(seed);
        }
        case 'ml-dsa': {
            const seed = Buffer.alloc(32);
            for (let i = 0; i < 32; i++) seed[i] = buf[i % buf.length] ^ (i * 13 + 7);
            return ml_dsa65.keygen(seed);
        }
        default: return null;
    }
}

function getFalconInfo() {
    return {
        name: 'FALCON',
        standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
        library: '@noble/post-quantum v0.6.1+',
        status: 'active',
        variants: {
            falcon512: { nistLevel: 1, signatureBytes: 666, publicKeyBytes: 897 }
        }
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const action = req.query.action || req.body?.action;
    const method = req.method;
    const params = method === 'POST' ? (req.body || {}) : (req.query || {});

    try {
        switch (action) {
            case 'info':
                return res.status(200).json(getFalconInfo());

            case 'keys': {
                const { algorithm = 'falcon', variant = 'falcon512' } = params;
                if (algorithm === 'falcon') {
                    const keys = falcon512.keygen(Buffer.alloc(48, 1));
                    return res.status(200).json({
                        success: true, algorithm: 'falcon', variant,
                        publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'),
                        secretKey: '0x' + Buffer.from(keys.secretKey).toString('hex'),
                        publicKeyBytes: keys.publicKey.length
                    });
                }
                return res.status(400).json({ error: 'Unknown algorithm' });
            }

            case 'sign': {
                const { message, secretKey, algorithm = 'falcon', variant = 'falcon512' } = params;
                if (!message) return res.status(400).json({ error: 'message required' });

                let effectiveSK = secretKey;
                if (algorithm === 'falcon' && !effectiveSK) {
                    effectiveSK = '0x' + Buffer.from(MASTER_SK).toString('hex');
                }
                if (!effectiveSK) return res.status(400).json({ error: 'secretKey required' });

                const skBytes = Buffer.from(effectiveSK.startsWith('0x') ? effectiveSK.slice(2) : effectiveSK, 'hex');
                const msgBytes = Buffer.from(message.startsWith('0x') ? message.slice(2) : message, 'hex');

                let sig;
                if (algorithm === 'falcon') {
                    sig = falcon512.sign(msgBytes, skBytes);
                } else {
                    return res.status(400).json({ error: 'Unknown algorithm' });
                }

                return res.status(200).json({
                    success: true, algorithm, variant,
                    signature: '0x' + Buffer.from(sig).toString('hex'),
                    signatureBytes: sig.length,
                    publicKey: '0x' + Buffer.from(MASTER_PK).toString('hex')
                });
            }

            case 'domain-sign': {
                const { domain, txHash, algorithms } = params;
                if (!domain) return res.status(400).json({ error: 'domain required' });
                if (!txHash) return res.status(400).json({ error: 'txHash required' });

                const algos = algorithms || ['falcon', 'ml-dsa'];
                const msgBytes = Buffer.from(txHash.startsWith('0x') ? txHash.slice(2) : txHash, 'hex');

                // Derive deterministic keys from domain name
                const domainSeed = Buffer.from(domain, 'utf8');
                const signatures = {};

                for (const algo of algos) {
                    try {
                        if (algo === 'falcon') {
                            const keys = deriveKey(domainSeed, 'falcon');
                            const sig = falcon512.sign(msgBytes, keys.secretKey);
                            const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');
                            signatures.falcon = {
                                signature: '0x' + Buffer.from(sig).toString('hex'),
                                signatureBytes: sig.length,
                                algorithm: 'falcon', variant: 'falcon512',
                                standard: 'NIST FIPS 206', nistLevel: 1,
                                publicKey: pkHex
                            };
                        } else if (algo === 'ml-dsa') {
                            const keys = deriveKey(domainSeed, 'ml-dsa');
                            const sig = ml_dsa65.sign(msgBytes, keys.secretKey);
                            const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');
                            signatures.mldsa = {
                                signature: '0x' + Buffer.from(sig).toString('hex'),
                                signatureBytes: sig.length,
                                algorithm: 'ml-dsa', variant: 'ml_dsa65',
                                standard: 'NIST FIPS 204', nistLevel: 3,
                                publicKey: pkHex
                            };
                        }
                    } catch (e) {
                        console.error(`[PQC] ${algo} error:`, e.message);
                    }
                }

                if (Object.keys(signatures).length === 0) {
                    return res.status(500).json({ error: 'All PQC signing attempts failed' });
                }

                return res.status(200).json({
                    success: true, domain, signatures
                });
            }

            default:
                return res.status(400).json({
                    error: 'Unknown action',
                    supported: ['info', 'keys', 'sign', 'domain-sign']
                });
        }
    } catch (err) {
        console.error('[PQC] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
