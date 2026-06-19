// api/resolve-ens.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domaine manquant' });

    const domainLower = domain.toLowerCase();
    if (!domainLower.endsWith('.eth')) {
        return res.status(400).json({ error: 'Cette API ne traite que les domaines .eth' });
    }

    try {
        // Appel à l'API publique ENS Ideas (gratuite, pas de clé)
        const apiUrl = `https://api.ensideas.com/ens/resolve/${encodeURIComponent(domainLower)}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
            return res.status(404).json({ error: `Domaine ENS "${domain}" non trouvé.` });
        }
        const data = await response.json();
        const address = data.address;
        if (address && address.startsWith('0x')) {
            return res.status(200).json({ result: address, source: 'ENS (api.ensideas.com)' });
        } else {
            return res.status(404).json({ error: `Domaine ENS "${domain}" non trouvé.` });
        }
    } catch (err) {
        console.error('Erreur résolution ENS:', err);
        return res.status(500).json({ error: 'Erreur lors de la résolution ENS' });
    }
}