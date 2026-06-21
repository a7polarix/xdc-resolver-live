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

// ============================================================
// XWD Contract RPC (lightweight — no ethers dependency)
// ============================================================
const XDC_RPC = 'https://rpc.xdcrpc.com';
const XWD_CONTRACT = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';

// Minimal ABI encoding for getDomainInfo(string) and tokenIdOf(string)
// getDomainInfo(string) selector: 0x0fd468f0
// tokenIdOf(string) selector: 0x10f4732e
async function callXWD(domainName) {
  // Correct function selectors (computed via keccak256)
  // getOwner(string) = 0xd83aec1c
  // getTokenId(string) = 0xbdeb60db

  const domainBytes = Buffer.from(domainName);
  const offset = '0000000000000000000000000000000000000000000000000000000000000020';
  const length = domainBytes.length.toString(16).padStart(64, '0');
  const dataHex = domainBytes.toString('hex');
  const paddedData = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, '0');
  const encodedString = offset + length + paddedData;

  try {
    // Call getOwner(string)
    const data1 = '0xd83aec1c' + encodedString;
    const r1 = await fetch(XDC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: XWD_CONTRACT, data: data1 }, 'latest'], id: 1 })
    });
    const j1 = await r1.json();
    if (j1.error || !j1.result || j1.result === '0x' || j1.result.length < 66) return null;

    const owner = '0x' + j1.result.slice(26, 66).toLowerCase();
    if (owner === '0x' + '0'.repeat(40)) return null;

    // Call getTokenId(string)
    const data2 = '0xbdeb60db' + encodedString;
    let tokenId = null;
    try {
      const r2 = await fetch(XDC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: XWD_CONTRACT, data: data2 }, 'latest'], id: 2 })
      });
      const j2 = await r2.json();
      if (!j2.error && j2.result && j2.result !== '0x' && j2.result !== '0x' + '0'.repeat(64)) {
        tokenId = parseInt(j2.result, 16).toString();
      }
    } catch {}

    return { owner, tokenId };
  } catch (e) {
    console.error('[XWD-RPC] Error:', e.message);
    return null;
  }
}
// Deterministic seed from domain data
function generateDomainSeed(domainData) {
  const { owner, tokenId, domainName } = domainData;
  // Simple hash: keccak256-like using available tools
  const data = owner.toLowerCase() + (tokenId || '0') + domainName;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Expand to 48 bytes for seed
  const seed = Buffer.alloc(48);
  for (let i = 0; i < 48; i++) {
    seed[i] = (hash >> (i % 4) * 8) & 0xff;
    if (seed[i] === 0) seed[i] = i + 1; // Avoid all-zero seed
  }
  return seed;
}

