// api/pqc-receipt.js
// ============================================================
// PQC Receipt Signing API
// Signs receipt hash with domain-specific PQC keys derived from XWD contract data
// ============================================================

import { signWithDomainKeys, verifyDomainSignature } from './pqc-domain.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { action } = req.query;
  const body = req.body || {};

  try {
    switch (action) {
      // ---- SIGN RECEIPT WITH DOMAIN PQC KEYS ----
      case 'sign': {
        const { domain, txHash, algorithms } = body;
        if (!domain) return res.status(400).json({ error: 'domain required' });
        if (!txHash) return res.status(400).json({ error: 'txHash required' });

        const algos = algorithms || ['falcon'];
        const result = await signWithDomainKeys(domain, txHash, algos);

        if (result.error) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({
          success: true,
          domain: result.domain,
          owner: result.owner,
          tokenId: result.tokenId,
          signatures: result.signatures,
        });
      }

      // ---- VERIFY DOMAIN PQC SIGNATURE ----
      case 'verify': {
        const { domain, message, algorithm, signature, publicKey } = body;
        if (!domain || !message || !algorithm || !signature || !publicKey) {
          return res.status(400).json({ error: 'domain, message, algorithm, signature, publicKey required' });
        }

        const result = await verifyDomainSignature(domain, message, algorithm, signature, publicKey);
        return res.status(200).json(result);
      }

      // ---- GET DOMAIN INFO + PUBLIC KEYS ----
      case 'info': {
        const { domain } = body;
        if (!domain) return res.status(400).json({ error: 'domain required' });

        const { getDomainKeys } = await import('./pqc-domain.js');
        const result = await getDomainKeys(domain, ['falcon', 'ml-dsa', 'slh-dsa', 'ml-kem']);

        if (result.error) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({
          success: true,
          domain: result.domain,
          owner: result.owner,
          tokenId: result.tokenId,
          publicKeys: result.keys,
        });
      }

      default:
        return res.status(400).json({
          error: 'Unknown action',
          supported: ['sign', 'verify', 'info'],
          usage: {
            sign: 'POST /api/pqc-receipt.js?action=sign { domain, txHash, algorithms }',
            verify: 'POST /api/pqc-receipt.js?action=verify { domain, message, algorithm, signature, publicKey }',
            info: 'POST /api/pqc-receipt.js?action=info { domain }',
          },
        });
    }
  } catch (e) {
    console.error('[PQC-RECEIPT] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
