// api/status.js
export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        status: 'active',
        network: 'XDC',
        version: '1.0',
        timestamp: new Date().toISOString(),
        copyright: "© 2026 Fleurs de Lys / FocalZero – Tous droits réservés – Licence SAN-2026.1"
    });
}