// Derive PQC keys from domain seed (async — uses dynamic imports)
async function deriveDomainKeys(seed, algorithm) {
  const seedBuf = Buffer.from(seed);
  switch (algorithm) {
    case 'falcon': {
      // FALCON needs 48-byte seed — use seed directly
      const keys = (await import('@noble/post-quantum/falcon.js')).falcon512.keygen(seedBuf);
      return { publicKey: keys.publicKey, secretKey: keys.secretKey };
    }
    case 'ml-dsa': {
      // ML-DSA needs 32-byte seed
      const s32 = Buffer.alloc(32); seedBuf.copy(s32, 0, 0, 32);
      const keys = (await import('@noble/post-quantum/ml-dsa.js')).ml_dsa65.keygen(s32);
      return { publicKey: keys.publicKey, secretKey: keys.secretKey };
    }
    case 'slh-dsa': {
      // SLH-DSA needs 48-byte seed — use different offset
      const s48 = Buffer.alloc(48);
      for (let i = 0; i < 48; i++) s48[i] = seedBuf[i % seedBuf.length] ^ (i * 7 + 13);
      const keys = (await import('@noble/post-quantum/slh-dsa.js')).slh_dsa_sha2_128s.keygen(s48);
      return { publicKey: keys.publicKey, secretKey: keys.secretKey };
    }
    case 'ml-kem': {
      // ML-KEM needs 64-byte seed
      const s64 = Buffer.alloc(64);
      for (let i = 0; i < 64; i++) s64[i] = seedBuf[i % seedBuf.length] ^ (i * 3 + 7);
      const keys = (await import('@noble/post-quantum/ml-kem.js')).ml_kem512.keygen(s64);
      return { publicKey: keys.publicKey, secretKey: keys.secretKey };
    }
    default: return null;
  }
}

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

                    // Read domain data from XWD contract via RPC
                    const domainData = await callXWD(domain);
                    if (!domainData) return res.status(400).json({ error: `Domain ${domain} not found in XWD contract` });

                    // Generate deterministic seed
                    const seed = generateDomainSeed(domainData);

                    if (action === 'domain-info') {
                        // Return public keys only
                        const publicKeys = {};
                        for (const algo of ['falcon', 'ml-dsa', 'slh-dsa', 'ml-kem']) {
                            try {
                                const keys = await deriveDomainKeys(seed, algo);
                                if (keys) publicKeys[algo] = { publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'), publicKeyBytes: keys.publicKey.length };
                            } catch (e) { console.error(`[DOMAIN-INFO] ${algo} error:`, e.message); }
                        }
                        return res.status(200).json({ success: true, domain, owner: domainData.owner, tokenId: domainData.tokenId, publicKeys });
                    }

                    if (action === 'domain-sign') {
                        const { txHash, algorithms } = params;
                        if (!txHash) return res.status(400).json({ error: 'txHash required' });
                        const algos = algorithms || ['falcon'];
                        const msgBytes = Buffer.from(txHash.startsWith('0x') ? txHash.slice(2) : txHash, 'hex');
                        const signatures = {};

                        for (const algo of algos) {
                            try {
                                const keys = await deriveDomainKeys(seed, algo);
                                if (!keys) continue;
                                const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');

                                if (algo === 'falcon') {
                                    const sig = falcon512.sign(msgBytes, keys.secretKey);
                                    signatures.falcon = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'falcon', variant: 'falcon512', standard: 'NIST FIPS 206', nistLevel: 1, publicKey: pkHex };
                                } else if (algo === 'ml-dsa') {
                                    const sig = ml_dsa65.sign(msgBytes, keys.secretKey);
                                    signatures.mldsa = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'ml-dsa', variant: 'ml_dsa65', standard: 'NIST FIPS 204', nistLevel: 3, publicKey: pkHex };
                                } else if (algo === 'slh-dsa') {
                                    const sig = slh_dsa_sha2_128s.sign(msgBytes, keys.secretKey);
                                    signatures.slhdsa = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'slh-dsa', variant: 'slh_dsa_sha2_128s', standard: 'NIST FIPS 205', nistLevel: 1, publicKey: pkHex };
                                } else if (algo === 'ml-kem') {
                                    const enc = ml_kem512.encapsulate(keys.publicKey);
                                    signatures.mlkem = { ciphertext: '0x' + Buffer.from(enc.cipherText).toString('hex'), sharedSecret: '0x' + Buffer.from(enc.sharedSecret).toString('hex'), algorithm: 'ml-kem', variant: 'ml_kem512', standard: 'NIST FIPS 203', nistLevel: 1, publicKey: pkHex };
                                }
                            } catch (e) { console.error(`[DOMAIN-SIGN] ${algo} error:`, e.message); }
                        }

                        if (Object.keys(signatures).length === 0) {
                            return res.status(500).json({ error: 'All PQC signing attempts failed' });
                        }
                        return res.status(200).json({ success: true, domain, owner: domainData.owner, tokenId: domainData.tokenId, signatures });
                    }

                    if (action === 'domain-verify') {
                        const { message, algorithm, signature, publicKey } = params;
                        if (!message || !algorithm || !signature || !publicKey) {
                            return res.status(400).json({ error: 'message, algorithm, signature, publicKey required' });
                        }
                        const keys = await deriveDomainKeys(seed, algorithm);
                        if (!keys) return res.status(400).json({ error: `Unsupported algorithm: ${algorithm}` });
                        const msgBytes = Buffer.from(message.startsWith('0x') ? message.slice(2) : message, 'hex');
                        const sigBytes = Buffer.from(signature.startsWith('0x') ? signature.slice(2) : signature, 'hex');
                        const pkBytes = Buffer.from(publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey, 'hex');
                        let valid = false;
                        try {
                            if (algorithm === 'falcon') valid = falcon512.verify(sigBytes, msgBytes, pkBytes);
                            else if (algorithm === 'ml-dsa') valid = ml_dsa65.verify(sigBytes, msgBytes, pkBytes);
                            else if (algorithm === 'slh-dsa') valid = slh_dsa_sha2_128s.verify(sigBytes, msgBytes, pkBytes);
                        } catch (e) { return res.status(200).json({ valid: false, error: e.message }); }
                        return res.status(200).json({ valid, algorithm, domain, owner: domainData.owner });
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
