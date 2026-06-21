// js/falcon-pqc.js
// ============================================================
// FALCON Post-Quantum Cryptography — Client-side wrapper
// Uses @noble/post-quantum (v0.6.1+) via ESM CDN
// Exposes window.falconPQC for wallet3.js
// ============================================================

import { falcon512, falcon1024 } from 'https://cdn.jsdelivr.net/npm/@noble/post-quantum@0.6.1/falcon.js/+esm';
import { ml_dsa65 } from 'https://cdn.jsdelivr.net/npm/@noble/post-quantum@0.6.1/ml-dsa.js/+esm';
import { ml_kem512, ml_kem768, ml_kem1024 } from 'https://cdn.jsdelivr.net/npm/@noble/post-quantum@0.6.1/ml-kem.js/+esm';
import { slh_dsa_sha2_128s, slh_dsa_sha2_128f } from 'https://cdn.jsdelivr.net/npm/@noble/post-quantum@0.6.1/slh-dsa.js/+esm';
import { randomBytes } from 'https://cdn.jsdelivr.net/npm/@noble/post-quantum@0.6.1/utils.js/+esm';

function toBytes(input) {
    if (typeof input === 'string') {
        if (input.startsWith('0x') || input.startsWith('0X')) {
            const hex = input.slice(2);
            const buf = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) buf[i / 2] = parseInt(hex.substr(i, 2), 16);
            return buf;
        }
        return new TextEncoder().encode(input);
    }
    if (input instanceof Uint8Array) return input;
    if (typeof input === 'object' && input !== null) return new TextEncoder().encode(String(input));
    return new Uint8Array(0);
}

function bytesToHex(bytes) {
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
}

const FALCON_PARAMS = {
    falcon512:  { signatureBytes: 666,  publicKeyBytes: 897,  secretKeyBytes: 1281, nistLevel: 1 },
    falcon1024: { signatureBytes: 1280, publicKeyBytes: 1793, secretKeyBytes: 2305, nistLevel: 5 },
};

// ---- KEY GENERATION ----
async function generateKeys(algorithm, variant) {
    if (!algorithm) algorithm = 'falcon';
    if (!variant) variant = 'falcon512';

    if (algorithm === 'falcon') {
        const params = FALCON_PARAMS[variant];
        if (!params) throw new Error(`Unknown FALCON variant: ${variant}`);
        const seed = randomBytes(48);
        const noble = variant === 'falcon1024' ? falcon1024 : falcon512;
        const keys = noble.keygen(seed);
        return {
            algorithm: 'falcon',
            variant,
            secretKey: bytesToHex(keys.secretKey),
            publicKey: bytesToHex(keys.publicKey),
            signatureBytes: params.signatureBytes,
            nistLevel: params.nistLevel,
            standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)',
            quantumResistant: true,
            latticeBased: true,
        };
    }

    if (algorithm === 'ml-dsa' || algorithm === 'dilithium') {
        const seed = randomBytes(32);
        const keys = ml_dsa65.keygen(seed);
        return {
            algorithm: 'ml-dsa',
            variant: 'ml_dsa65',
            secretKey: bytesToHex(keys.secretKey),
            publicKey: bytesToHex(keys.publicKey),
            signatureBytes: 3309,
            nistLevel: 3,
            standard: 'NIST FIPS 204',
            quantumResistant: true,
            latticeBased: true,
        };
    }

    throw new Error(`Unknown algorithm: ${algorithm}`);
}

