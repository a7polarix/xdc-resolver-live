// api/pqc-domain.js
// PQC Domain-Based Key Generation — imported by pqc.js (not a separate serverless function)
import { ethers } from 'ethers';
import { falcon512 } from '@noble/post-quantum/falcon.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { slh_dsa_sha2_128s } from '@noble/post-quantum/slh-dsa.js';
import { ml_kem512 } from '@noble/post-quantum/ml-kem.js';

const XDC_RPC = 'https://rpc.xdcrpc.com';
const XWD_CONTRACT = '0x295a7aB79368187a6CD03c464cfaAb04d799784E';
const XWD_ABI = [
  'function getOwner(string name) external view returns (address)',
  'function getDomainInfo(string name) external view returns (address owner, address resolver, uint256 expiry)',
  'function tokenIdOf(string name) external view returns (uint256)',
];

const keyCache = new Map();

export async function getDomainData(domainName) {
  const provider = new ethers.JsonRpcProvider(XDC_RPC);
  const contract = new ethers.Contract(XWD_CONTRACT, XWD_ABI, provider);
  try {
    const [owner, domainInfo] = await Promise.all([
      contract.getOwner(domainName).catch(() => null),
      contract.getDomainInfo(domainName).catch(() => null),
    ]);
    if (!owner || owner === ethers.ZeroAddress) return null;
    let tokenId = null;
    try { tokenId = await contract.tokenIdOf(domainName); } catch {}
    return { owner, tokenId: tokenId ? tokenId.toString() : null, domainName, resolver: domainInfo?.resolver || null, expiry: domainInfo?.expiry ? domainInfo.expiry.toString() : null };
  } catch (e) { console.error('[PQC-DOMAIN] Error:', e.message); return null; }
}

export function generateSeed(domainData) {
  const { owner, tokenId, domainName } = domainData;
  return ethers.keccak256(ethers.solidityPacked(['address', 'string', 'string'], [owner, tokenId || '0', domainName]));
}

export function deriveKeysFromSeed(seed, algorithm) {
  const seedBuffer = Buffer.from(seed.slice(2), 'hex');
  switch (algorithm) {
    case 'falcon': {
      const s = Buffer.alloc(48); seedBuffer.copy(s, 0, 0, 48);
      const k = falcon512.keygen(s);
      return { publicKey: k.publicKey, secretKey: k.secretKey, publicKeyBytes: k.publicKey.length };
    }
    case 'ml-dsa': {
      const s = Buffer.alloc(32); seedBuffer.copy(s, 0, 0, 32);
      const k = ml_dsa65.keygen(s);
      return { publicKey: k.publicKey, secretKey: k.secretKey, publicKeyBytes: k.publicKey.length };
    }
    case 'slh-dsa': {
      const s = Buffer.alloc(48); seedBuffer.copy(s, 0, 16, 64);
      const k = slh_dsa_sha2_128s.keygen(s);
      return { publicKey: k.publicKey, secretKey: k.secretKey, publicKeyBytes: k.publicKey.length };
    }
    case 'ml-kem': {
      const s = Buffer.alloc(64); seedBuffer.copy(s, 0, 0, 64);
      const k = ml_kem512.keygen(s);
      return { publicKey: k.publicKey, secretKey: k.secretKey, publicKeyBytes: k.publicKey.length };
    }
    default: return null;
  }
}

export async function signWithDomainKeys(domainName, message, algorithms = ['falcon']) {
  const domainData = await getDomainData(domainName);
  if (!domainData) return { error: `Domain ${domainName} not found` };
  const seed = generateSeed(domainData);
  const msgBytes = typeof message === 'string' ? Buffer.from(message) : message;
  const signatures = {};
  for (const algo of algorithms) {
    try {
      const keys = deriveKeysFromSeed(seed, algo);
      if (!keys) continue;
      if (algo === 'falcon') {
        const sig = falcon512.sign(msgBytes, keys.secretKey);
        signatures.falcon = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'falcon', variant: 'falcon512', standard: 'NIST FIPS 206', nistLevel: 1, publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex') };
      } else if (algo === 'ml-dsa') {
        const sig = ml_dsa65.sign(msgBytes, keys.secretKey);
        signatures.mldsa = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'ml-dsa', variant: 'ml_dsa65', standard: 'NIST FIPS 204', nistLevel: 3, publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex') };
      } else if (algo === 'slh-dsa') {
        const sig = slh_dsa_sha2_128s.sign(msgBytes, keys.secretKey);
        signatures.slhdsa = { signature: '0x' + Buffer.from(sig).toString('hex'), signatureBytes: sig.length, algorithm: 'slh-dsa', variant: 'slh_dsa_sha2_128s', standard: 'NIST FIPS 205', nistLevel: 1, publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex') };
      } else if (algo === 'ml-kem') {
        const enc = ml_kem512.encapsulate(keys.publicKey);
        signatures.mlkem = { ciphertext: '0x' + Buffer.from(enc.cipherText).toString('hex'), sharedSecret: '0x' + Buffer.from(enc.sharedSecret).toString('hex'), algorithm: 'ml-kem', variant: 'ml_kem512', standard: 'NIST FIPS 203', nistLevel: 1, publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex') };
      }
    } catch (e) { console.error(`[PQC-DOMAIN] Sign error ${algo}:`, e.message); }
  }
  return { domain: domainName, owner: domainData.owner, tokenId: domainData.tokenId, signatures };
}

export async function verifyDomainSignature(domainName, message, algorithm, signature, publicKey) {
  const domainData = await getDomainData(domainName);
  if (!domainData) return { valid: false, error: 'Domain not found' };
  const seed = generateSeed(domainData);
  const keys = deriveKeysFromSeed(seed, algorithm);
  if (!keys) return { valid: false, error: 'Key derivation failed' };
  const msgBytes = typeof message === 'string' ? Buffer.from(message) : message;
  const sigBytes = Buffer.from(signature.startsWith('0x') ? signature.slice(2) : signature, 'hex');
  const pkBytes = Buffer.from(publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey, 'hex');
  let valid = false;
  try {
    if (algorithm === 'falcon') valid = falcon512.verify(sigBytes, msgBytes, pkBytes);
    else if (algorithm === 'ml-dsa') valid = ml_dsa65.verify(sigBytes, msgBytes, pkBytes);
    else if (algorithm === 'slh-dsa') valid = slh_dsa_sha2_128s.verify(sigBytes, msgBytes, pkBytes);
  } catch (e) { return { valid: false, error: e.message }; }
  return { valid, algorithm, domain: domainName, owner: domainData.owner };
}

export async function getDomainKeys(domainName, algorithms = ['falcon']) {
  const cacheKey = `${domainName}:${algorithms.join(',')}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);
  const domainData = await getDomainData(domainName);
  if (!domainData) return { error: `Domain ${domainName} not found` };
  const seed = generateSeed(domainData);
  const results = {};
  for (const algo of algorithms) {
    const keys = deriveKeysFromSeed(seed, algo);
    if (keys) results[algo] = { publicKey: '0x' + Buffer.from(keys.publicKey).toString('hex'), publicKeyBytes: keys.publicKeyBytes };
  }
  const result = { domain: domainName, owner: domainData.owner, tokenId: domainData.tokenId, seed, keys: results };
  keyCache.set(cacheKey, result);
  setTimeout(() => keyCache.delete(cacheKey), 3600000);
  return result;
}
