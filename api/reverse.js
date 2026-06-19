// api/reverse.js
// ============================================================
// FLEURS DE LYS — Reverse Resolution (adresse → domaine)
// ============================================================
// Recherche une adresse sur toutes les chaines actives
// et retourne le/les domaine(s) associé(s)
// ============================================================

import { ethers } from 'ethers';

const cache = new Map();
const CACHE_TTL = 3600000;

function getCached(addr) {
    const c = cache.get(addr);
    if (c && (Date.now() - c.ts) < CACHE_TTL) return c.result;
    return null;
}
function setCache(addr, result) {
    cache.set(addr, { result, ts: Date.now() });
}

// ============================================================
// REVERSE: XDC → Domaine
// ============================================================
async function reverseXDC(address) {
    const CONTRACT_ADDRESS = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';
    const ABI = [
        'function getOwnerByAddress(address owner) view returns (string[])',
        'function getDomains(address owner) view returns (string[])'
    ];
    const rpcList = [
        'https://rpc.xdcrpc.com',
        'https://rpc.xdc.org',
        'https://erpc.xdc.org'
    ];
    for (const rpcUrl of rpcList) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
            // Try getDomains first (if available)
            try {
                const domains = await contract.getDomains(address);
                if (domains && domains.length > 0) {
                    return { domains, source: 'XDC/XWD', chain: 'XDC' };
                }
            } catch {}
            // Try getOwnerByAddress
            try {
                const domains = await contract.getOwnerByAddress(address);
                if (domains && domains.length > 0) {
                    return { domains, source: 'XDC/XWD', chain: 'XDC' };
                }
            } catch {}
        } catch { continue; }
    }
    return null;
}

// ============================================================
// REVERSE: ENS → Domaine
// ============================================================
async function reverseENS(address) {
    try {
        const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
        const domain = await provider.lookupAddress(address);
        if (domain) return { domain, source: 'ENS', chain: 'ETH' };
    } catch {}
    // Fallback: ENS Ideas API
    try {
        const r = await fetch(`https://api.ensideas.com/ens/reverse/${address}`);
        if (r.ok) {
            const data = await r.json();
            if (data?.name) return { domain: data.name, source: 'ENS/ideas', chain: 'ETH' };
        }
    } catch {}
    return null;
}

// ============================================================
// REVERSE: XRPL → Domaine (via account_info Domain field)
// ============================================================
async function reverseXRP(address) {
    const rpcList = [
        'https://ripple-mainnet.gateway.tatum.io/',
        'https://xrplcluster.com',
    ];
    for (const rpcUrl of rpcList) {
        try {
            const r = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "account_info",
                    params: [{
                        account: address,
                        ledger_index: "validated",
                        strict: true
                    }],
                    id: 1
                })
            });
            const j = await r.json();
            const accountData = j?.result?.account_data;
            if (accountData?.Domain) {
                // Domain is stored as hex string
                const domain = Buffer.from(accountData.Domain, 'hex').toString('ascii');
                return { domain, source: 'XRPL', chain: 'XRP' };
            }
        } catch { continue; }
    }
    return null;
}

// ============================================================
// REVERSE: Stellar → Domaine (via home_domain field)
// ============================================================
async function reverseXLM(address) {
    try {
        const r = await fetch(`https://horizon.stellar.org/accounts/${address}`);
        if (r.ok) {
            const data = await r.json();
            if (data?.home_domain) {
                return { domain: `${data.home_domain}.xlm`, source: 'Horizon', chain: 'XLM' };
            }
        }
    } catch {}
    // Fallback: StellarExpert
    try {
        const r = await fetch(`https://api.stellar.expert/explorer/directory/${address}`);
        if (r.ok) {
            const data = await r.json();
            if (data?.domain) {
                return { domain: data.domain, source: 'StellarExpert', chain: 'XLM' };
            }
        }
    } catch {}
    return null;
}

// ============================================================
// REVERSE: Hedera → Domaine
// ============================================================
async function reverseHBAR(address) {
    try {
        const data = await fetchJSON(`https://api.hbar.domains/v1/address/${address}`);
        if (data?.domain) {
            return { domain: data.domain, source: 'HNS', chain: 'HBAR' };
        }
    } catch {}
    return null;
}

