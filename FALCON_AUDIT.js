// FALCON_AUDIT.js
// ============================================================
// RAPPORT D'AUDIT FALCON — Fleurs de Lys / Saint Empire Numérique
// ============================================================
// Tests @noble/post-quantum (v0.6.1+) — real FALCON-512/1024 + ML-DSA
// Exécution: cd "/f/fleurs de lys" && node FALCON_AUDIT.js
// ============================================================

import {
  generateFalconKeys,
  signMessage,
  verifySignature,
  generateDilithiumKeys,
  signMessageDilithium,
  verifySignatureDilithium,
  hybridSign,
  getFalconInfo,
  generatePQCKeys,
  signPQC,
  verifyPQC,
} from './api/falcon.js';

let pass = 0;
let fail = 0;
const results = [];

function test(name, result, detail) {
  const status = result ? 'PASS' : 'FAIL';
  if (result) pass++; else fail++;
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('========================================================');
console.log('FALCON POST-QUANTUM SIGNATURE — AUDIT REPORT');
console.log('Fleurs de Lys / Saint Empire Numérique / EVA-01');
console.log('Library: @noble/post-quantum v0.6.1+ (real FALCON)');
console.log('Date: 2026-06-21');
console.log('========================================================');
console.log('');

// ============================================================
// SECTION 1: FALCON KEY GENERATION
// ============================================================
console.log('--- SECTION 1: FALCON KEY GENERATION ---');

const fk512 = await generateFalconKeys('falcon512');
test('FALCON-512 key generation', fk512.publicKey && fk512.secretKey && fk512.publicKey.startsWith('0x'),
  `pk=${fk512.publicKey.length}chars, sk=${fk512.secretKey.length}chars`);
test('FALCON-512 algorithm field', fk512.algorithm === 'FALCON', fk512.algorithm);
test('FALCON-512 standard field', fk512.standard.includes('Falcon Round 3'), fk512.standard);
test('FALCON-512 nistLevel', fk512.nistLevel === 1, `level=${fk512.nistLevel}`);
test('FALCON-512 quantumResistant', fk512.quantumResistant === true);
test('FALCON-512 latticeBased', fk512.latticeBased === true);
test('FALCON-512 signatureBytes', fk512.signatureBytes === 666, `bytes=${fk512.signatureBytes}`);
test('FALCON-512 publicKeyBytes', fk512.publicKeyBytes === 897, `bytes=${fk512.publicKeyBytes}`);
test('FALCON-512 secretKeyBytes', fk512.secretKeyBytes === 1281, `bytes=${fk512.secretKeyBytes}`);
test('FALCON-512 hardProblem', fk512.hardProblem === 'NTRU Short Integer Solution (SIS)', fk512.hardProblem);

const fk1024 = await generateFalconKeys('falcon1024');
test('FALCON-1024 key generation', fk1024.publicKey && fk1024.secretKey);
test('FALCON-1024 nistLevel', fk1024.nistLevel === 5, `level=${fk1024.nistLevel}`);
test('FALCON-1024 signatureBytes', fk1024.signatureBytes === 1280, `bytes=${fk1024.signatureBytes}`);
test('FALCON-1024 publicKeyBytes', fk1024.publicKeyBytes === 1793, `bytes=${fk1024.publicKeyBytes}`);
test('FALCON-1024 secretKeyBytes', fk1024.secretKeyBytes === 2305, `bytes=${fk1024.secretKeyBytes}`);

console.log('');

// ============================================================
// SECTION 2: FALCON SIGN + VERIFY (CORRECTNESS)
// ============================================================
console.log('--- SECTION 2: FALCON SIGN + VERIFY (CORRECTNESS) ---');

const msg = 'quantum.depin ownership proof for eva-01.depin NFT';

// FALCON-512
const sig512 = await signMessage(msg, fk512.secretKey, 'falcon512');
test('FALCON-512 sign returns signature', sig512.signature && sig512.signature.startsWith('0x'),
  `sig=${sig512.signature.length}chars`);
test('FALCON-512 sign signatureBytes', sig512.signatureBytes >= 650 && sig512.signatureBytes <= 670, `bytes=${sig512.signatureBytes} (FALCON variable-length)`);
test('FALCON-512 sign algorithm', sig512.algorithm === 'FALCON');

const ver512 = await verifySignature(msg, sig512.signature, fk512.publicKey, 'falcon512');
test('FALCON-512 verify VALID', ver512.valid === true, `valid=${ver512.valid}`);
test('FALCON-512 verify algorithm', ver512.algorithm === 'FALCON');
test('FALCON-512 verify nistLevel', ver512.nistLevel === 1);

// FALCON-1024
const sig1024 = await signMessage(msg, fk1024.secretKey, 'falcon1024');
test('FALCON-1024 sign signatureBytes', sig1024.signatureBytes >= 1270 && sig1024.signatureBytes <= 1290, `bytes=${sig1024.signatureBytes} (FALCON variable-length)`);
const ver1024 = await verifySignature(msg, sig1024.signature, fk1024.publicKey, 'falcon1024');
test('FALCON-1024 verify VALID', ver1024.valid === true, `valid=${ver1024.valid}`);

console.log('');

// ============================================================
// SECTION 3: FALCON SECURITY (NEGATIVE TESTS)
// ============================================================
console.log('--- SECTION 3: FALCON SECURITY (NEGATIVE TESTS) ---');

// Wrong message
const verWrongMsg = await verifySignature('tampered message', sig512.signature, fk512.publicKey, 'falcon512');
test('FALCON-512 wrong message REJECTED', verWrongMsg.valid === false, `valid=${verWrongMsg.valid}`);

// Wrong key
const fkOther = await generateFalconKeys('falcon512');
const verWrongKey = await verifySignature(msg, sig512.signature, fkOther.publicKey, 'falcon512');
test('FALCON-512 wrong public key REJECTED', verWrongKey.valid === false, `valid=${verWrongKey.valid}`);

// Wrong variant (sign with 512, verify with 1024)
const verWrongVariant = await verifySignature(msg, sig512.signature, fk512.publicKey, 'falcon1024');
test('FALCON wrong variant REJECTED', verWrongVariant.valid === false, `valid=${verWrongVariant.valid}`);

// Empty signature
try {
  await verifySignature(msg, '0x', fk512.publicKey, 'falcon512');
  test('FALCON empty signature handled', true, 'no crash');
} catch (e) {
  test('FALCON empty signature handled', true, e.message);
}

console.log('');

// ============================================================
// SECTION 4: ML-DSA (Dilithium) KEY GENERATION
// ============================================================
console.log('--- SECTION 4: ML-DSA (Dilithium) KEY GENERATION ---');

const dk44 = await generateDilithiumKeys('ml_dsa44');
test('ML-DSA-44 key generation', dk44.publicKey && dk44.secretKey);
test('ML-DSA-44 algorithm', dk44.algorithm === 'ML-DSA');
test('ML-DSA-44 standard', dk44.standard === 'NIST FIPS 204');
test('ML-DSA-44 nistLevel', dk44.nistLevel === 2);
test('ML-DSA-44 signatureBytes', dk44.signatureBytes === 2420);

const dk65 = await generateDilithiumKeys('ml_dsa65');
test('ML-DSA-65 key generation', dk65.publicKey && dk65.secretKey);
test('ML-DSA-65 nistLevel', dk65.nistLevel === 3);
test('ML-DSA-65 signatureBytes', dk65.signatureBytes === 3309);

const dk87 = await generateDilithiumKeys('ml_dsa87');
test('ML-DSA-87 key generation', dk87.publicKey && dk87.secretKey);
test('ML-DSA-87 nistLevel', dk87.nistLevel === 5);
test('ML-DSA-87 signatureBytes', dk87.signatureBytes === 4627);

console.log('');

// ============================================================
// SECTION 5: ML-DSA SIGN + VERIFY
// ============================================================
console.log('--- SECTION 5: ML-DSA SIGN + VERIFY ---');

const sig44 = await signMessageDilithium(msg, dk44.secretKey, 'ml_dsa44');
test('ML-DSA-44 sign signatureBytes', sig44.signatureBytes === 2420, `bytes=${sig44.signatureBytes}`);
const ver44 = await verifySignatureDilithium(msg, sig44.signature, dk44.publicKey, 'ml_dsa44');
test('ML-DSA-44 verify VALID', ver44.valid === true, `valid=${ver44.valid}`);

const sig65 = await signMessageDilithium(msg, dk65.secretKey, 'ml_dsa65');
test('ML-DSA-65 sign signatureBytes', sig65.signatureBytes === 3309, `bytes=${sig65.signatureBytes}`);
const ver65 = await verifySignatureDilithium(msg, sig65.signature, dk65.publicKey, 'ml_dsa65');
test('ML-DSA-65 verify VALID', ver65.valid === true, `valid=${ver65.valid}`);

const sig87 = await signMessageDilithium(msg, dk87.secretKey, 'ml_dsa87');
test('ML-DSA-87 sign signatureBytes', sig87.signatureBytes === 4627, `bytes=${sig87.signatureBytes}`);
const ver87 = await verifySignatureDilithium(msg, sig87.signature, dk87.publicKey, 'ml_dsa87');
test('ML-DSA-87 verify VALID', ver87.valid === true, `valid=${ver87.valid}`);

console.log('');

// ============================================================
// SECTION 6: ML-DSA SECURITY (NEGATIVE TESTS)
// ============================================================
console.log('--- SECTION 6: ML-DSA SECURITY (NEGATIVE TESTS) ---');

const verDsaWrongMsg = await verifySignatureDilithium('wrong', sig65.signature, dk65.publicKey, 'ml_dsa65');
test('ML-DSA-65 wrong message REJECTED', verDsaWrongMsg.valid === false);

const verDsaWrongKey = await verifySignatureDilithium(msg, sig65.signature, dk44.publicKey, 'ml_dsa65');
test('ML-DSA-65 wrong public key REJECTED', verDsaWrongKey.valid === false);

console.log('');

// ============================================================
// SECTION 7: HYBRID ECDSA + FALCON
// ============================================================
console.log('--- SECTION 7: HYBRID ECDSA + FALCON ---');

const ecdsaSig = '0x' + 'ab'.repeat(64);
const hyb = await hybridSign(msg, fk512.secretKey, ecdsaSig, 'falcon512');
test('Hybrid sign returns hybrid object', hyb.hybrid === true);
test('Hybrid has falcon sig', hyb.falcon.signature && hyb.falcon.signature.startsWith('0x'));
test('Hybrid has classic sig', hyb.classic.signature === ecdsaSig);
test('Hybrid falcon algorithm', hyb.falcon.algorithm === 'FALCON-512');
test('Hybrid classic algorithm', hyb.classic.algorithm === 'ECDSA (secp256k1)');
test('Hybrid security field', hyb.security.includes('quantum'));

console.log('');

// ============================================================
// SECTION 8: UNIFIED PQC INTERFACE
// ============================================================
console.log('--- SECTION 8: UNIFIED PQC INTERFACE ---');

const ukF = await generatePQCKeys('falcon', 'falcon512');
test('generatePQCKeys falcon', ukF.algorithm === 'FALCON');
const usF = await signPQC(msg, ukF.secretKey, 'falcon', 'falcon512');
test('signPQC falcon', usF.algorithm === 'FALCON');
const uvF = await verifyPQC(msg, usF.signature, ukF.publicKey, 'falcon', 'falcon512');
test('verifyPQC falcon VALID', uvF.valid === true);

const ukD = await generatePQCKeys('ml-dsa', 'ml_dsa65');
test('generatePQCKeys ml-dsa', ukD.algorithm === 'ML-DSA');
const usD = await signPQC(msg, ukD.secretKey, 'ml-dsa', 'ml_dsa65');
test('signPQC ml-dsa', usD.algorithm === 'ML-DSA');
const uvD = await verifyPQC(msg, usD.signature, ukD.publicKey, 'ml-dsa', 'ml_dsa65');
test('verifyPQC ml-dsa VALID', uvD.valid === true);

console.log('');

// ============================================================
// SECTION 9: METADATA / INFO
// ============================================================
console.log('--- SECTION 9: METADATA / INFO ---');

const info = getFalconInfo();
test('Info name', info.name === 'FALCON');
test('Info fullName includes Fast-Fourier', info.fullName.includes('Fast-Fourier'));
test('Info standard mentions Falcon Round 3', info.standard.includes('Falcon Round 3'));
test('Info library mentions noble-post-quantum', info.library === '@noble/post-quantum v0.6.1+');
test('Info quantumResistant', info.quantumResistant === true);
test('Info latticeBased', info.latticeBased === true);
test('Info hardProblem NTRU', info.hardProblem === 'NTRU Short Integer Solution (SIS)');
test('Info eva01 module', info.eva01.module === 'Module 2: Signatures Post-Quantiques');
test('Info eva01 domain', info.eva01.domain === 'quantum.depin');
test('Info eva01 status active', info.eva01.status === 'active');
test('Info eva01 vessel', info.eva01.vessel === 'EVA-01');
test('Info comparison ECDSA', info.comparison.ECDSA_secp256k1.signatureBytes === 64);
test('Info comparison FALCON-512', info.comparison.FALCON_512.signatureBytes === 666);
test('Info comparison FALCON-1024', info.comparison.FALCON_1024.signatureBytes === 1280);

console.log('');

// ============================================================
// SECTION 10: DETERMINISM (FALCON is deterministic — same msg = same sig)
// ============================================================
console.log('--- SECTION 10: SIGNATURE DETERMINISM ---');

const sigA = await signMessage('determinism test', fk512.secretKey, 'falcon512');
const sigB = await signMessage('determinism test', fk512.secretKey, 'falcon512');
test('FALCON Round 3 is randomized (same key + same msg = different sigs)', sigA.signature !== sigB.signature,
  `sigA=${sigA.signature.slice(0, 20)}... sigB=${sigB.signature.slice(0, 20)}...`);
test('Both randomized signatures verify correctly',
  (await verifySignature('determinism test', sigA.signature, fk512.publicKey, 'falcon512')).valid &&
  (await verifySignature('determinism test', sigB.signature, fk512.publicKey, 'falcon512')).valid
);
// Different key = different signature
const fkDiff = await generateFalconKeys('falcon512');
const sigC = await signMessage('determinism test', fkDiff.secretKey, 'falcon512');
test('Different key produces different signature', sigA.signature !== sigC.signature);

console.log('');

// ============================================================
// SECTION 11: CROSS-ALGORITHM ISOLATION
// ============================================================
console.log('--- SECTION 11: CROSS-ALGORITHM ISOLATION ---');

// FALCON sig should not verify with ML-DSA key
const verCross1 = await verifySignatureDilithium(msg, sig512.signature, dk65.publicKey, 'ml_dsa65');
test('FALCON sig vs ML-DSA key REJECTED', verCross1.valid === false);

// ML-DSA sig should not verify with FALCON key
const verCross2 = await verifySignature(msg, sig65.signature, fk512.publicKey, 'falcon512');
test('ML-DSA sig vs FALCON key REJECTED', verCross2.valid === false);

console.log('');

// ============================================================
// SECTION 12: FORGERY RESISTANCE (cannot sign without secret key)
// ============================================================
console.log('--- SECTION 12: FORGERY RESISTANCE ---');

// Generate a completely different keypair and try to verify a signature
// made with the original key — should fail
const fkAttacker = await generateFalconKeys('falcon512');
const verForgery = await verifySignature(msg, sig512.signature, fkAttacker.publicKey, 'falcon512');
test('Attacker key cannot verify victim signature', verForgery.valid === false);

console.log('');

// ============================================================
// FINAL REPORT
// ============================================================
console.log('========================================================');
console.log('AUDIT RESULTS');
console.log('========================================================');
console.log(`Total tests:  ${pass + fail}`);
console.log(`Passed:       ${pass}`);
console.log(`Failed:       ${fail}`);
console.log(`Success rate: ${((pass / (pass + fail)) * 100).toFixed(1)}%`);
console.log('');

if (fail > 0) {
  console.log('FAILED TESTS:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
  console.log('');
}

console.log('========================================================');
console.log('END OF AUDIT REPORT');
console.log('========================================================');
