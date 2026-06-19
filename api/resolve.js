import crosschainResolver from './resolve-crosschain.js';

export default async function handler(req, res) {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domaine manquant' });

    const domainLower = domain.toLowerCase();

    // XDC / XWD
    if (domainLower.endsWith('.xdc') || domainLower.endsWith('.rwa') || domainLower.endsWith('.depin')) {
        return crosschainResolver(req, res);
    }
    // ENS
    else if (domainLower.endsWith('.eth')) {
        return crosschainResolver(req, res);
    }
    // Unstoppable
    else if (domainLower.endsWith('.crypto') || domainLower.endsWith('.nft') || domainLower.endsWith('.wallet') ||
             domainLower.endsWith('.dao') || domainLower.endsWith('.x') || domainLower.endsWith('.888') ||
             domainLower.endsWith('.blockchain')) {
        return crosschainResolver(req, res);
    }
    // Crosschain (tout le reste)
    else {
        return crosschainResolver(req, res);
    }
}
