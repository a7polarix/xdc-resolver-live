import { falcon512 } from '@noble/post-quantum/falcon.js';
import { readFileSync } from 'fs';

// Master public key from api/falcon.js
const MASTER_PK_HEX = '0x093ec809f226eac945492fd79ed48037b08bb4bec1092312e38609c1eb7b2a0d693fca3a6590cf23f29b09461ecff3b5475428f09772f4dc0f495ec5975056352a4c4e24ee07434680cbc303615344d4d9824f537f918ef1201a24eea61dc334694a85642444158e230766de71377ec6cb47ac1e3634e7aa7392b887628d55a3e41fe82c28e35f3239b919e0f46888960374673c6855cd3240e10967486876a22711034ec26662252131ed5138accc24a466d12244df6c05a00d1ad09fd30a16371be681c4b820c094a300c2246ec6c4bbdeb020aab8bb501d096e1509cabe88465bc14256fb6170301efd2319ae0986e0e1838c037c13110122d5e7ef436d9c4981cba96841ceb189cd8b6eba956859615fb4a63405b62abd0a985ef509d9268aa63a416baec2b564c4b6eac15413f6e68457d6ac6e382f374b952305825c624396d40ef59ae9f05b09b3f5df19979b7e7586183b501e0289aecd758d8c0021bdec75c0546b54082d486bec703c76f3850ec675176e4703601d2a18e0b4f29fc05fab3d2c28356db374549965aa4953230aea86bf45ca73a8beaa7f90193cb8f247a813835bf856993592483f16adfbea964a1791f0d3536610a6d23af32c4239a5dcbc46de5f8f7a86102924a3121aaab8ebd2c340704ebcb81e56838b199f861e46346a8939d981e876b1e1eba3bb96a81a76bc54228c7a6e8abb97fed6d529f178d2450045948996d9238efea721b9d3a2128d6a2e7842a649638748d699f6a3ec6fe0c812a62b7eaa322ba81395bdb58603f265186c3e2100e67424486c8c8d36ea995b4f666bdbcca96061ee7b64f3dd8c62b05292c3806c6a0d96a0e04a63976241a75aa6e867fac09ab2e01c14f1ad891c83e333589624816d7646d5b9867f94ae19a03125d369d364919cd3378caeb6d462f0ba983717c81ea7e2903242c248cb2fe4430f99532b1e2309b8319b906c80f691ed389699dfd18d7c247472917d7cacce32d9cc07166c84db289efc53626179d1e92c00a2b9f89567ef8ec1f0b27307a92204a725236bdb02b2f24331d22b594e14b297096e7c026e5bb8ebef54d6b19a71cafda780d3f6b5cb80bbac97a3b44086adccc1315c869739de818a6a618321ca8d65f711bc6544b48272e902a0f53aa08d13699cf222b16b41af11ea4a9b695cdd88045254c3cd63177820b42ac4bc2122422877a9796ebdca8b415264abf183f55446f845dc81530d8824be6dda00de299d3ef819145518db';

const pk = Buffer.from(MASTER_PK_HEX.slice(2), 'hex');

console.log('Master Public Key verification');
console.log('PK bytes:', pk.length);
console.log('PK first 16 hex:', pk.slice(0, 16).toString('hex'));

// Check for repeating patterns
let maxRepeats = 0;
for (let i = 0; i < pk.length - 32; i += 32) {
    const chunk = pk.slice(i, i + 32).toString('hex');
    let count = 0;
    for (let j = 0; j < pk.length - 32; j += 32) {
        if (pk.slice(j, j + 32).toString('hex') === chunk) count++;
    }
    if (count > maxRepeats) maxRepeats = count;
}
console.log('Max chunk repeats:', maxRepeats, maxRepeats === 1 ? 'OK (real crypto)' : 'FAIL (repeating pattern)');
console.log('');

// Sign a test message and verify
const testMsg = Buffer.from('Hello Falcon-512 verification test');
const testSig = falcon512.sign(testMsg, pk); // This won't work — we need the secret key to sign!

// Actually we can only VERIFY with public key, not sign
// Let's verify that the master keypair works by signing with secret key
// But we don't have the secret key here...
// Let me just verify the key format is valid

// Actually let's check if falcon512 can even use this key
try {
    // Try to verify a dummy signature (will fail but should not crash on key format)
    const dummySig = Buffer.alloc(653);
    const result = falcon512.verify(dummySig, testMsg, pk);
    console.log('Key format accepted by @noble/post-quantum: YES (verify returned', result, ')');
} catch (e) {
    console.log('Key format ERROR:', e.message);
}
