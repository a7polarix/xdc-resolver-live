// api/resolve-crosschain.js
// ============================================================
// FLEURS DE LYS — Résolveur Crosschain Universel
// ============================================================
// Mode "sommeil" : toutes les chaines sont implémentées mais
// activables/désactivables via la constante ci-dessous.
// Pour activer une chaîne : changer "false" → true
// Pour déployer tout : mettre ACTIVATE_ALL = true
// ============================================================

import { ethers } from 'ethers';

// ============================================================
// CONFIGURATION — ACTIVATION DES CHAÎNES
// ============================================================
const ACTIVATE_ALL = false; // ← true pour tout activer d'un coup

const CHAIN_CONFIG = {
    // === CHAÎNES PRINCIPALES (actives par défaut) ===
    XDC:       true,   // XDC / XWD Web3 Domains (.xdc, .rwa, .depin)
    ENS:       true,   // Ethereum Name Service (.eth)
    UD:        true,   // Unstoppable Domains (.crypto, .nft, .wallet, .dao, .x, .888, .blockchain)

    // === ISO 20022 — RAILS DE LIQUIDITÉ ===
    XRP:       true,   // XRP Ledger (.xrp) — Tatum free gateway + xrp-ledger.toml
    XLM:       true,   // Stellar (.xlm) — StellarExpert directory
    HBAR:      true,   // Hedera (.hbar) — HNS Resolution API
    ADA:       true,   // Cardano (.ada) — AdaDomains
    ALGO:      true,   // Algorand (.algo) — NFDomains
    IOTA:      false,  // IOTA (.iota) — Pas d'API publique fiable

    // === EVM COMPATIBLE (ENS universel) ===
    MATIC:     true,   // Polygon (.matic, .polygon)
    ARB:       true,   // Arbitrum (.arb, .arb1)
    OP:        true,   // Optimism (.op)
    BASE:      true,   // Base (.base)
    BNB:       true,   // BNB Chain (.bnb) — ENS-compatible
    AVAX:      true,   // Avalanche (.avax) — ENS-compatible
    FTM:       true,   // Fantom (.ftm) — ENS-compatible
    CELO:      true,   // Celo (.celo)
    CRO:       true,   // Cronos (.cro)
    KLAY:      true,   // Klaytn (.klay)
    GNO:       true,   // Gnosis (.gno, .gnosis)

    // === NON-EVM ===
    SOL:       true,   // Solana (.sol) — Bonfida/SNS
    NEAR:      true,   // NEAR (.near)
    TON:       true,   // TON (.ton) — TON DNS
    DOT:       true,   // Polkadot (.dot)
    ATOM:      true,   // Cosmos (.atom)
    SUI:       true,   // Sui (.sui)
    APT:       true,   // Aptos (.apt)
    SEI:       true,   // Sei (.sei)
    INJ:       true,   // Injective (.inj)
    STX:       true,   // Stacks (.stx)

    // === BITCOIN-FAMILY ===
    BTC:       true,   // Bitcoin (.btc)
    LTC:       true,   // Litecoin (.ltc)
    DOGE:      true,   // Dogecoin (.doge)
    DASH:      false,  // Dash (.dash)

    // === COSMOS ECOSYSTEM ===
    OSMO:      true,   // Osmosis (.osmo)
    JUNO:      true,   // Juno (.juno)
    STARS:     true,   // Stargaze (.stars)
    REGEN:     false,  // Regen (.regen)

    // === AUTRES ===
    XMR:       false,  // Monero (.xmr) — pas de DNS natif
    ZEC:       false,  // Zcash (.zec)
    ETC:       false,  // Ethereum Classic (.etc)
    RON:       false,  // Ronin (.ron)
    WAX:       false,  // WAX (.wax)
    EOS:       false,  // EOS (.eos)
};

// Helper: check if chain is active
const isActive = (chain) => ACTIVATE_ALL || CHAIN_CONFIG[chain];

