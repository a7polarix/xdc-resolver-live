// api/pqc.cjs — CommonJS for Vercel Serverless
const {
    generateFalconKeys, signMessage, verifySignature,
    generateDilithiumKeys, signMessageDilithium, verifySignatureDilithium,
    hybridSign, getFalconInfo, generatePQCKeys, signPQC, verifyPQC,
    MASTER_PK, MASTER_SK
} = require('./falcon.js');

const { falcon512 } = require('@noble/post-quantum/falcon.js');
const { ml_dsa65 } = require('@noble/post-quantum/ml-dsa.js');
const { slh_dsa_sha2_128s } = require('@noble/post-quantum/slh-dsa.js');
const { ml_kem512 } = require('@noble/post-quantum/ml-kem.js');
const { ethers } = require('ethers');

const XDC_RPC = 'https://rpc.xdcrpc.com';
const XWD_CONTRACT = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';
const XWD_ABI = [
    'function getOwner(string) view returns (address)',
    'function getTokenId(string) view returns (uint256)'
];

let contract = null;
function getContract() {
    if (!contract) {
        const provider = new ethers.JsonRpcProvider(XDC_RPC);
        contract = new ethers.Contract(XWD_CONTRACT, XWD_ABI, provider);
    }
    return contract;
}

async function callXWD(domainName) {
    try {
        const c = getContract();
        const owner = await c.getOwner(domainName);
        if (!owner || owner === ethers.ZeroAddress) return null;
        let tokenId = null;
        try {
            const tid = await c.getTokenId(domainName);
            if (tid) tokenId = tid.toString();
        } catch {}
        return { owner: owner.toLowerCase(), tokenId };
    } catch (e) {
        console.error('[XWD] Error:', e.message);
        return null;
    }
}

function generateDomainSeed(d) {
    const data = d.owner + (d.tokenId || '0') + d.domainName;
    const buf = Buffer.from(data, 'utf8');
    const hash = Buffer.alloc(32);
    for (let i = 0; i < buf.length; i++) hash[i % 32] ^= buf[i];
    const seed = Buffer.alloc(48);
    for (let i = 0; i < 48; i++) seed[i] = hash[i % 32] ^ (i * 17 + 31);
    return seed;
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-PQC-Layer', 'FALCON/ML-DSA');

    const action = req.query.action || req.body.action;
    const method = req.method;
    const params = method === 'POST' ? (req.body || {}) : (req.query || {});
    const algos = ['falcon', 'ml-dsa', 'ml_kem'];

    try {
        // Legacy actions (keys, sign, verify, hybrid, quantum)
        if (['keys', 'sign', 'verify', 'hybrid', 'quantum', 'info'].includes(action)) {
            // Delegate to existing falcon.js functions
            if (action === 'info') {
                return res.status(200).json(getFalconInfo());
            }
            // For other legacy actions, return basic info
            return res.status(200).json({ success: true, message: 'Legacy action - use domain-sign for PQC', action });
        }

        // Domain-based PQC signing
        if (action === 'domain-sign') {
            const { domain, txHash, algorithms } = params;
            if (!domain) return res.status(400).json({ error: 'domain required' });
            if (!txHash) return res.status(400).json({ error: 'txHash required' });

            // Read domain data from XWD contract
            const domainData = await callXWD(domain);
            if (!domainData) return res.status(400).json({ error: 'Domain not found in XWD contract' });

            // Generate deterministic seed
            const seed = generateDomainSeed({ ...domainData, domainName: domain });

            // Sign with each requested algorithm
            const algosToSign = algorithms || ['falcon'];
            const msgBytes = Buffer.from(txHash.startsWith('0x') ? txHash.slice(2) : txHash, 'hex');
            const signatures = {};

            for (const algo of algosToSign) {
                try {
                    let keys;
                    if (algo === 'falcon') {
                        keys = falcon512.keygen(seed);
                        const sig = falcon512.sign(msgBytes, keys.secretKey);
                        const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');
                        signatures.falcon = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'falcon', variant: 'falcon512', standard: 'NIST FIPS 206', nistLevel: 1, publicKey: pkHex };
                    } else if (algo === 'ml-dsa') {
                        const s32 = Buffer.alloc(32); seed.copy(s32, 0, 0, 32);
                        keys = ml_dsa65.keygen(s32);
                        const sig = ml_dsa65.sign(msgBytes, keys.secretKey);
                        const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');
                        signatures.mldsa = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'ml-dsa', variant: 'ml_dsa65', standard: 'NIST FIPS 204', nistLevel: 3, publicKey: pkHex };
                    }
                    // SLH-DSA and ML-KEM are optional (may be slow/large)
                } catch (e) { console.error(`[PQC] ${algo} error:`, e.message); }
            }

            if (Object.keys(signatures).length === 0) {
                return res.status(500).json({ error: 'All PQC signing attempts failed' });
            }

            return res.status(200).json({
                success: true,
                domain,
                owner: domainData.owner,
                tokenId: domainData.tokenId,
                signatures
            });
        }

        return res.status(400).json({ error: 'Unknown action', supported: ['domain-sign', 'info'] });
    } catch (err) {
        console.error('[PQC] Error:', err.message, err.stack);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = handler;
