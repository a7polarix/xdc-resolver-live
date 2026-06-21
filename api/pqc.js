// api/pqc.js
// ============================================================
// Post-Quantum Cryptography — Unified API
// ============================================================
// Regroupe FALCON (NIST FIPS 206) + ML-DSA (NIST FIPS 204)
// + signatures hybrides ECDSA+FALCON
//
// Remplace : falcon-keys.js, falcon-sign.js, falcon-verify.js, quantum.js
// ============================================================

import {
    generateFalconKeys,
    signMessage,
    verifySignature,
    generateDilithiumKeys,
    signMessageDilithium,
    verifySignatureDilithium,
    hybridSign,
    getFalconInfo,
    generatePQCKeys,
    signPQC,
    verifyPQC,
    MASTER_PK,
    MASTER_SK,
} from './falcon.js';
import { signWithDomainKeys, verifyDomainSignature, getDomainKeys } from './pqc-domain.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-PQC-Layer', 'FALCON/ML-DSA');

    const method = req.method;
    const params = method === 'GET' ? req.query : (req.body || {});
    const action = params.action || 'info';

    try {
        switch (action) {

            // ---- INFO ----
            case 'info': {
                return res.status(200).json({
                    ...getFalconInfo(),
                    ml_dsa: {
                        name: 'ML-DSA',
                        standard: 'NIST FIPS 204',
                        variants: {
                            ml_dsa44: { nistLevel: 2, signatureBytes: 2420, publicKeyBytes: 1312 },
                            ml_dsa65: { nistLevel: 3, signatureBytes: 3309, publicKeyBytes: 1952 },
                            ml_dsa87: { nistLevel: 5, signatureBytes: 4627, publicKeyBytes: 2592 },
                        },
                        hardProblem: 'Module-LWE / Module-SIS',
                        latticeBased: true,
                        quantumResistant: true,
                    },
                    endpoints: {
                        'POST /api/pqc.js?action=keys': 'Generate key pair',
                        'POST /api/pqc.js?action=sign': 'Sign a message',
                        'POST /api/pqc.js?action=verify': 'Verify a signature',
                        'POST /api/pqc.js?action=hybrid': 'Hybrid ECDSA+FALCON sign',
                        'GET  /api/pqc.js?action=info': 'Algorithm info',
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            // ---- KEY GENERATION ----
            case 'keys': {
                if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { algorithm = 'falcon', variant = 'falcon512' } = params;
                let result;
                if (algorithm === 'falcon') {
                    result = await generateFalconKeys(variant);
                    // Don't expose master secret key to client
                    if (result.secretKey) delete result.secretKey;
                } else if (algorithm === 'ml-dsa' || algorithm === 'dilithium') {
                    result = await generateDilithiumKeys(variant);
                } else if (algorithm === 'slh-dsa' || algorithm === 'sphincs') {
                    result = await generateSPHINCSKeys(variant);
                } else if (algorithm === 'ml-kem' || algorithm === 'kyber') {
                    result = await generateKEMKeys(variant);
                } else {
                    return res.status(400).json({ error: `Unknown algorithm: ${algorithm}. Use: falcon, ml-dsa, slh-dsa, ml-kem` });
                }
                if (result.seed) delete result.seed;
                return res.status(200).json({ success: true, ...result });
            }

            // ---- SIGN ----
            case 'sign': {
                if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { message, secretKey, algorithm = 'falcon', variant = 'falcon512' } = params;
                if (!message) return res.status(400).json({ error: 'message required' });

                // For falcon512, use master key if no secretKey provided (server-side signing)
                let effectiveSecretKey = secretKey;
                if (algorithm === 'falcon' && variant === 'falcon512' && !effectiveSecretKey) {
                    effectiveSecretKey = '0x' + Buffer.from(MASTER_SK).toString('hex');
                }
                if (!effectiveSecretKey) return res.status(400).json({ error: 'secretKey required' });

                let result;
                if (algorithm === 'falcon') {
                    result = await signMessage(message, effectiveSecretKey, variant);
                } else if (algorithm === 'ml-dsa' || algorithm === 'dilithium') {
                    result = await signMessageDilithium(message, effectiveSecretKey, variant);
                } else if (algorithm === 'slh-dsa' || algorithm === 'sphincs') {
                    result = await signMessageSPHINCS(message, effectiveSecretKey, variant);
                } else {
                    return res.status(400).json({ error: `Unknown algorithm: ${algorithm}` });
                }

                // Include master public key for falcon512
                if (algorithm === 'falcon' && variant === 'falcon512') {
                    result.publicKey = '0x' + Buffer.from(MASTER_PK).toString('hex');
                }

                return res.status(200).json({ success: true, ...result });
            }

            // ---- VERIFY ----
            case 'verify': {
                if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { message, signature, publicKey, algorithm = 'falcon', variant = 'falcon512' } = params;
                if (!message) return res.status(400).json({ error: 'message required' });
                if (!signature) return res.status(400).json({ error: 'signature required' });
                if (!publicKey) return res.status(400).json({ error: 'publicKey required' });
                let result;
                if (algorithm === 'falcon') {
                    result = await verifySignature(message, signature, publicKey, variant);
                } else if (algorithm === 'ml-dsa' || algorithm === 'dilithium') {
                    result = await verifySignatureDilithium(message, signature, publicKey, variant);
                } else {
                    return res.status(400).json({ error: `Unknown algorithm: ${algorithm}` });
                }
                return res.status(200).json({ success: true, ...result });
            }

            // ---- HYBRID ECDSA + FALCON ----
            case 'hybrid': {
                if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { message, falconSecretKey, ecdsaSignature, variant = 'falcon512' } = params;
                if (!message) return res.status(400).json({ error: 'message required' });
                if (!falconSecretKey) return res.status(400).json({ error: 'falconSecretKey required' });
                if (!ecdsaSignature) return res.status(400).json({ error: 'ecdsaSignature required' });
                const result = await hybridSign(message, falconSecretKey, ecdsaSignature, variant);
                return res.status(200).json({ success: true, ...result });
            }

            // ---- UNIFIED QUANTUM INTERFACE ----
            case 'quantum': {
                const { operation, algorithm, variant, ...rest } = params;
                if (operation === 'keys') {
                    const result = await generatePQCKeys(algorithm, variant);
                    return res.status(200).json({ success: true, ...result });
                } else if (operation === 'sign') {
                    const { message, secretKey } = rest;
                    if (!message || !secretKey) return res.status(400).json({ error: 'message and secretKey required' });
                    const result = await signPQC(message, secretKey, algorithm, variant);
                    return res.status(200).json({ success: true, ...result });
                } else if (operation === 'verify') {
                    const { message, signature, publicKey } = rest;
                    if (!message || !signature || !publicKey) return res.status(400).json({ error: 'message, signature, publicKey required' });
                    const result = await verifyPQC(message, signature, publicKey, algorithm, variant);
                    return res.status(200).json({ success: true, ...result });
                } else if (operation === 'encapsulate') {
                    const { publicKey } = rest;
                    if (!publicKey) return res.status(400).json({ error: 'publicKey required' });
                    if (!algorithm || !algorithm.match(/ml-kem|kyber/)) return res.status(400).json({ error: 'encapsulate requires ml-kem/kyber algorithm' });
                    const result = await encapsulateKEM(publicKey, variant || 'ml_kem512');
                    return res.status(200).json({ success: true, ...result });
                } else if (operation === 'decapsulate') {
                    const { ciphertext, secretKey } = rest;
                    if (!ciphertext || !secretKey) return res.status(400).json({ error: 'ciphertext and secretKey required' });
                    if (!algorithm || !algorithm.match(/ml-kem|kyber/)) return res.status(400).json({ error: 'decapsulate requires ml-kem/kyber algorithm' });
                    const result = await decapsulateKEM(ciphertext, secretKey, variant || 'ml_kem512');
                    return res.status(200).json({ success: true, ...result });
                } else {
                    return res.status(400).json({ error: `Invalid operation: ${operation}. Use: keys, sign, verify, encapsulate, decapsulate` });
                }
            }

            // ---- DEFAULT ----
            default:
                // Domain-based PQC (XWD contract data as deterministic key source)
                if (action === 'domain-sign' || action === 'domain-verify' || action === 'domain-info') {
                    const domain = params.domain;
                    if (!domain) return res.status(400).json({ error: 'domain required' });
                    if (action === 'domain-sign') {
                        const { txHash, algorithms } = params;
                        if (!txHash) return res.status(400).json({ error: 'txHash required' });
                        const result = await signWithDomainKeys(domain, txHash, algorithms || ['falcon']);
                        if (result.error) return res.status(400).json({ error: result.error });
                        return res.status(200).json({ success: true, domain: result.domain, owner: result.owner, tokenId: result.tokenId, signatures: result.signatures });
                    }
                    if (action === 'domain-verify') {
                        const { message, algorithm, signature, publicKey } = params;
                        const result = await verifyDomainSignature(domain, message, algorithm, signature, publicKey);
                        return res.status(200).json(result);
                    }
                    if (action === 'domain-info') {
                        const result = await getDomainKeys(domain, ['falcon', 'ml-dsa', 'slh-dsa', 'ml-kem']);
                        if (result.error) return res.status(400).json({ error: result.error });
                        return res.status(200).json({ success: true, domain: result.domain, owner: result.owner, tokenId: result.tokenId, publicKeys: result.keys });
                    }
                }
                return res.status(400).json({
                    error: `Unknown action: ${action}`,
                    supported: ['info', 'keys', 'sign', 'verify', 'hybrid', 'quantum', 'domain-sign', 'domain-verify', 'domain-info'],
                });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message, action });
    }
}
