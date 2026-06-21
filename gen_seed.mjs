import { randomBytes } from '@noble/post-quantum/utils.js';

const seed = randomBytes(48);
console.log(Buffer.from(seed).toString('hex'));