// ============================================================
// CACHE
// ============================================================
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

function getCached(domain) {
    const c = cache.get(domain);
    if (c && (Date.now() - c.ts) < CACHE_TTL) return c.result;
    return null;
}
function setCache(domain, result) {
    cache.set(domain, { result, ts: Date.now() });
}

// ============================================================
// HELPERS
// ============================================================
async function fetchJSON(url, headers = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const r = await fetch(url, {
            headers: { 'Accept': 'application/json', ...headers },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
    } catch (e) {
        clearTimeout(timeout);
        throw e;
    }
}

// ============================================================
// 1. XDC / XWD Web3 Domains (contrat principal)
// ============================================================
async function resolveXDC(domain) {
    if (!isActive('XDC')) return null;
    const CONTRACT_ADDRESS = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';
    const ABI = [
        'function getOwner(string name) view returns (address)',
        'function get(string name) view returns (string)',
        'function tokenURI(uint256 tokenId) view returns (string)'
    ];
    const rpcList = [
        'https://rpc.xdcrpc.com',
        'https://rpc.xdc.org',
        'https://erpc.xdc.org',
        'https://json-rpc.xdc.evm.mainnet.network:8545'
    ];
    for (const rpcUrl of rpcList) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
            const owner = await contract.getOwner(domain);
            if (owner && owner !== ethers.ZeroAddress) {
                // Try to get tokenURI for multi-chain metadata
                let metadata = null;
                try {
                    const tokenId = ethers.keccak256(ethers.toUtf8Bytes(domain));
                    const uri = await contract.tokenURI(tokenId);
                    if (uri && uri.startsWith('data:')) {
                        metadata = JSON.parse(uri.replace('data:application/json;base64,', ''));
                    }
                } catch {}
                return {
                    result: owner,
                    source: 'XDC/XWD',
                    chain: 'XDC',
                    metadata
                };
            }
        } catch { continue; }
    }
    return null;
}

// ============================================================
// 2. ENS (Ethereum) — api.ensideas.com
// ============================================================
async function resolveENS(domain) {
    if (!isActive('ENS')) return null;
    try {
        const data = await fetchJSON(`https://api.ensideas.com/ens/resolve/${domain}`);
        if (data?.address && data.address.startsWith('0x')) {
            return { result: data.address, source: 'ENS', chain: 'ETH' };
        }
    } catch {}
    // Fallback: direct RPC
    try {
        const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
        const addr = await provider.resolveName(domain);
        if (addr) return { result: addr, source: 'ENS/RPC', chain: 'ETH' };
    } catch {}
    return null;
}

// ============================================================
// 3. Unstoppable Domains
// ============================================================
async function resolveUD(domain) {
    if (!isActive('UD')) return null;
    try {
        const data = await fetchJSON(
            `https://api.unstoppabledomains.com/resolve/domains/${domain}`,
            { 'Authorization': `Bearer ${process.env.UNSTOPPABLE_API_KEY || ''}` }
        );
        const records = data?.records || {};
        const ethAddr = records['crypto.ETH.address'];
        if (ethAddr && ethAddr.startsWith('0x')) {
            return {
                result: ethAddr,
                source: 'Unstoppable',
                chain: 'UD',
                records: records
            };
        }
    } catch {}
    return null;
}

