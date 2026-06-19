// api/invoice/[hash].js
export default async function handler(req, res) {
    const { hash } = req.query;
    const { address } = req.query;
    const { format } = req.query;

    if (!hash) {
        return res.status(400).json({ error: 'Hash requis' });
    }

    const invoiceData = {
        facture: {
            numero: `FDL-2026-${hash.slice(2, 10)}`,
            emetteur: address || "0xDeadDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaD",
            categorie_emetteur: "invité",
            destinataire: "0xDeadDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaD",
            categorie_destinataire: "invité",
            montant: "11 XDC",
            devise: "XDC",
            date: new Date().toISOString(),
            hash: hash,
            lien: `https://xdcscan.com/tx/${hash}`,
            valeur_ht_fiat: "0.2830 USD",
            tva_appliquee: "20%",
            montant_ttc_fiat: "0.3396 USD",
            taux_change_utilise: "0.03087024 USD/XDC",
            siret: "987654321",
            adresse_siege: "33 av abadon 66733 Sion",
            objet_prestation: "robotic",
            eip712_signature: "0xa5545088af8b6f5d473d48b72c069d785c58971447db8784884d0883b6b50f2c6b7038b76de148d463c96d0edef3f9303e095c70798314ab960172af7d1bc14b1c"
        }
    };

    if (format === 'html') {
        const html = generateInvoiceHTML(invoiceData.facture);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    }

    return res.status(200).json(invoiceData);
}

