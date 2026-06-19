// api/webhook.js
export default async function handler(req, res) {
    // Sécurité : uniquement POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { webhookUrl, invoiceData } = req.body;

    if (!webhookUrl || !invoiceData) {
        return res.status(400).json({ error: 'webhookUrl et invoiceData requis' });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoiceData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        return res.status(200).json({ success: true, result });
    } catch (err) {
        console.error('Webhook error:', err);
        return res.status(500).json({ error: err.message });
    }
}