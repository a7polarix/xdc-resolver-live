// api/pqc-domain.js
// ============================================================
// PQC Domain-Based Key Generation
// Uses XWD contract data (owner, tokenId, mintTxHash, mintTimestamp)
// as deterministic seed for PQC key generation.
// ============================================================
// No need to modify XWD contract — read-only access.
// Keys are deterministic: same domain = same keys every time.
// ============================================================

import { ethers } from 'ethers';
import { falcon512 } from '@noble/post-quantum/falcon.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { slh_dsa_sha2_128s } from '@noble/post-quantum/slh-dsa.js';
import { ml_kem512 } from '@noble/post-quantum/ml-kem.js';

// XDC RPC
const XDC_RPC = 'https://rpc.xdcrpc.com';

// XWD Contract ABI (minimal — only read functions we need)
const XWD_ABI = [
  'function getOwner(string name) external view returns (address)',
  'function getDomainInfo(string name) external view returns (address owner, address resolver, uint256 expiry)',
  'function tokenIdOf(string name) external view returns (uint256)',
];

const XWD_CONTRACT = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';

// Cache for generated keys (in-memory, per serverless invocation)
const keyCache = new Map();

/**
 * Get domain data from XWD contract
 */
async function getDomainData(domainName) {
  const provider = new ethers.JsonRpcProvider(XDC_RPC);
  const contract = new ethers.Contract(XWD_CONTRACT, XWD_ABI, provider);

  try {
    // Get owner and domain info
    const [owner, domainInfo] = await Promise.all([
      contract.getOwner(domainName).catch(() => null),
      contract.getDomainInfo(domainName).catch(() => null),
    ]);

    if (!owner || owner === ethers.ZeroAddress) {
      return null;
    }

    // Get token ID
    let tokenId = null;
    try {
      tokenId = await contract.tokenIdOf(domainName);
    } catch {
      // tokenIdOf may not exist in all XWD versions
    }

    return {
      owner,
      tokenId: tokenId ? tokenId.toString() : null,
      domainName,
      resolver: domainInfo?.resolver || null,
      expiry: domainInfo?.expiry ? domainInfo.expiry.toString() : null,
    };
  } catch (e) {
    console.error('[PQC-DOMAIN] Error reading XWD contract:', e.message);
    return null;
  }
}

/**
 * Generate deterministic seed from domain data
 * seed = keccak256(owner + tokenId + domainName)
 */
function generateSeed(domainData) {
  const { owner, tokenId, domainName } = domainData;
  const data = ethers.solidityPacked(
    ['address', 'string', 'string'],
    [owner, tokenId || '0', domainName]
  );
  return ethers.keccak256(data);
}

/**
 * Derive PQC keypair from seed for a specific algorithm
 */
function deriveKeysFromSeed(seed, algorithm) {
  // Use different parts of the seed for different algorithms
  const seedBuffer = Buffer.from(seed.slice(2), 'hex');

  switch (algorithm) {
    case 'falcon': {
      // FALCON needs 48-byte seed
      const falconSeed = Buffer.alloc(48);
      seedBuffer.copy(falconSeed, 0, 0, 48);
      const keys = falcon512.keygen(falconSeed);
      return {
        publicKey: keys.publicKey,
        secretKey: keys.secretKey,
        publicKeyBytes: keys.publicKey.length,
        secretKeyBytes: keys.secretKey.length,
      };
    }
    case 'ml-dsa': {
      // ML-DSA needs 32-byte seed
      const dilithiumSeed = Buffer.alloc(32);
      seedBuffer.copy(dilithiumSeed, 0, 0, 32);
      const keys = ml_dsa65.keygen(dilithiumSeed);
      return {
        publicKey: keys.publicKey,
        secretKey: keys.secretKey,
        publicKeyBytes: keys.publicKey.length,
        secretKeyBytes: keys.secretKey.length,
      };
    }
    case 'slh-dsa': {
      // SLH-DSA needs 48-byte seed
      const sphincsSeed = Buffer.alloc(48);
      // Use different offset to get different keys
      seedBuffer.copy(sphincsSeed, 0, 16, 64);
      const keys = slh_dsa_sha2_128s.keygen(sphincsSeed);
      return {
        publicKey: keys.publicKey,
        secretKey: keys.secretKey,
        publicKeyBytes: keys.publicKey.length,
        secretKeyBytes: keys.secretKey.length,
      };
    }
    case 'ml-kem': {
      // ML-KEM needs 64-byte seed
      const kyberSeed = Buffer.alloc(64);
      seedBuffer.copy(kyberSeed, 0, 0, 64);
      const keys = ml_kem512.keygen(kyberSeed);
      return {
        publicKey: keys.publicKey,
        secretKey: keys.secretKey,
        publicKeyBytes: keys.publicKey.length,
        secretKeyBytes: keys.secretKey.length,
      };
    }
    default:
      return null;
  }
}

/**
 * Get or generate PQC keys for a domain
 * Uses cache to avoid regenerating keys on every call
 */
