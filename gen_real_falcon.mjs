import { falcon512 } from '@noble/post-quantum/falcon.js';
import { randomBytes } from '@noble/post-quantum/utils.js';

// Generate real FALCON-512 keypair
const seed = randomBytes(48);
const keys = falcon512.keygen(seed);

const pkHex = '0x' + Buffer.from(keys.publicKey).toString('hex');
const skHex = '0x' + Buffer.from(keys.secretKey).toString('hex');
const seedHex = '0x' + Buffer.from(seed).toString('hex');

// Verify no repeating patterns
const pk = keys.publicKey;
let maxRepeats = 0;
for (let i = 0; i < pk.length - 32; i += 32) {
    const chunk = pk.slice(i, i + 32).toString('hex');
    let count = 0;
    for (let j = 0; j < pk.length - 32; j += 32) {
        if (pk.slice(j, j + 32).toString('hex') === chunk) count++;
    }
    if (count > maxRepeats) maxRepeats = count;
}

// Sign a test message to prove it works
const testMsg = Buffer.from('test');
const sig = falcon512.sign(testMsg, keys.secretKey);
const valid = falcon512.verify(sig, testMsg, keys.publicKey);

console.log('FALCON-512 Keypair generated with @noble/post-quantum v0.6.1');
console.log('');
console.log('Seed:', seedHex);
console.log('');
console.log('Public Key (897 bytes = 1794 hex chars):');
console.log(pkHex);
console.log('');
console.log('Secret Key (1281 bytes = 2562 hex chars):');
console.log(skHex);
console.log('');
console.log('Max chunk repeats:', maxRepeats, '(1 = no repeats = real crypto)');
console.log('Signature test:', valid ? 'PASS' : 'FAIL');
console.log('Signature size:', sig.length, 'bytes');