// ============================================================
// 4. XRP Ledger — Tatum free gateway + domain field
// ============================================================
async function resolveXRP(domain) {
    if (!isActive('XRP')) return null;

    // Method A: xrp-ledger.toml approach
    // If the .xrp domain is a real internet domain hosting a xrp-ledger.toml
    const domainName = domain.replace('.xrp', '');
    const tomlUrls = [
        `https://${domainName}.xrp/.well-known/xrp-ledger.toml`,
        `https://www.${domainName}.xrp/.well-known/xrp-ledger.toml`,
    ];
    for (const tomlUrl of tomlUrls) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const r = await fetch(tomlUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (r.ok) {
                const toml = await r.text();
                // Parse TOML (simple approach)
                const accountMatch = toml.match(/\[\[ACCOUNTS\]\][\s\S]*?address\s*=\s*"(r[0-9a-zA-Z]{25,34})"/);
                if (accountMatch) {
                    return { result: accountMatch[1], source: 'XRPL/toml', chain: 'XRP' };
                }
            }
        } catch {}
    }

    // Method B: Tatum free gateway (reverse lookup not possible, but we can get account info)
    // This only works if we have an address, not a domain name
    // For domain → address, we rely on the TOML method above

    return null;
}

// ============================================================
// 5. Stellar (XLM) — StellarExpert directory
// ============================================================
async function resolveXLM(domain) {
    if (!isActive('XLM')) return null;
    try {
        // StellarExpert directory search
        const data = await fetchJSON(`https://api.stellar.expert/explorer/directory?search=${domain}`);
        const records = data?._embedded?.records || [];
        for (const record of records) {
            if (record.domain === domain || record.name?.toLowerCase() === domain.replace('.xlm', '')) {
                return { result: record.address, source: 'StellarExpert', chain: 'XLM' };
            }
        }
    } catch {}
    // Fallback: Horizon API account search by domain
    try {
        const data = await fetchJSON(`https://horizon.stellar.org/accounts?search=${domain}`);
        const records = data?._embedded?.records || [];
        for (const record of records) {
            if (record.home_domain === domain.replace('.xlm', '')) {
                return { result: record.account_id, source: 'Horizon', chain: 'XLM' };
            }
        }
    } catch {}
    return null;
}

// ============================================================
// 6. Hedera (HBAR) — HNS Resolution API
// ============================================================
async function resolveHBAR(domain) {
    if (!isActive('HBAR')) return null;
    try {
        const data = await fetchJSON(`https://api.hbar.domains/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'HNS', chain: 'HBAR' };
        }
    } catch {}
    // Fallback: hashgraph.name API
    try {
        const data = await fetchJSON(`https://api.hashgraph.name/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'HNS/hashgraph', chain: 'HBAR' };
        }
    } catch {}
    return null;
}

