import { XummSdk } from 'xumm-sdk';

const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;
const sdk = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET);

export default async function handler(req, res) {
  const { destination, amount } = req.body;
  if (!destination || !amount) {
    return res.status(400).json({ error: 'Destination ou montant manquant' });
  }

  // Exemple : paiement en RLUSD (vous pouvez aussi faire en XRP)
  const payload = {
    txjson: {
      TransactionType: 'Payment',
      Destination: destination,
      Amount: {
        currency: '524C555344000000000000000000000000000000', // RLUSD
        issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
        value: amount
      }
    },
    options: { force_network: 'MAINNET' },
    custom_meta: { instruction: `Payer ${amount} RLUSD à ${destination}` }
  };

  try {
    const created = await sdk.payload.create(payload);
    res.status(200).json({
      qr_png: created.refs.qr_png,
      uuid: created.uuid,
      next: created.next.always
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}