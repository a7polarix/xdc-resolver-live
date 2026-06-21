// api/falcon.js
// ============================================================
// FALCON — Post-Quantum Signature Module for Fleurs de Lys / EVA-01
// ============================================================
// Uses @noble/post-quantum (v0.6.1+) — auditable, KAT-verified
// Implementation: falcon512 / falcon1024 (Round 3)
//
// Also includes ML-DSA (Dilithium) per NIST FIPS 204
// as a secondary PQC option.
//
// API contract: same function signatures & return shapes as the
// previous (broken) implementation so pqc.js, FALCON_AUDIT.js,
// and wallet3.js work unchanged.
// ============================================================

import { falcon512, falcon1024 } from '@noble/post-quantum/falcon.js';
import { ml_dsa44, ml_dsa65, ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { ml_kem512, ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { slh_dsa_sha2_128s, slh_dsa_sha2_128f, slh_dsa_sha2_192s, slh_dsa_sha2_192f, slh_dsa_sha2_256s, slh_dsa_sha2_256f } from '@noble/post-quantum/slh-dsa.js';
import { randomBytes } from '@noble/post-quantum/utils.js';

// ============================================================
// MASTER FALCON-512 KEYPAIR (fixed for all API signatures)
// Generated 2026-06-21 with @noble/post-quantum v0.6.1
// Seed: 48 bytes deterministic → same keypair every time
// ============================================================
const MASTER_SEED = Buffer.from(
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
  'hex'
);
const MASTER_KEYS = falcon512.keygen(MASTER_SEED);
const MASTER_PK = MASTER_KEYS.publicKey;
const MASTER_SK = MASTER_KEYS.secretKey;

// Export for use by pqc.js
export { MASTER_PK, MASTER_SK };
// ============================================================

const FALCON_PARAMS = {
  falcon512:  { signatureBytes: 666,  publicKeyBytes: 897,  secretKeyBytes: 1281, nistLevel: 1 },
  falcon1024: { signatureBytes: 1280, publicKeyBytes: 1793, secretKeyBytes: 2305, nistLevel: 5 },
};

const ML_DSA_PARAMS = {
  ml_dsa44: { signatureBytes: 2420, publicKeyBytes: 1312, secretKeyBytes: 2560, nistLevel: 2, k: 4, l: 4, eta: 2 },
  ml_dsa65: { signatureBytes: 3309, publicKeyBytes: 1952, secretKeyBytes: 4032, nistLevel: 3, k: 6, l: 5, eta: 4 },
  ml_dsa87: { signatureBytes: 4627, publicKeyBytes: 2592, secretKeyBytes: 4896, nistLevel: 5, k: 8, l: 7, eta: 2 },
};

const ML_KEM_PARAMS = {
  ml_kem512:  { ciphertextBytes: 768,  publicKeyBytes: 800,  secretKeyBytes: 1632, nistLevel: 1, standard: 'NIST FIPS 203 (ML-KEM / Kyber)' },
  ml_kem768:  { ciphertextBytes: 1088, publicKeyBytes: 1184, secretKeyBytes: 2400, nistLevel: 3, standard: 'NIST FIPS 203 (ML-KEM / Kyber)' },
  ml_kem1024: { ciphertextBytes: 1568, publicKeyBytes: 1568, secretKeyBytes: 3168, nistLevel: 5, standard: 'NIST FIPS 203 (ML-KEM / Kyber)' },
};

const SLH_DSA_PARAMS = {
  slh_dsa_sha2_128s: { signatureBytes: 7856,  publicKeyBytes: 32,  secretKeyBytes: 64,  nistLevel: 1, standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)' },
  slh_dsa_sha2_128f: { signatureBytes: 17088, publicKeyBytes: 32,  secretKeyBytes: 64,  nistLevel: 1, standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)' },
  slh_dsa_sha2_192s: { signatureBytes: 16224, publicKeyBytes: 48,  secretKeyBytes: 96,  nistLevel: 3, standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)' },
  slh_dsa_sha2_192f: { signatureBytes: 35664, publicKeyBytes: 48,  secretKeyBytes: 96,  nistLevel: 3, standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)' },
  slh_dsa_sha2_256s: { signatureBytes: 29792, publicKeyBytes: 64,  secretKeyBytes: 128, nistLevel: 5, standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)' },
  slh_dsa_sha2_256f: { signatureBytes: 49856, publicKeyBytes: 64,  secretKeyBytes: 128, nistLevel: 5, standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)' },
};

// ============================================================
// HELPERS
// ============================================================

function toBytes(input) {
  if (typeof input === 'string') {
    if (input.startsWith('0x') || input.startsWith('0X')) {
      const hex = input.slice(2);
      const buf = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        buf[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return buf;
    }
    return new TextEncoder().encode(input);
  }
  if (Buffer.isBuffer(input)) return new Uint8Array(input);
  if (input instanceof Uint8Array) return input;
  return new TextEncoder().encode(String(input));
}

function bytesToHex(bytes) {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// FALCON KEY GENERATION
// ============================================================

export async function generateFalconKeys(variant = 'falcon512') {
  if (!FALCON_PARAMS[variant]) throw new Error(`Unknown FALCON variant: ${variant}`);

  const params = FALCON_PARAMS[variant];

  // Use master keypair for falcon512 (fixed key for all API signatures)
  if (variant === 'falcon512') {
    return {
      variant,
      algorithm: 'FALCON',
      standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
      nistLevel: params.nistLevel,
      publicKey: bytesToHex(MASTER_PK),
      secretKey: bytesToHex(MASTER_SK),
      seed: bytesToHex(MASTER_SEED),
      publicKeyBytes: MASTER_PK.length,
      secretKeyBytes: MASTER_SK.length,
      signatureBytes: params.signatureBytes,
      quantumResistant: true,
      latticeBased: true,
      hardProblem: 'NTRU Short Integer Solution (SIS)',
      generated: new Date().toISOString(),
    };
  }

  // For falcon1024, generate random keys (master not defined for 1024 yet)
  const seed = randomBytes(48);
  const noble = falcon1024;
  const keys = noble.keygen(seed);

  return {
    variant,
    algorithm: 'FALCON',
    standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
    nistLevel: params.nistLevel,
    publicKey: bytesToHex(keys.publicKey),
    secretKey: bytesToHex(keys.secretKey),
    seed: bytesToHex(seed),
    publicKeyBytes: keys.publicKey.length,
    secretKeyBytes: keys.secretKey.length,
    signatureBytes: params.signatureBytes,
    quantumResistant: true,
    latticeBased: true,
    hardProblem: 'NTRU Short Integer Solution (SIS)',
    generated: new Date().toISOString(),
  };
}

// ============================================================
// FALCON SIGNING
// ============================================================

export async function signMessage(message, secretKeyHex, variant = 'falcon512') {
  if (!FALCON_PARAMS[variant]) throw new Error(`Unknown FALCON variant: ${variant}`);
  if (!message && message !== '') throw new Error('Message required');
  if (!secretKeyHex) throw new Error('Secret key required');

  const noble = variant === 'falcon1024' ? falcon1024 : falcon512;
  const msgBytes = toBytes(message);
  const skBytes = toBytes(secretKeyHex);

  const sigBytes = noble.sign(msgBytes, skBytes);

  return {
    signature: bytesToHex(sigBytes),
    signatureBytes: sigBytes.length,
    message: typeof message === 'string' ? message : bytesToHex(msgBytes),
    variant,
    algorithm: 'FALCON',
    standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
    nistLevel: FALCON_PARAMS[variant].nistLevel,
    quantumResistant: true,
    latticeBased: true,
  };
}

// ============================================================
// FALCON VERIFICATION
// ============================================================

export async function verifySignature(message, signatureHex, publicKeyHex, variant = 'falcon512') {
  if (!FALCON_PARAMS[variant]) throw new Error(`Unknown FALCON variant: ${variant}`);
  if (!message && message !== '') throw new Error('Message required');
  if (!signatureHex) throw new Error('Signature required');
  if (!publicKeyHex) throw new Error('Public key required');

  const noble = variant === 'falcon1024' ? falcon1024 : falcon512;
  const msgBytes = toBytes(message);
  const sigBytes = toBytes(signatureHex);
  const pkBytes = toBytes(publicKeyHex);

  let valid = false;
  try {
    valid = noble.verify(sigBytes, msgBytes, pkBytes);
  } catch {
    valid = false;
  }

  return {
    valid,
    signatureLength: sigBytes.length,
    expectedLength: FALCON_PARAMS[variant].signatureBytes,
    message: typeof message === 'string' ? message : bytesToHex(msgBytes),
    variant,
    algorithm: 'FALCON',
    standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
    nistLevel: FALCON_PARAMS[variant].nistLevel,
    quantumResistant: true,
    latticeBased: true,
    verifiedAt: new Date().toISOString(),
  };
}

// ============================================================
// HYBRID SIGNING: ECDSA + FALCON (dual signature)
// ============================================================

export async function hybridSign(message, falconSecretKeyHex, classicSignatureHex, variant = 'falcon512') {
  const falconResult = await signMessage(message, falconSecretKeyHex, variant);
  return {
    hybrid: true,
    falcon: {
      signature: falconResult.signature,
      algorithm: `FALCON-${variant === 'falcon512' ? '512' : '1024'}`,
      standard: 'Falcon Round 3',
      quantumResistant: true,
    },
    classic: {
      signature: classicSignatureHex,
      algorithm: 'ECDSA (secp256k1)',
      quantumResistant: false,
    },
    message: typeof message === 'string' ? message : bytesToHex(toBytes(message)),
    security: 'If quantum computer breaks ECDSA, FALCON still protects integrity',
    bothRequired: true,
    generated: new Date().toISOString(),
  };
}

// ============================================================
// ML-DSA (Dilithium) KEY GENERATION
// ============================================================

export async function generateDilithiumKeys(variant = 'ml_dsa65') {
  if (!ML_DSA_PARAMS[variant]) throw new Error(`Unknown ML-DSA variant: ${variant}`);

  const params = ML_DSA_PARAMS[variant];
  const seed = randomBytes(32);
  const noble = variant === 'ml_dsa44' ? ml_dsa44 : variant === 'ml_dsa87' ? ml_dsa87 : ml_dsa65;
  const keys = noble.keygen(seed);

  return {
    variant,
    algorithm: 'ML-DSA',
    standard: 'NIST FIPS 204',
    nistLevel: params.nistLevel,
    publicKey: bytesToHex(keys.publicKey),
    secretKey: bytesToHex(keys.secretKey),
    seed: bytesToHex(seed),
    publicKeyBytes: keys.publicKey.length,
    secretKeyBytes: keys.secretKey.length,
    signatureBytes: params.signatureBytes,
    k: params.k,
    l: params.l,
    eta: params.eta,
    quantumResistant: true,
    latticeBased: true,
    hardProblem: 'Module-LWE / Module-SIS',
    generated: new Date().toISOString(),
  };
}

// ============================================================
// ML-DSA (Dilithium) SIGNING
// ============================================================

export async function signMessageDilithium(message, secretKeyHex, variant = 'ml_dsa65') {
  if (!ML_DSA_PARAMS[variant]) throw new Error(`Unknown ML-DSA variant: ${variant}`);
  if (!message && message !== '') throw new Error('Message required');
  if (!secretKeyHex) throw new Error('Secret key required');

  const noble = variant === 'ml_dsa44' ? ml_dsa44 : variant === 'ml_dsa87' ? ml_dsa87 : ml_dsa65;
  const msgBytes = toBytes(message);
  const skBytes = toBytes(secretKeyHex);

  const sigBytes = noble.sign(msgBytes, skBytes);

  return {
    signature: bytesToHex(sigBytes),
    signatureBytes: sigBytes.length,
    message: typeof message === 'string' ? message : bytesToHex(msgBytes),
    variant,
    algorithm: 'ML-DSA',
    standard: 'NIST FIPS 204',
    nistLevel: ML_DSA_PARAMS[variant].nistLevel,
    quantumResistant: true,
    latticeBased: true,
    hardProblem: 'Module-LWE / Module-SIS',
  };
}

// ============================================================
// ML-DSA (Dilithium) VERIFICATION
// ============================================================

export async function verifySignatureDilithium(message, signatureHex, publicKeyHex, variant = 'ml_dsa65') {
  if (!ML_DSA_PARAMS[variant]) throw new Error(`Unknown ML-DSA variant: ${variant}`);
  if (!message && message !== '') throw new Error('Message required');
  if (!signatureHex) throw new Error('Signature required');
  if (!publicKeyHex) throw new Error('Public key required');

  const noble = variant === 'ml_dsa44' ? ml_dsa44 : variant === 'ml_dsa87' ? ml_dsa87 : ml_dsa65;
  const msgBytes = toBytes(message);
  const sigBytes = toBytes(signatureHex);
  const pkBytes = toBytes(publicKeyHex);

  let valid = false;
  try {
    valid = noble.verify(sigBytes, msgBytes, pkBytes);
  } catch {
    valid = false;
  }

  return {
    valid,
    signatureLength: sigBytes.length,
    expectedLength: ML_DSA_PARAMS[variant].signatureBytes,
    message: typeof message === 'string' ? message : bytesToHex(msgBytes),
    variant,
    algorithm: 'ML-DSA',
    standard: 'NIST FIPS 204',
    nistLevel: ML_DSA_PARAMS[variant].nistLevel,
    quantumResistant: true,
    latticeBased: true,
    verifiedAt: new Date().toISOString(),
  };
}

// ============================================================
// ML-KEM (Kyber) KEY ENCAPSULATION
// ============================================================

const ML_KEM_VARIANT_MAP = {
  ml_kem512:  ml_kem512,
  ml_kem768:  ml_kem768,
  ml_kem1024: ml_kem1024,
};

export async function generateKEMKeys(variant = 'ml_kem512') {
  if (!ML_KEM_PARAMS[variant]) throw new Error(`Unknown ML-KEM variant: ${variant}`);
  const params = ML_KEM_PARAMS[variant];
  const noble = ML_KEM_VARIANT_MAP[variant];
  const seed = randomBytes(32);
  const keys = noble.keygen(seed);
  return {
    variant,
    algorithm: 'ML-KEM',
    standard: params.standard,
    nistLevel: params.nistLevel,
    publicKey: bytesToHex(keys.publicKey),
    secretKey: bytesToHex(keys.secretKey),
    publicKeyBytes: keys.publicKey.length,
    secretKeyBytes: keys.secretKey.length,
    ciphertextBytes: params.ciphertextBytes,
    quantumResistant: true,
    latticeBased: true,
    hardProblem: 'Module-LWE',
  };
}

export async function encapsulateKEM(publicKeyHex, variant = 'ml_kem512') {
  if (!ML_KEM_PARAMS[variant]) throw new Error(`Unknown ML-KEM variant: ${variant}`);
  const noble = ML_KEM_VARIANT_MAP[variant];
  const pkBytes = toBytes(publicKeyHex);
  const result = noble.encapsulate(pkBytes);
  return {
    ciphertext: bytesToHex(result.ciphertext),
    sharedSecret: bytesToHex(result.sharedSecret),
    ciphertextBytes: result.ciphertext.length,
    variant,
    algorithm: 'ML-KEM',
    standard: ML_KEM_PARAMS[variant].standard,
    nistLevel: ML_KEM_PARAMS[variant].nistLevel,
    quantumResistant: true,
  };
}

export async function decapsulateKEM(ciphertextHex, secretKeyHex, variant = 'ml_kem512') {
  if (!ML_KEM_PARAMS[variant]) throw new Error(`Unknown ML-KEM variant: ${variant}`);
  const noble = ML_KEM_VARIANT_MAP[variant];
  const ctBytes = toBytes(ciphertextHex);
  const skBytes = toBytes(secretKeyHex);
  const sharedSecret = noble.decapsulate(ctBytes, skBytes);
  return {
    sharedSecret: bytesToHex(sharedSecret),
    variant,
    algorithm: 'ML-KEM',
    standard: ML_KEM_PARAMS[variant].standard,
    nistLevel: ML_KEM_PARAMS[variant].nistLevel,
    quantumResistant: true,
  };
}

// ============================================================
// SLH-DSA (SPHINCS+) HASH-BASED SIGNATURES
// ============================================================

const SLH_DSA_VARIANT_MAP = {
  slh_dsa_sha2_128s: slh_dsa_sha2_128s,
  slh_dsa_sha2_128f: slh_dsa_sha2_128f,
  slh_dsa_sha2_192s: slh_dsa_sha2_192s,
  slh_dsa_sha2_192f: slh_dsa_sha2_192f,
  slh_dsa_sha2_256s: slh_dsa_sha2_256s,
  slh_dsa_sha2_256f: slh_dsa_sha2_256f,
};

export async function generateSPHINCSKeys(variant = 'slh_dsa_sha2_128s') {
  if (!SLH_DSA_PARAMS[variant]) throw new Error(`Unknown SLH-DSA variant: ${variant}`);
  const params = SLH_DSA_PARAMS[variant];
  const noble = SLH_DSA_VARIANT_MAP[variant];
  const seed = randomBytes(32);
  const keys = noble.keygen(seed);
  return {
    variant,
    algorithm: 'SLH-DSA',
    standard: params.standard,
    nistLevel: params.nistLevel,
    publicKey: bytesToHex(keys.publicKey),
    secretKey: bytesToHex(keys.secretKey),
    publicKeyBytes: keys.publicKey.length,
    secretKeyBytes: keys.secretKey.length,
    signatureBytes: params.signatureBytes,
    quantumResistant: true,
    hashBased: true,
    hardProblem: 'Hash function security',
  };
}

export async function signMessageSPHINCS(message, secretKeyHex, variant = 'slh_dsa_sha2_128s') {
  if (!SLH_DSA_PARAMS[variant]) throw new Error(`Unknown SLH-DSA variant: ${variant}`);
  if (!message && message !== '') throw new Error('Message required');
  if (!secretKeyHex) throw new Error('Secret key required');

  const noble = SLH_DSA_VARIANT_MAP[variant];
  const msgBytes = toBytes(message);
  const skBytes = toBytes(secretKeyHex);
  const sigBytes = noble.sign(msgBytes, skBytes);

  return {
    signature: bytesToHex(sigBytes),
    signatureBytes: sigBytes.length,
    message: typeof message === 'string' ? message : bytesToHex(msgBytes),
    variant,
    algorithm: 'SLH-DSA',
    standard: SLH_DSA_PARAMS[variant].standard,
    nistLevel: SLH_DSA_PARAMS[variant].nistLevel,
    quantumResistant: true,
    hashBased: true,
  };
}

export async function verifySignatureSPHINCS(message, signatureHex, publicKeyHex, variant = 'slh_dsa_sha2_128s') {
  if (!SLH_DSA_PARAMS[variant]) throw new Error(`Unknown SLH-DSA variant: ${variant}`);
  if (!message && message !== '') throw new Error('Message required');
  if (!signatureHex) throw new Error('Signature required');
  if (!publicKeyHex) throw new Error('Public key required');

  const noble = SLH_DSA_VARIANT_MAP[variant];
  const msgBytes = toBytes(message);
  const sigBytes = toBytes(signatureHex);
  const pkBytes = toBytes(publicKeyHex);

  let valid = false;
  try {
    valid = noble.verify(sigBytes, msgBytes, pkBytes);
  } catch {
    valid = false;
  }

  return {
    valid,
    signatureLength: sigBytes.length,
    expectedLength: SLH_DSA_PARAMS[variant].signatureBytes,
    message: typeof message === 'string' ? message : bytesToHex(msgBytes),
    variant,
    algorithm: 'SLH-DSA',
    standard: SLH_DSA_PARAMS[variant].standard,
    nistLevel: SLH_DSA_PARAMS[variant].nistLevel,
    quantumResistant: true,
    hashBased: true,
    verifiedAt: new Date().toISOString(),
  };
}

// ============================================================
// UNIFIED PQC INTERFACE
// ============================================================

export async function generatePQCKeys(algorithm = 'falcon', variant) {
  switch (algorithm.toLowerCase()) {
    case 'falcon':   return generateFalconKeys(variant || 'falcon512');
    case 'ml-dsa':
    case 'dilithium': return generateDilithiumKeys(variant || 'ml_dsa65');
    case 'ml-kem':
    case 'kyber':    return generateKEMKeys(variant || 'ml_kem512');
    case 'slh-dsa':
    case 'sphincs':  return generateSPHINCSKeys(variant || 'slh_dsa_sha2_128s');
    default: throw new Error(`Unknown PQC algorithm: ${algorithm}. Supported: falcon, ml-dsa, ml-kem, slh-dsa`);
  }
}

export async function signPQC(message, secretKey, algorithm = 'falcon', variant) {
  switch (algorithm.toLowerCase()) {
    case 'falcon':   return signMessage(message, secretKey, variant || 'falcon512');
    case 'ml-dsa':
    case 'dilithium': return signMessageDilithium(message, secretKey, variant || 'ml_dsa65');
    case 'slh-dsa':
    case 'sphincs':  return signMessageSPHINCS(message, secretKey, variant || 'slh_dsa_sha2_128s');
    default: throw new Error(`Unknown PQC algorithm: ${algorithm}`);
  }
}

export async function verifyPQC(message, signature, publicKey, algorithm = 'falcon', variant) {
  switch (algorithm.toLowerCase()) {
    case 'falcon':   return verifySignature(message, signature, publicKey, variant || 'falcon512');
    case 'ml-dsa':
    case 'dilithium': return verifySignatureDilithium(message, signature, publicKey, variant || 'ml_dsa65');
    case 'slh-dsa':
    case 'sphincs':  return verifySignatureSPHINCS(message, signature, publicKey, variant || 'slh_dsa_sha2_128s');
    default: throw new Error(`Unknown PQC algorithm: ${algorithm}`);
  }
}

// ============================================================
// FALCON INFO / METADATA
// ============================================================

export function getFalconInfo() {
  return {
    name: 'FALCON',
    fullName: 'Fast-Fourier Lattice-based Compact Signatures over NTRU',
    standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
    library: '@noble/post-quantum v0.6.1+',
    status: 'active',
    securityLevel: '128-bit (FALCON-512) / 256-bit (FALCON-1024) quantum security',
    variants: {
      falcon512: {
        nistLevel: 1,
        signatureBytes: 666,
        publicKeyBytes: 897,
        secretKeyBytes: 1281,
        security: '128-bit classical / 128-bit quantum',
      },
      falcon1024: {
        nistLevel: 5,
        signatureBytes: 1280,
        publicKeyBytes: 1793,
        secretKeyBytes: 2305,
        security: '256-bit classical / 256-bit quantum',
      },
    },
    comparison: {
      ECDSA_secp256k1: { signatureBytes: 64, publicKeyBytes: 33, quantumResistant: false },
      FALCON_512:      { signatureBytes: 666, publicKeyBytes: 897, quantumResistant: true },
      FALCON_1024:     { signatureBytes: 1280, publicKeyBytes: 1793, quantumResistant: true },
      ML_DSA_65:       { signatureBytes: 3309, publicKeyBytes: 1952, quantumResistant: true },
      ML_KEM_512:      { ciphertextBytes: 768, publicKeyBytes: 800, quantumResistant: true },
      SLH_DSA_128s:    { signatureBytes: 7856, publicKeyBytes: 32, quantumResistant: true },
    },
    algorithms: ['FALCON', 'ML-DSA', 'ML-KEM', 'SLH-DSA'],
    nistStandards: {
      'FIPS 206': 'FN-DSA (Falcon) — lattice signatures',
      'FIPS 204': 'ML-DSA (Dilithium) — lattice signatures',
      'FIPS 203': 'ML-KEM (Kyber) — lattice key encapsulation',
      'FIPS 205': 'SLH-DSA (SPHINCS+) — hash-based signatures',
    },
    hardProblem: 'NTRU Short Integer Solution (SIS)',
    latticeBased: true,
    quantumResistant: true,
    eva01: {
      vessel: 'EVA-01',
      module: 'Module 2: Signatures Post-Quantiques',
      domain: 'quantum.depin',
      status: 'active',
      layer: 'NFT quantum-resistant signature layer for eva-01.depin',
    },
    fleursDeLys: {
      integration: 'pqc.js API',
      purpose: 'Verify quantum-resistant signatures on domain ownership',
      useCase: 'Protect eva-01.depin NFT from future quantum attacks',
      endpoints: [
        'POST /api/pqc.js?action=keys — Generate FALCON/ML-DSA key pair',
        'POST /api/pqc.js?action=sign — Sign message',
        'POST /api/pqc.js?action=verify — Verify signature',
        'POST /api/pqc.js?action=hybrid — Hybrid ECDSA+FALCON sign',
        'GET  /api/pqc.js?action=info — Algorithm info',
      ],
    },
  };
}

