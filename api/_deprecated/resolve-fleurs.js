import { ethers } from 'ethers';

const cache = new Map();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domaine manquant' });
    if (domain.startsWith('0x') && domain.length === 42) {
        return res.status(200).json({ result: domain });
    }

    const now = Date.now();
    const cached = cache.get(domain);
    if (cached && (now - cached.timestamp) < 3600000) {
        return res.status(200).json({ result: cached.address });
    }

    const CONTRACT_ADDRESS = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';
    const ABI = ['function getOwner(string name) view returns (address)'];
    const rpcList = [
        'https://rpc.xdcrpc.com',
        'https://rpc.xdc.org',
        'https://erpc.xdc.org'
    ];

    for (const rpcUrl of rpcList) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
            const owner = await contract.getOwner(domain);
            if (owner && owner !== ethers.ZeroAddress) {
                cache.set(domain, { address: owner, timestamp: now });
                return res.status(200).json({ result: owner });
            }
        } catch (err) {
            console.error(`RPC ${rpcUrl} failed:`, err.message);
            continue;
        }
    }
    return res.status(404).json({ error: `Domaine "${domain}" non trouvé.` });
}