// api/resolve-ud.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domaine manquant' });
    const domainLower = domain.toLowerCase();
    const udTlds = ['.crypto', '.nft', '.wallet', '.dao', '.x', '.888', '.blockchain'];
    const isUd = udTlds.some(tld => domainLower.endsWith(tld));
    if (!isUd) return res.status(400).json({ error: 'Extension non supportée par cette API' });
    try {
        const apiUrl = `https://api.unstoppabledomains.com/resolve/domains/${encodeURIComponent(domainLower)}`;
        const response = await fetch(apiUrl, {
            headers: { 'accept': 'application/json', 'Authorization': `Bearer ${process.env.UNSTOPPABLE_API_KEY}` }
        });
        if (!response.ok) return res.status(404).json({ error: `Domaine Unstoppable "${domain}" non trouvé.` });
        const data = await response.json();
        const address = data?.records?.['crypto.ETH.address'];
        if (address && address.startsWith('0x')) {
            return res.status(200).json({ result: address, source: `Unstoppable Domains (${domainLower.split('.').pop()})` });
        } else {
            return res.status(404).json({ error: `Aucune adresse ETH trouvée pour ${domain}` });
        }
    } catch (err) {
        console.error('Erreur résolution Unstoppable Domains:', err);
        return res.status(500).json({ error: 'Erreur lors de la résolution Unstoppable Domains' });
    }
}