import fleursResolver from './resolve-fleurs.js';
import ensResolver from './resolve-ens.js';
import udResolver from './resolve-ud.js';

export default async function handler(req, res) {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domaine manquant' });

    const domainLower = domain.toLowerCase();

    if (domainLower.endsWith('.xdc') || domainLower.endsWith('.rwa') || domainLower.endsWith('.depin')) {
        return fleursResolver(req, res);
    }
    else if (domainLower.endsWith('.eth')) {
        return ensResolver(req, res);
    }
    else if (domainLower.endsWith('.crypto') || domainLower.endsWith('.nft') || domainLower.endsWith('.wallet') ||
             domainLower.endsWith('.dao') || domainLower.endsWith('.x') || domainLower.endsWith('.888') ||
             domainLower.endsWith('.blockchain')) {
        return udResolver(req, res);
    }
    else {
        return res.status(400).json({ error: 'Extension de domaine non supportée' });
    }
}