// ---- SIGN ----
async function signMessage(message, secretKeyHex, algorithm, variant) {
    if (!variant) variant = 'falcon512';
    const msgBytes = toBytes(message);
    const skBytes = toBytes(secretKeyHex);

    if (algorithm === 'falcon') {
        const noble = variant === 'falcon1024' ? falcon1024 : falcon512;
        const sigBytes = noble.sign(msgBytes, skBytes);
        return {
            signature: bytesToHex(sigBytes),
            signatureBytes: sigBytes.length,
            algorithm: 'falcon',
            variant,
            standard: 'Falcon Round 3',
        };
    }

    if (algorithm === 'ml-dsa' || algorithm === 'dilithium') {
        const sigBytes = ml_dsa65.sign(msgBytes, skBytes);
        return {
            signature: bytesToHex(sigBytes),
            signatureBytes: sigBytes.length,
            algorithm: 'ml-dsa',
            variant: 'ml_dsa65',
            standard: 'NIST FIPS 204',
        };
    }

    throw new Error(`Unknown algorithm: ${algorithm}`);
}

// ---- VERIFY ----
async function verifyMessage(message, signatureHex, publicKeyHex, algorithm, variant) {
    if (!variant) variant = 'falcon512';
    const msgBytes = toBytes(message);
    const sigBytes = toBytes(signatureHex);
    const pkBytes = toBytes(publicKeyHex);

    let valid = false;
    try {
        if (algorithm === 'falcon') {
            const noble = variant === 'falcon1024' ? falcon1024 : falcon512;
            valid = noble.verify(sigBytes, msgBytes, pkBytes);
        } else if (algorithm === 'ml-dsa' || algorithm === 'dilithium') {
            valid = ml_dsa65.verify(sigBytes, msgBytes, pkBytes);
        }
    } catch {
        valid = false;
    }

    return {
        valid,
        algorithm: algorithm || 'falcon',
        variant: variant || 'falcon512',
        standard: algorithm === 'ml-dsa' ? 'NIST FIPS 204' : 'Falcon Round 3',
    };
}

// ---- ML-KEM (Kyber) KEY ENCAPSULATION ----
async function generateKEMKeys(variant) {
    if (!variant) variant = 'ml_kem512';
    const seed = randomBytes(32);
    const noble = variant === 'ml_kem768' ? ml_kem768 : variant === 'ml_kem1024' ? ml_kem1024 : ml_kem512;
    const keys = noble.keygen(seed);
    const params = { ml_kem512: { pk: 800, sk: 1632, ct: 768 }, ml_kem768: { pk: 1184, sk: 2400, ct: 1088 }, ml_kem1024: { pk: 1568, sk: 3168, ct: 1568 } }[variant] || { pk: 800, sk: 1632, ct: 768 };
    return {
        algorithm: 'ml-kem', variant,
        publicKey: bytesToHex(keys.publicKey),
        secretKey: bytesToHex(keys.secretKey),
        publicKeyBytes: params.pk, secretKeyBytes: params.sk, ciphertextBytes: params.ct,
        standard: 'NIST FIPS 203 (ML-KEM / Kyber)',
        quantumResistant: true, latticeBased: true,
    };
}

async function encapsulateKEM(publicKeyHex, variant) {
    if (!variant) variant = 'ml_kem512';
    const noble = variant === 'ml_kem768' ? ml_kem768 : variant === 'ml_kem1024' ? ml_kem1024 : ml_kem512;
    const pkBytes = toBytes(publicKeyHex);
    const result = noble.encapsulate(pkBytes);
    return {
        ciphertext: bytesToHex(result.ciphertext),
        sharedSecret: bytesToHex(result.sharedSecret),
        ciphertextBytes: result.ciphertext.length,
        algorithm: 'ml-kem', variant,
        standard: 'NIST FIPS 203',
        quantumResistant: true,
    };
}

async function decapsulateKEM(ciphertextHex, secretKeyHex, variant) {
    if (!variant) variant = 'ml_kem512';
    const noble = variant === 'ml_kem768' ? ml_kem768 : variant === 'ml_kem1024' ? ml_kem1024 : ml_kem512;
    const ctBytes = toBytes(ciphertextHex);
    const skBytes = toBytes(secretKeyHex);
    const sharedSecret = noble.decapsulate(ctBytes, skBytes);
    return {
        sharedSecret: bytesToHex(sharedSecret),
        algorithm: 'ml-kem', variant,
        standard: 'NIST FIPS 203',
        quantumResistant: true,
    };
}

