import { falcon512 } from '@noble/post-quantum/falcon.js';
import { readFileSync } from 'fs';

const raw = readFileSync('C:\\Users\\sem\\Downloads\\recu_FDL-2026-763ef0955618_comptable.txt', 'utf8');
const data = JSON.parse(raw);
const f = data.facture;

console.log('=== AUDIT RECU FDL-2026-763ef0955618 ===');
console.log('');

// 1. TX
console.log('1. TX Hash:', f.hash);
console.log('   Date:', f.date, '| Montant:', f.montant);
console.log('   From:', f.emetteur, '-> To:', f.destinataire);
console.log('');

// 2. EIP-712
const eipLen = (f.eip712_signature.length - 2) / 2;
console.log('2. EIP-712 Signature:', eipLen, 'bytes');
if (eipLen === 65) console.log('   Format: ECDSA brute (r+s+v)');
console.log('   Structure eip712 dans JSON:', data.eip712 ? 'PRESENTE' : 'ABSENTE');
console.log('');

// 3. Falcon Public Key
const pkBytes = Buffer.from(f.falcon_public_key.slice(2), 'hex');
console.log('3. Falcon Public Key:');
console.log('   Taille:', pkBytes.length, 'bytes (attendu: 897)', pkBytes.length === 897 ? 'OK' : 'FAIL');

let maxRepeats = 0;
let repeatedChunk = '';
for (let i = 0; i < pkBytes.length - 32; i += 32) {
    const chunk = pkBytes.slice(i, i + 32).toString('hex');
    let count = 0;
    for (let j = 0; j < pkBytes.length - 32; j += 32) {
        if (pkBytes.slice(j, j + 32).toString('hex') === chunk) count++;
    }
    if (count > maxRepeats) { maxRepeats = count; repeatedChunk = chunk; }
}
console.log('   Repetitions max:', maxRepeats, maxRepeats === 1 ? 'OK (pas de repetition)' : 'FAIL');
if (maxRepeats > 1) {
    console.log('   Chunk repete:', repeatedChunk.slice(0, 16) + '...');
    console.log('   >>> MOTIF REPETITIF DETECTE -- FAUSSE CLE');
}
console.log('   Standard:', f.falcon_standard);
console.log('');

// 4. Falcon Signature
const sigBytes = Buffer.from(f.falcon_signature.slice(2), 'hex');
console.log('4. Falcon Signature:');
console.log('   Taille:', sigBytes.length, 'bytes');
const msgBytes = Buffer.from(f.hash.slice(2), 'hex');
let sigValid = false;
try { sigValid = falcon512.verify(sigBytes, msgBytes, pkBytes); } catch(e) { sigValid = false; }
console.log('   Verification @noble/post-quantum:', sigValid ? 'PASS' : 'FAIL');
console.log('');

// 5. SIRET
const siret = f.siret.replace(/\s/g, '');
console.log('5. SIRET:', f.siret, '(longueur:', siret.length, ')', siret.length === 14 ? 'OK' : 'INCOMPLET');
if (siret.length === 14 && /^\d+$/.test(siret)) {
    let sum = 0;
    for (let i = 0; i < 14; i++) { let d = parseInt(siret[i]); if (i%2===1) d*=2; if(d>9) d-=9; sum+=d; }
    console.log('   Luhn:', sum%10===0 ? 'VALIDE' : 'INVALIDE');
}
console.log('');

// 6. EIP-712 structure detail
if (data.eip712) {
    console.log('6. EIP-712 Structure:');
    console.log('   Domain:', JSON.stringify(data.eip712.domain));
    console.log('   Types:', Object.keys(data.eip712.types).join(', '));
    console.log('   PrimaryType:', data.eip712.primaryType);
    console.log('   Message fields:', Object.keys(data.eip712.message).join(', '));
} else {
    console.log('6. EIP-712 Structure: ABSENTE');
}
console.log('');

console.log('=== SCORE FINAL ===');
const pkOK = pkBytes.length === 897 && maxRepeats === 1;
const sigOK = sigValid;
const eipOK = !!data.eip712;
const siretOK = siret.length === 14 && /^\d+$/.test(siret);
console.log('Cle publique FALCON:', pkOK ? 'CONFORME' : 'NON CONFORME');
console.log('Signature FALCON:', sigOK ? 'CONFORME' : 'NON CONFORME');
console.log('Structure EIP-712:', eipOK ? 'CONFORME' : 'NON CONFORME');
console.log('SIRET:', siretOK ? 'CONFORME' : 'NON CONFORME');
console.log('');
console.log('RESULTAT:', (pkOK && sigOK && eipOK && siretOK) ? 'TOUT CONFORME' : 'PROBLEMES DETECTES');