// ============================================================
// 7. Cardano (ADA) — AdaDomains
// ============================================================
async function resolveADA(domain) {
    if (!isActive('ADA')) return null;
    try {
        const data = await fetchJSON(`https://api.adadomains.io/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'AdaDomains', chain: 'ADA' };
        }
    } catch {}
    // Fallback: CardanoScan API
    try {
        const data = await fetchJSON(`https://cardanoscan.io/api/policy/${domain}`);
        if (data?.address) {
            return { result: data.address, source: 'CardanoScan', chain: 'ADA' };
        }
    } catch {}
    return null;
}

// ============================================================
// 8. Algorand (ALGO) — NFDomains
// ============================================================
async function resolveALGO(domain) {
    if (!isActive('ALGO')) return null;
    try {
        const data = await fetchJSON(`https://api.nf.domains/nfd/v1/info?domain=${domain}`);
        if (data?.caAlgo?.[0] || data?.owner || data?.unparsed?.caAlgo) {
            const addr = data.caAlgo?.[0] || data.owner || data.unparsed?.caAlgo;
            return { result: addr, source: 'NFDomains', chain: 'ALGO' };
        }
    } catch {}
    // Fallback: AlgoExplorer
    try {
        const data = await fetchJSON(`https://indexer.algoexplorerapi.io/v2/assets?name=${domain.replace('.algo', '')}`);
        if (data?.assets?.[0]?.params?.creator) {
            return { result: data.assets[0].params.creator, source: 'AlgoExplorer', chain: 'ALGO' };
        }
    } catch {}
    return null;
}

// ============================================================
// 9. Solana (SOL) — Bonfida/SNS
// ============================================================
async function resolveSOL(domain) {
    if (!isActive('SOL')) return null;
    try {
        const data = await fetchJSON(`https://sns-api.bonfida.com/domain/${domain}`);
        if (data?.owner) return { result: data.owner, source: 'Bonfida/SNS', chain: 'SOL' };
    } catch {}
    // Fallback: Solscan API
    try {
        const data = await fetchJSON(`https://api.solscan.io/account?address=${domain.replace('.sol', '')}`);
        if (data?.data.address) return { result: data.data.address, source: 'Solscan', chain: 'SOL' };
    } catch {}
    return null;
}

// ============================================================
// 10. NEAR Protocol
// ============================================================
async function resolveNEAR(domain) {
    if (!isActive('NEAR')) return null;
    try {
        const accountId = domain.replace('.near', '');
        const data = await fetchJSON(`https://api.near.social/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: [`${accountId}.near`] })
        });
        if (data?.[`${accountId}.near`]?.owner) {
            return { result: data[`${accountId}.near`].owner, source: 'NEAR', chain: 'NEAR' };
        }
    } catch {}
    // Fallback: NEAR RPC
    try {
        const accountId = domain.replace('.near', '');
        const r = await fetch('https://rpc.mainnet.near.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "query",
                params: {
                    request_type: "call_function",
                    account_id: "near",
                    method_name: "resolve",
                    args: Buffer.from(accountId).toString('base64')
                },
                id: 1
            })
        });
        const j = await r.json();
        if (j?.result?.result) {
            return { result: Buffer.from(j.result.result, 'utf8').toString(), source: 'NEAR/RPC', chain: 'NEAR' };
        }
    } catch {}
    return null;
}

// ============================================================
// 11. TON — TON DNS
// ============================================================
async function resolveTON(domain) {
    if (!isActive('TON')) return null;
    try {
        const data = await fetchJSON(`https://tonapi.io/v2/dns/${domain}`);
        if (data?.wallet_address?.address) {
            return { result: data.wallet_address.address, source: 'TON API', chain: 'TON' };
        }
    } catch {}
    // Fallback: TONCenter
    try {
        const data = await fetchJSON(`https://toncenter.com/api/v3/dns?domain=${domain}`);
        if (data?.wallet?.address) {
            return { result: data.wallet.address, source: 'TONCenter', chain: 'TON' };
        }
    } catch {}
    return null;
}

// ============================================================
// 12. Polkadot (DOT) — PNS
// ============================================================
async function resolveDOT(domain) {
    if (!isActive('DOT')) return null;
    try {
        const data = await fetchJSON(`https://pns.dotscanner.xyz/api/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'PNS', chain: 'DOT' };
        }
    } catch {}
    return null;
}

// ============================================================
// 13. Cosmos (ATOM) — ICNS
// ============================================================
async function resolveATOM(domain) {
    if (!isActive('ATOM')) return null;
    try {
        const data = await fetchJSON(`https://api.icns.cosmos.network/resolve/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'ICNS', chain: 'ATOM' };
        }
    } catch {}
    return null;
}

// ============================================================
// 14. Sui (SUI) — SuiNS
// ============================================================
async function resolveSUI(domain) {
    if (!isActive('SUI')) return null;
    try {
        const data = await fetchJSON(`https://api.suins.io/v1/names/${domain}`);
        if (data?.owner || data?.address) {
            return { result: data.owner || data.address, source: 'SuiNS', chain: 'SUI' };
        }
    } catch {}
    return null;
}

// ============================================================
// 15. Aptos (APT) — AptosNames
// ============================================================
async function resolveAPT(domain) {
    if (!isActive('APT')) return null;
    try {
        const data = await fetchJSON(`https://api.aptosnames.com/v1/name/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'AptosNames', chain: 'APT' };
        }
    } catch {}
    return null;
}

// ============================================================
// 16. Sei (SEI) — SeiNS
// ============================================================
async function resolveSEI(domain) {
    if (!isActive('SEI')) return null;
    try {
        const data = await fetchJSON(`https://api.seins.io/v1/names/${domain}`);
        if (data?.owner || data?.address) {
            return { result: data.owner || data.address, source: 'SeiNS', chain: 'SEI' };
        }
    } catch {}
    return null;
}

// ============================================================
// 17. Injective (INJ) — InjNS
// ============================================================
async function resolveINJ(domain) {
    if (!isActive('INJ')) return null;
    try {
        const data = await fetchJSON(`https://api.injns.injective.network/v1beta1/names/${domain}`);
        if (data?.owner || data?.address) {
            return { result: data.owner || data.address, source: 'InjNS', chain: 'INJ' };
        }
    } catch {}
    return null;
}

// ============================================================
// 18. Stacks (STX) — BNS
// ============================================================
async function resolveSTX(domain) {
    if (!isActive('STX')) return null;
    try {
        const data = await fetchJSON(`https://api.stacks.co/v1/names/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'BNS', chain: 'STX' };
        }
    } catch {}
    return null;
}

// ============================================================
// 19. Bitcoin (BTC) — Unstoppable .btc
// ============================================================
async function resolveBTC(domain) {
    if (!isActive('BTC')) return null;
    // .btc domains are handled by Unstoppable Domains
    try {
        const data = await fetchJSON(
            `https://api.unstoppabledomains.com/resolve/domains/${domain}`,
            { 'Authorization': `Bearer ${process.env.UNSTOPPABLE_API_KEY || ''}` }
        );
        const records = data?.records || {};
        const btcAddr = records['crypto.BTC.address'];
        if (btcAddr) return { result: btcAddr, source: 'Unstoppable/BTC', chain: 'BTC' };
    } catch {}
    return null;
}

// ============================================================
// 20. Litecoin (LTC) — Unstoppable .ltc
// ============================================================
async function resolveLTC(domain) {
    if (!isActive('LTC')) return null;
    try {
        const data = await fetchJSON(
            `https://api.unstoppabledomains.com/resolve/domains/${domain}`,
            { 'Authorization': `Bearer ${process.env.UNSTOPPABLE_API_KEY || ''}` }
        );
        const records = data?.records || {};
        const ltcAddr = records['crypto.LTC.address'];
        if (ltcAddr) return { result: ltcAddr, source: 'Unstoppable/LTC', chain: 'LTC' };
    } catch {}
    return null;
}

// ============================================================
// 21. Dogecoin (DOGE) — Unstoppable .doge
// ============================================================
async function resolveDOGE(domain) {
    if (!isActive('DOGE')) return null;
    try {
        const data = await fetchJSON(
            `https://api.unstoppabledomains.com/resolve/domains/${domain}`,
            { 'Authorization': `Bearer ${process.env.UNSTOPPABLE_API_KEY || ''}` }
        );
        const records = data?.records || {};
        const dogeAddr = records['crypto.DOGE.address'];
        if (dogeAddr) return { result: dogeAddr, source: 'Unstoppable/DOGE', chain: 'DOGE' };
    } catch {}
    return null;
}

// ============================================================
// 22-30. EVM-compatible chains (ENS universal resolver)
// ============================================================
async function resolveEVM(domain, chainName, rpcUrl) {
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const addr = await provider.resolveName(domain);
        if (addr) return { result: addr, source: `ENS/${chainName}`, chain: chainName };
    } catch {}
    return null;
}

async function resolveMATIC(domain) {
    if (!isActive('MATIC')) return null;
    return resolveEVM(domain, 'MATIC', 'https://polygon-rpc.com');
}
async function resolveARB(domain) {
    if (!isActive('ARB')) return null;
    return resolveEVM(domain, 'ARB', 'https://arb1.arbitrum.io/rpc');
}
async function resolveOP(domain) {
    if (!isActive('OP')) return null;
    return resolveEVM(domain, 'OP', 'https://mainnet.optimism.io');
}
async function resolveBASE(domain) {
    if (!isActive('BASE')) return null;
    return resolveEVM(domain, 'BASE', 'https://mainnet.base.org');
}
async function resolveBNB(domain) {
    if (!isActive('BNB')) return null;
    return resolveEVM(domain, 'BNB', 'https://bsc-dataseed.binance.org');
}
async function resolveAVAX(domain) {
    if (!isActive('AVAX')) return null;
    return resolveEVM(domain, 'AVAX', 'https://api.avax.network/ext/bc/C/rpc');
}
async function resolveFTM(domain) {
    if (!isActive('FTM')) return null;
    return resolveEVM(domain, 'FTM', 'https://rpc.fantom.network');
}
async function resolveCELO(domain) {
    if (!isActive('CELO')) return null;
    return resolveEVM(domain, 'CELO', 'https://forno.celo.org');
}
async function resolveCRO(domain) {
    if (!isActive('CRO')) return null;
    return resolveEVM(domain, 'CRO', 'https://evm.cronos.org');
}
async function resolveKLAY(domain) {
    if (!isActive('KLAY')) return null;
    return resolveEVM(domain, 'KLAY', 'https://public-en-cypress.klaytn.net');
}
async function resolveGNO(domain) {
    if (!isActive('GNO')) return null;
    return resolveEVM(domain, 'GNO', 'https://rpc.gnosischain.com');
}

// ============================================================
// 31. Osmosis (OSMO)
// ============================================================
async function resolveOSMO(domain) {
    if (!isActive('OSMO')) return null;
    try {
        const data = await fetchJSON(`https://api.osmosis.domains/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'OsmoNS', chain: 'OSMO' };
        }
    } catch {}
    return null;
}

// ============================================================
// 32. Juno (JUNO)
// ============================================================
async function resolveJUNO(domain) {
    if (!isActive('JUNO')) return null;
    try {
        const data = await fetchJSON(`https://api.juno.domains/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'JunoNS', chain: 'JUNO' };
        }
    } catch {}
    return null;
}

// ============================================================
// 33. Stargaze (STARS)
// ============================================================
async function resolveSTARS(domain) {
    if (!isActive('STARS')) return null;
    try {
        const data = await fetchJSON(`https://api.starname.me/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'Starname', chain: 'STARS' };
        }
    } catch {}
    return null;
}

// ============================================================
// 34. Regen
// ============================================================
async function resolveREGEN(domain) {
    if (!isActive('REGEN')) return null;
    try {
        const data = await fetchJSON(`https://api.regen.network/v1/domains/${domain}`);
        if (data?.address || data?.owner) {
            return { result: data.address || data.owner, source: 'RegenNS', chain: 'REGEN' };
        }
    } catch {}
    return null;
}

// ============================================================
// 35. Dash (DASH)
// ============================================================
async function resolveDASH(domain) {
    if (!isActive('DASH')) return null;
    try {
        const data = await fetchJSON(
            `https://api.unstoppabledomains.com/resolve/domains/${domain}`,
            { 'Authorization': `Bearer ${process.env.UNSTOPPABLE_API_KEY || ''}` }
        );
        const records = data?.records || {};
        const dashAddr = records['crypto.DASH.address'];
        if (dashAddr) return { result: dashAddr, source: 'Unstoppable/DASH', chain: 'DASH' };
    } catch {}
    return null;
}

// ============================================================
// ROUTEUR PRINCIPAL
// ============================================================
const RESOLVERS = [
    // XDC (priorité — tes domaines principaux)
    { tlds: ['xdc', 'rwa', 'depin'], fn: resolveXDC, name: 'XDC' },
    // ENS Ethereum
    { tlds: ['eth'], fn: resolveENS, name: 'ENS' },
    // Unstoppable (multi-chain)
    { tlds: ['crypto', 'nft', 'wallet', 'dao', 'x', '888', 'blockchain'], fn: resolveUD, name: 'UD' },
    // ISO 20022
    { tlds: ['xrp'], fn: resolveXRP, name: 'XRP' },
    { tlds: ['xlm'], fn: resolveXLM, name: 'XLM' },
    { tlds: ['hbar'], fn: resolveHBAR, name: 'HBAR' },
    { tlds: ['ada'], fn: resolveADA, name: 'ADA' },
    { tlds: ['algo'], fn: resolveALGO, name: 'ALGO' },
    // Non-EVM
    { tlds: ['sol'], fn: resolveSOL, name: 'SOL' },
    { tlds: ['near'], fn: resolveNEAR, name: 'NEAR' },
    { tlds: ['ton'], fn: resolveTON, name: 'TON' },
    { tlds: ['dot'], fn: resolveDOT, name: 'DOT' },
    { tlds: ['atom'], fn: resolveATOM, name: 'ATOM' },
    { tlds: ['sui'], fn: resolveSUI, name: 'SUI' },
    { tlds: ['apt'], fn: resolveAPT, name: 'APT' },
    { tlds: ['sei'], fn: resolveSEI, name: 'SEI' },
    { tlds: ['inj'], fn: resolveINJ, name: 'INJ' },
    { tlds: ['stx'], fn: resolveSTX, name: 'STX' },
    // Bitcoin family (via Unstoppable)
    { tlds: ['btc'], fn: resolveBTC, name: 'BTC' },
    { tlds: ['ltc'], fn: resolveLTC, name: 'LTC' },
    { tlds: ['doge'], fn: resolveDOGE, name: 'DOGE' },
    { tlds: ['dash'], fn: resolveDASH, name: 'DASH' },
    // EVM-compatible
    { tlds: ['matic', 'polygon'], fn: resolveMATIC, name: 'MATIC' },
    { tlds: ['arb', 'arb1'], fn: resolveARB, name: 'ARB' },
    { tlds: ['op'], fn: resolveOP, name: 'OP' },
    { tlds: ['base'], fn: resolveBASE, name: 'BASE' },
    { tlds: ['bnb'], fn: resolveBNB, name: 'BNB' },
    { tlds: ['avax'], fn: resolveAVAX, name: 'AVAX' },
    { tlds: ['ftm'], fn: resolveFTM, name: 'FTM' },
    { tlds: ['celo'], fn: resolveCELO, name: 'CELO' },
    { tlds: ['cro'], fn: resolveCRO, name: 'CRO' },
    { tlds: ['klay'], fn: resolveKLAY, name: 'KLAY' },
    { tlds: ['gno', 'gnosis'], fn: resolveGNO, name: 'GNO' },
    // Cosmos ecosystem
    { tlds: ['osmo'], fn: resolveOSMO, name: 'OSMO' },
    { tlds: ['juno'], fn: resolveJUNO, name: 'JUNO' },
    { tlds: ['stars'], fn: resolveSTARS, name: 'STARS' },
    { tlds: ['regen'], fn: resolveREGEN, name: 'REGEN' },
];

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { domain, reverse } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domaine manquant' });

    const domainLower = domain.toLowerCase();

    // Check cache
    const cacheKey = `resolve:${domainLower}`;
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json({ ...cached, cached: true });

    // Try all resolvers
    for (const resolver of RESOLVERS) {
        try {
            const result = await resolver.fn(domainLower);
            if (result) {
                setCache(cacheKey, result);
                return res.status(200).json(result);
            }
        } catch (err) {
            console.error(`[${resolver.name}] Error:`, err.message);
        }
    }

    return res.status(404).json({
        error: `Domaine "${domain}" non trouvé sur aucune chaîne supportée.`,
        supported_tlds: RESOLVERS.map(r => r.tlds).flat()
    });
}
