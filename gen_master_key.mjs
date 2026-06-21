import { falcon512 } from '@noble/post-quantum/falcon.js';
import { randomBytes } from '@noble/post-quantum/utils.js';
import { writeFileSync } from 'fs';

// Generate ONE fixed keypair for the entire API
const seed = randomBytes(48);
const keys = falcon512.keygen(seed);

const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');
const skHex = '0x' + Buffer.from(keys.secretKey).toString('hex');

// Verify
const testMsg = Buffer.from('verify');
const testSig = falcon512.sign(testMsg, keys.secretKey);
const valid = falcon512.verify(testSig, testMsg, keys.publicKey);

console.log('PK:', pkHex);
console.log('SK:', skHex);
console.log('Verify:', valid);
console.log('PK bytes:', keys.publicKey.length);
console.log('SK bytes:', keys.secretKey.length);

// Write to a file for easy copy
writeFileSync('F:\\fleurs de lys\\falcon_master_key.txt',
`FALCON-512 MASTER KEYPAIR
Generated: ${new Date().toISOString()}
Library: @noble/post-quantum v0.6.1

PUBLIC KEY (897 bytes):
${pkHex}

SECRET KEY (1281 bytes):
${skHex}

SEED (48 bytes):
0x${Buffer.from(seed).toString('hex')}

Verification: ${valid ? 'PASS' : 'FAIL'}
`);
console.log('Written to falcon_master_key.txt');