// ============================================================
// REVERSE: Solana → Domaine (via Bonfida reverse)
// ============================================================
async function reverseSOL(address) {
    try {
        const data = await fetchJSON(`https://sns-api.bonfida.com/address/${address}`);
        if (data?.domain) {
            return { domain: `${data.domain}.sol`, source: 'Bonfida/SNS', chain: 'SOL' };
        }
    } catch {}
    return null;
}

// ============================================================
// REVERSE: NEAR → Domaine
// ============================================================
async function reverseNEAR(address) {
    try {
        const data = await fetchJSON(`https://api.near.social/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: [`${address}.near`] })
        });
        if (data?.[address]?.owner) {
            return { domain: `${address}.near`, source: 'NEAR', chain: 'NEAR' };
        }
    } catch {}
    return null;
}

// ============================================================
// REVERSE: TON → Domaine
// ============================================================
async function reverseTON(address) {
    try {
        const data = await fetchJSON(`https://tonapi.io/v2/accounts/${address}/dns`);
        if (data?.domain) {
            return { domain: data.domain, source: 'TON API', chain: 'TON' };
        }
    } catch {}
    return null;
}

// ============================================================
// REVERSE: Cosmos/Polkadot/etc → Domaine
// ============================================================
async function reverseCosmos(address, chain) {
    // Cosmos ecosystem reverse lookup via ICNS
    try {
        const data = await fetchJSON(`https://api.icns.cosmos.network/reverse/${address}`);
        if (data?.domain) {
            return { domain: data.domain, source: 'ICNS', chain };
        }
    } catch {}
    return null;
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'Adresse manquante' });

    const addrLower = address.toLowerCase();

    // Check cache
    const cacheKey = `reverse:${addrLower}`;
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json({ ...cached, cached: true });

    // Detect address type and try appropriate reverse
    const results = [];

    // Ethereum address (0x...)
    if (addrLower.startsWith('0x') && addrLower.length === 42) {
        const ensResult = await reverseENS(addrLower);
        if (ensResult) results.push(ensResult);

        const xdcResult = await reverseXDC(addrLower);
        if (xdcResult) results.push(xdcResult);
    }

    // XRP address (r...)
    if (addrLower.startsWith('r') && addrLower.length >= 25) {
        const xrpResult = await reverseXRP(addrLower);
        if (xrpResult) results.push(xrpResult);
    }

    // Stellar address (G...)
    if (addrLower.startsWith('G') && addrLower.length >= 56) {
        const xlmResult = await reverseXLM(addrLower);
        if (xlmResult) results.push(xlmResult);
    }

    // Hedera address (0.0.xxx)
    if (addrLower.match(/^0\.0\.\d+$/)) {
        const hbarResult = await reverseHBAR(addrLower);
        if (hbarResult) results.push(hbarResult);
    }

    // Solana address (base58, long)
    if (addrLower.length >= 32 && addrLower.length <= 44 && !addrLower.startsWith('0x') && !addrLower.startsWith('r') && !addrLower.startsWith('G')) {
        const solResult = await reverseSOL(addrLower);
        if (solResult) results.push(solResult);
    }

    // NEAR address
    if (addrLower.endsWith('.near') || (addrLower.length >= 2 && addrLower.length <= 64)) {
        const nearResult = await reverseNEAR(addrLower);
        if (nearResult) results.push(nearResult);
    }

    // TON address
    if (addrLower.length >= 40) {
        const tonResult = await reverseTON(addrLower);
        if (tonResult) results.push(tonResult);
    }

    if (results.length > 0) {
        setCache(cacheKey, results);
        return res.status(200).json({ address, results });
    }

    return res.status(404).json({
        error: `Aucun domaine trouvé pour l'adresse ${address}.`,
        hint: 'La reverse resolution ne fonctionne que pour les adresses avec un domaine associé.'
    });
}

async function fetchJSON(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const r = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeout);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
    } catch (e) {
        clearTimeout(timeout);
        throw e;
    }
}
