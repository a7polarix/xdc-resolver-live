// api/invoices.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { address, fromBlock, toBlock } = req.query;

    if (!address) {
        return res.status(400).json({ error: 'Paramètre address requis' });
    }

    // Hash et adresse fictifs pour l'exemple
    const dummyHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const dummyToAddress = "0xDeadDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaDDeaD";

    const dummyInvoices = [
        {
            hash: dummyHash,
            from: address,
            to: dummyToAddress,
            amount: "1 XDC",
            fiat: "0.03 USD",
            date: new Date().toISOString(),
            invoiceUrl: `https://fleurs-resolver-final.vercel.app/api/invoice/${dummyHash}`
        }
    ];

    return res.status(200).json({
        address,
        fromBlock: fromBlock || 'latest',
        toBlock: toBlock || 'latest',
        invoices: dummyInvoices
    });
}