function generateInvoiceHTML(data) {
    const {
        numero,
        emetteur,
        categorie_emetteur,
        destinataire,
        categorie_destinataire,
        montant,
        devise,
        date,
        hash,
        lien,
        valeur_ht_fiat,
        tva_appliquee,
        montant_ttc_fiat,
        taux_change_utilise,
        siret,
        adresse_siege,
        objet_prestation,
        eip712_signature
    } = data;

    const montantTTC = parseFloat(montant) || 0;
    const tvaRate = parseFloat(tva_appliquee) || 0;
    const montantHT = tvaRate > 0 ? montantTTC / (1 + tvaRate / 100) : montantTTC;
    const tvaAmount = montantTTC - montantHT;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture ${numero}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Roboto, system-ui, sans-serif;
            background: #f2f4f8;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 2rem;
        }
        .invoice-wrapper {
            max-width: 900px;
            width: 100%;
            background: #ffffff;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.12);
            padding: 2.5rem;
            border: 1px solid #e9edf2;
        }
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #f0b429;
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }
        .invoice-header h1 {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #FFD700, #DAA520);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            letter-spacing: -0.02em;
        }
        .invoice-header .badge {
            background: #1a2b4a;
            color: #fff;
            padding: 0.4rem 1.2rem;
            border-radius: 40px;
            font-size: 0.8rem;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .invoice-meta {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 2rem;
            font-size: 0.9rem;
            color: #2d3748;
        }
        .invoice-meta .col {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        .invoice-meta .col strong {
            font-weight: 600;
            color: #1a202c;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0 2rem 0;
        }
        .invoice-table th {
            background: #f7fafc;
            text-align: left;
            padding: 0.8rem 0.5rem;
            font-weight: 600;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #4a5568;
            border-bottom: 2px solid #e2e8f0;
        }
        .invoice-table td {
            padding: 0.8rem 0.5rem;
            border-bottom: 1px solid #edf2f7;
            color: #2d3748;
        }
        .invoice-table .total-row {
            font-weight: 700;
            font-size: 1.1rem;
            border-top: 2px solid #e2e8f0;
        }
        .invoice-table .total-row td {
            padding-top: 1rem;
        }
        .legal-mentions {
            background: #f7fafc;
            border-radius: 12px;
            padding: 1.5rem;
            margin: 2rem 0 1.5rem 0;
            font-size: 0.85rem;
            border-left: 4px solid #f0b429;
            color: #2d3748;
        }
        .legal-mentions p {
            margin: 0.3rem 0;
        }
        .legal-mentions strong {
            font-weight: 600;
        }
        .signature-block {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e2e8f0;
        }
        .signature-block .hash-link {
            font-size: 0.85rem;
            word-break: break-all;
        }
        .signature-block .hash-link a {
            color: #2b6cb0;
            text-decoration: none;
            font-weight: 500;
        }
        .signature-block .hash-link a:hover {
            text-decoration: underline;
        }
        .footer-note {
            text-align: center;
            font-size: 0.75rem;
            color: #a0aec0;
            margin-top: 2rem;
            border-top: 1px solid #edf2f7;
            padding-top: 1rem;
        }
        .eip712-badge {
            background: #edf2f7;
            border-radius: 20px;
            padding: 0.2rem 0.8rem;
            font-size: 0.7rem;
            font-weight: 600;
            color: #2d3748;
            display: inline-block;
        }
        @media (max-width: 600px) {
            .invoice-wrapper { padding: 1.5rem; }
            .invoice-header { flex-direction: column; gap: 0.5rem; }
            .invoice-meta { flex-direction: column; }
        }
    </style>
</head>
<body>
<div class="invoice-wrapper">
    <div class="invoice-header">
        <div>
            <h1>⚜️ Fleurs de Lys</h1>
            <div style="font-size:0.9rem; color:#4a5568; margin-top:4px;">
                Facture EIP‑712 · <span class="eip712-badge">signée on‑chain</span>
            </div>
        </div>
        <div class="badge">#${numero}</div>
    </div>

    <div class="invoice-meta">
        <div class="col"><strong>Numéro</strong><span>${numero}</span></div>
        <div class="col"><strong>Date</strong><span>${new Date(date).toLocaleString('fr-FR', { timeZone: 'UTC' })}</span></div>
        <div class="col"><strong>Devise</strong><span>${devise}</span></div>
        <div class="col"><strong>Hash</strong><span style="font-family:monospace;font-size:0.75rem;word-break:break-all;">${hash}</span></div>
    </div>

    <table class="invoice-table">
        <thead><tr><th>Émetteur</th><th>Destinataire</th><th>Objet</th><th style="text-align:right;">Montant</th></tr></thead>
        <tbody>
            <tr>
                <td><strong>${emetteur}</strong></td>
                <td><strong>${destinataire}</strong></td>
                <td>${objet_prestation}</td>
                <td style="text-align:right;">${montantTTC.toFixed(2)} ${devise} (TTC)</td>
            </tr>
            <tr>
                <td colspan="3" style="text-align:right;font-size:0.9rem;">Dont HT</td>
                <td style="text-align:right;font-size:0.9rem;">${montantHT.toFixed(2)} ${devise}</td>
            </tr>
            <tr>
                <td colspan="3" style="text-align:right;font-size:0.9rem;">TVA (${tvaRate}%)</td>
                <td style="text-align:right;font-size:0.9rem;">${tvaAmount.toFixed(2)} ${devise}</td>
            </tr>
            <tr class="total-row">
                <td colspan="3" style="text-align:right;font-size:1.2rem;">Total TTC</td>
                <td style="text-align:right;font-size:1.2rem;color:#2b6cb0;">${montantTTC.toFixed(2)} ${devise}</td>
            </tr>
        </tbody>
    </table>

    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;background:#f7fafc;padding:1rem 1.5rem;border-radius:12px;margin-bottom:1.5rem;">
        <div><strong>Valeur HT en USD :</strong> ${valeur_ht_fiat}</div>
        <div><strong>Taux :</strong> ${taux_change_utilise}</div>
        <div><strong>TTC en USD :</strong> ${montant_ttc_fiat}</div>
    </div>

    <div class="legal-mentions">
        <p><strong>🧾 Mentions légales</strong></p>
        <p><strong>SIRET :</strong> ${siret} &nbsp;|&nbsp; <strong>Siège :</strong> ${adresse_siege}</p>
        <p><strong>Objet :</strong> ${objet_prestation}</p>
        <p><strong>TVA :</strong> ${tva_appliquee}</p>
        <p><strong>Signature EIP‑712 :</strong> <span style="font-family:monospace;font-size:0.75rem;word-break:break-all;">${eip712_signature}</span></p>
    </div>

    <div class="signature-block">
        <div>
            <div style="font-weight:600;">✅ Facture signée et vérifiable</div>
            <div style="font-size:0.8rem;color:#4a5568;">La signature EIP‑712 atteste de l’authenticité</div>
        </div>
        <div class="hash-link">
            <a href="${lien}" target="_blank">🔗 Voir sur l’explorateur XDC</a>
        </div>
    </div>

    <div class="footer-note">
        Facture générée par Fleurs de Lys · Saint Empire Numérique · Document valable comme preuve de transaction on‑chain
    </div>
</div>
</body>
</html>
    `;
}