// ---- SLH-DSA (SPHINCS+) HASH-BASED SIGNATURES ----
async function generateSPHINCSKeys(variant) {
    if (!variant) variant = 'slh_dsa_sha2_128s';
    const seed = randomBytes(32);
    const noble = variant === 'slh_dsa_sha2_128f' ? slh_dsa_sha2_128f : slh_dsa_sha2_128s;
    const keys = noble.keygen(seed);
    const params = { slh_dsa_sha2_128s: { pk: 32, sk: 64, sig: 7856 }, slh_dsa_sha2_128f: { pk: 32, sk: 64, sig: 17088 } }[variant] || { pk: 32, sk: 64, sig: 7856 };
    return {
        algorithm: 'slh-dsa', variant,
        publicKey: bytesToHex(keys.publicKey),
        secretKey: bytesToHex(keys.secretKey),
        publicKeyBytes: params.pk, secretKeyBytes: params.sk, signatureBytes: params.sig,
        standard: 'NIST FIPS 205 (SLH-DSA / SPHINCS+)',
        quantumResistant: true, hashBased: true,
    };
}

async function signMessageSPHINCS(message, secretKeyHex, variant) {
    if (!variant) variant = 'slh_dsa_sha2_128s';
    const noble = variant === 'slh_dsa_sha2_128f' ? slh_dsa_sha2_128f : slh_dsa_sha2_128s;
    const msgBytes = toBytes(message);
    const skBytes = toBytes(secretKeyHex);
    const sigBytes = noble.sign(msgBytes, skBytes);
    return {
        signature: bytesToHex(sigBytes),
        signatureBytes: sigBytes.length,
        algorithm: 'slh-dsa', variant,
        standard: 'NIST FIPS 205',
        quantumResistant: true, hashBased: true,
    };
}

async function verifyMessageSPHINCS(message, signatureHex, publicKeyHex, variant) {
    if (!variant) variant = 'slh_dsa_sha2_128s';
    const noble = variant === 'slh_dsa_sha2_128f' ? slh_dsa_sha2_128f : slh_dsa_sha2_128s;
    const msgBytes = toBytes(message);
    const sigBytes = toBytes(signatureHex);
    const pkBytes = toBytes(publicKeyHex);
    let valid = false;
    try { valid = noble.verify(sigBytes, msgBytes, pkBytes); } catch { valid = false; }
    return { valid, algorithm: 'slh-dsa', variant, standard: 'NIST FIPS 205', quantumResistant: true, hashBased: true };
}

// ---- SAVE / LOAD ----
function saveKeys(d) {
    if (!d.algorithm) d.algorithm = 'falcon';
    if (!d.variant) d.variant = 'falcon512';
    localStorage.setItem(`falcon_keys_${d.algorithm}_${d.variant}`, JSON.stringify(d));
}

function loadKeys(a, v) {
    if (!a) a = 'falcon';
    if (!v) v = 'falcon512';
    try { return JSON.parse(localStorage.getItem(`falcon_keys_${a}_${v}`)); }
    catch { return null; }
}

// ---- EXPOSE GLOBALLY ----
window.falconPQC = {
    generateKeys,
    signMessage,
    verifyMessage,
    saveKeys,
    loadKeys,
    generateKEMKeys,
    encapsulateKEM,
    decapsulateKEM,
    generateSPHINCSKeys,
    signMessageSPHINCS,
    verifyMessageSPHINCS,
    FALCON_PARAMS,
    randomBytes: (n) => bytesToHex(randomBytes(n)),
};

console.log('[falconPQC] @noble/post-quantum loaded — FALCON-512/1024 + ML-DSA-65 + ML-KEM + SLH-DSA ready');