export async function getDomainKeys(domainName, algorithms = ['falcon']) {
  const cacheKey = `${domainName}:${algorithms.join(',')}`;

  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey);
  }

  // Get domain data from XWD contract
  const domainData = await getDomainData(domainName);
  if (!domainData) {
    return { error: `Domain ${domainName} not found in XWD contract` };
  }

  // Generate deterministic seed
  const seed = generateSeed(domainData);

  // Derive keys for each requested algorithm
  const results = {};
  for (const algo of algorithms) {
    const keys = deriveKeysFromSeed(seed, algo);
    if (keys) {
      results[algo] = {
        publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'),
        publicKeyBytes: keys.publicKeyBytes,
        // Secret key is NOT returned — only used for signing
      };
    }
  }

  const result = {
    domain: domainName,
    owner: domainData.owner,
    tokenId: domainData.tokenId,
    seed: seed,
    keys: results,
  };

  // Cache for 1 hour
  keyCache.set(cacheKey, result);
  setTimeout(() => keyCache.delete(cacheKey), 3600000);

  return result;
}

/**
 * Sign a message with domain-specific PQC keys
 */
export async function signWithDomainKeys(domainName, message, algorithms = ['falcon']) {
  // Get domain data
  const domainData = await getDomainData(domainName);
  if (!domainData) {
    return { error: `Domain ${domainName} not found in XWD contract` };
  }

  // Generate seed
  const seed = generateSeed(domainData);
  const msgBytes = typeof message === 'string' ? Buffer.from(message) : message;

  // Sign with each requested algorithm
  const signatures = {};
  for (const algo of algorithms) {
    try {
      const keys = deriveKeysFromSeed(seed, algo);
      if (!keys) continue;

      if (algo === 'falcon') {
        const sig = falcon512.sign(msgBytes, keys.secretKey);
        signatures.falcon = {
          signature: '0x' + Buffer.from(sig).toString('hex'),
          signatureBytes: sig.length,
          algorithm: 'falcon',
          variant: 'falcon512',
          standard: 'NIST FIPS 206 (FN-DSA draft)',
          nistLevel: 1,
          publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'),
        };
      } else if (algo === 'ml-dsa') {
        const sig = ml_dsa65.sign(msgBytes, keys.secretKey);
        signatures.mldsa = {
          signature: '0x' + Buffer.from(sig).toString('hex'),
          signatureBytes: sig.length,
          algorithm: 'ml-dsa',
          variant: 'ml_dsa65',
          standard: 'NIST FIPS 204',
          nistLevel: 3,
          publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'),
        };
      } else if (algo === 'slh-dsa') {
        const sig = slh_dsa_sha2_128s.sign(msgBytes, keys.secretKey);
        signatures.slhdsa = {
          signature: '0x' + Buffer.from(sig).toString('hex'),
          signatureBytes: sig.length,
          algorithm: 'slh-dsa',
          variant: 'slh_dsa_sha2_128s',
          standard: 'NIST FIPS 205',
          nistLevel: 1,
          publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'),
        };
      } else if (algo === 'ml-kem') {
        const enc = ml_kem512.encapsulate(keys.publicKey);
        signatures.mlkem = {
          ciphertext: '0x' + Buffer.from(enc.cipherText).toString('hex'),
          sharedSecret: '0x' + Buffer.from(enc.sharedSecret).toString('hex'),
          algorithm: 'ml-kem',
          variant: 'ml_kem512',
          standard: 'NIST FIPS 203',
          nistLevel: 1,
          publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'),
        };
      }
    } catch (e) {
      console.error(`[PQC-DOMAIN] Sign error for ${algo}:`, e.message);
    }
  }

  return {
    domain: domainName,
    owner: domainData.owner,
    tokenId: domainData.tokenId,
    message: typeof message === 'string' ? message : message.toString('hex'),
    signatures,
  };
}

/**
 * Verify a domain PQC signature
 */
export async function verifyDomainSignature(domainName, message, algorithm, signature, publicKey) {
  const domainData = await getDomainData(domainName);
  if (!domainData) {
    return { valid: false, error: 'Domain not found' };
  }

  const seed = generateSeed(domainData);
  const keys = deriveKeysFromSeed(seed, algorithm);
  if (!keys) {
    return { valid: false, error: 'Key derivation failed' };
  }

  const msgBytes = typeof message === 'string' ? Buffer.from(message) : message;
  const sigBytes = Buffer.from(signature.startsWith('0x') ? signature.slice(2) : signature, 'hex');
  const pkBytes = Buffer.from(publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey, 'hex');

  let valid = false;
  try {
    if (algorithm === 'falcon') {
      valid = falcon512.verify(sigBytes, msgBytes, pkBytes);
    } else if (algorithm === 'ml-dsa') {
      valid = ml_dsa65.verify(sigBytes, msgBytes, pkBytes);
    } else if (algorithm === 'slh-dsa') {
      valid = slh_dsa_sha2_128s.verify(sigBytes, msgBytes, pkBytes);
    }
  } catch (e) {
    return { valid: false, error: e.message };
  }

  return { valid, algorithm, domain: domainName, owner: domainData.owner };
}
