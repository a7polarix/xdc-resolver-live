"""
Generate real FALCON-512 keypair using the official Python reference implementation.
This is the NIST reference code from https://github.com/tprest/falcon.py
"""
import sys
sys.path.insert(0, r'F:\fleurs de lys\falcon-py')

from falcon import Falcon

# Generate FALCON-512 keypair (NIST Level 1)
print("Generating FALCON-512 keypair with official Python reference implementation...")
f = Falcon(512)
sk, vk = f.keygen()

print(f"Public key (vk) length: {len(vk)} bytes")
print(f"Secret key (sk) type: {type(sk)}, elements: {len(sk)}")

# Sign a test message
message = b"Test message for FALCON-512"
sig = f.sign(sk, message)
print(f"Signature length: {len(sig)} bytes")

# Verify
valid = f.verify(vk, sig, message)
print(f"Signature valid: {valid}")

# Check for repeating patterns
chunk_size = 32
max_repeats = 0
for i in range(0, len(vk) - chunk_size, chunk_size):
    chunk = vk[i:i+chunk_size]
    count = 0
    for j in range(0, len(vk) - chunk_size, chunk_size):
        if vk[j:j+chunk_size] == chunk:
            count += 1
    if count > max_repeats:
        max_repeats = count
print(f"Max chunk repeats: {max_repeats} (1 = real crypto)")

# Output hex
vk_hex = vk.hex()
sig_hex = sig.hex()

print(f"\n=== PUBLIC KEY (hex, {len(vk)} bytes) ===")
print(vk_hex)

print(f"\n=== SIGNATURE (hex, {len(sig)} bytes) ===")
print(sig_hex)

# Also output the secret key components
print(f"\n=== SECRET KEY COMPONENTS ===")
for i, elem in enumerate(sk):
    if isinstance(elem, list):
        print(f"  sk[{i}]: list of {len(elem)} elements")
    else:
        print(f"  sk[{i}]: {type(elem).__name__}")

# Sign a realistic tx hash
tx_hash = bytes.fromhex("d465b1c0c4e12c9d11976d96dd2d64957b27a0beccb2a9ca38c8430b39a25918")
tx_sig = f.sign(sk, tx_hash)
tx_valid = f.verify(vk, tx_sig, tx_hash)
print(f"\n=== TX SIGNATURE ===")
print(f"TX hash: 0x{tx_hash.hex()}")
print(f"TX signature length: {len(tx_sig)} bytes")
print(f"TX signature valid: {tx_valid}")
print(f"TX signature (hex): {tx_sig.hex()}")
