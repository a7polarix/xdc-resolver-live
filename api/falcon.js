// api/falcon.js
// FALCON — Post-Quantum Signature Module for EVA-01
import { falcon512, falcon1024 } from '@noble/post-quantum/falcon.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { randomBytes } from '@noble/post-quantum/utils.js';

export async function generateFalconKeys(variant = 'falcon512') {
    const seed = randomBytes(48);
    const fn = variant === 'falcon1024' ? falcon1024 : falcon512;
    const keys = fn.keygen(seed);
    return {
        variant,
        publicKey: Buffer.from(keys.publicKey).toString('hex'),
        secretKey: Buffer.from(keys.secretKey).toString('hex'),
        publicKeyBytes: keys.publicKey.length,
        secretKeyBytes: keys.secretKey.length,
    };
}

export async function generateDilithiumKeys() {
    const seed = randomBytes(32);
    const keys = ml_dsa65.keygen(seed);
    return {
        variant: 'ml_dsa65',
        publicKey: Buffer.from(keys.publicKey).toString('hex'),
        secretKey: Buffer.from(keys.secretKey).toString('hex'),
        publicKeyBytes: keys.publicKey.length,
        secretKeyBytes: keys.secretKey.length,
    };
}

export async function signMessage(message, secretKeyHex, variant = 'falcon512') {
    const fn = variant === 'falcon1024' ? falcon1024 : falcon512;
    const secretKey = new Uint8Array(Buffer.from(secretKeyHex, 'hex'));
    const msg = new TextEncoder().encode(message);
    const sig = fn.sign(msg, secretKey);
    return {
        signature: Buffer.from(sig).toString('hex'),
        signatureBytes: sig.length,
        message,
        variant,
        algorithm: 'FALCON',
        standard: 'NIST PQC Round 3',
    };
}

export async function signMessageDilithium(message, secretKeyHex) {
    const secretKey = new Uint8Array(Buffer.from(secretKeyHex, 'hex'));
    const msg = new TextEncoder().encode(message);
    const sig = ml_dsa65.sign(msg, secretKey);
    return {
        signature: Buffer.from(sig).toString('hex'),
        signatureBytes: sig.length,
        message,
        variant: 'ml_dsa65',
        algorithm: 'ML-DSA (Dilithium)',
        standard: 'NIST FIPS 204',
    };
}

export async function verifySignature(message, signatureHex, publicKeyHex, variant = 'falcon512') {
    const fn = variant === 'falcon1024' ? falcon1024 : falcon512;
    const publicKey = new Uint8Array(Buffer.from(publicKeyHex, 'hex'));
    const signature = new Uint8Array(Buffer.from(signatureHex, 'hex'));
    const msg = new TextEncoder().encode(message);
    const isValid = fn.verify(signature, msg, publicKey);
    return { valid: isValid, message, variant, algorithm: 'FALCON' };
}

export async function verifySignatureDilithium(message, signatureHex, publicKeyHex) {
    const publicKey = new Uint8Array(Buffer.from(publicKeyHex, 'hex'));
    const signature = new Uint8Array(Buffer.from(signatureHex, 'hex'));
    const msg = new TextEncoder().encode(message);
    const isValid = ml_dsa65.verify(signature, msg, publicKey);
    return { valid: isValid, message, variant: 'ml_dsa65', algorithm: 'ML-DSA' };
}

export function getFalconInfo() {
    return {
        name: 'FALCON',
        standard: 'NIST PQC Round 3',
        algorithm: 'Fast-Fourier Lattice-based Compact Signatures over NTRU',
        securityLevel: '128-bit quantum security',
        variants: {
            falcon512: { signatureBytes: 666, publicKeyBytes: 897, secretKeyBytes: 1281 },
            falcon1024: { signatureBytes: 1280, publicKeyBytes: 1793, secretKeyBytes: 2305 },
        },
        dilithium: { ml_dsa65: { signatureBytes: 3293, publicKeyBytes: 1952, secretKeyBytes: 4032 } },
        comparison: {
            ECDSA: { signatureBytes: 64, quantumResistant: false },
            FALCON_512: { signatureBytes: 666, quantumResistant: true },
            Dilithium_65: { signatureBytes: 3293, quantumResistant: true },
        },
    };
}
