import sys
sys.path.insert(0, 'F:\\fleurs de lys\\falcon-py')

from falcon import Falcon, params

# Use falcon-512 (NIST Level 1)
n = 512
f = Falcon(n)

# Key generation
print("Generating FALCON-512 keypair...")
sk, vk = f.keygen()
print(f"Public key (vk) length: {len(vk)} bytes (expected 897)")
print(f"Secret key (sk) type: {type(sk)}, length: {len(sk)} elements")

# Sign a test message
message = b"Test message for FALCON-512 signature verification"
print(f"\nSigning message: {message}")
sig = f.sign(sk, message)
print(f"Signature length: {len(sig)} bytes")

# Verify
print("\nVerifying signature...")
valid = f.verify(vk, sig, message)
print(f"Signature valid: {valid}")

# Check for repeating patterns in public key
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
print(f"Max chunk repeats: {max_repeats} (1 = no repeats = real crypto)")

# Output hex for use in JSON
vk_hex = vk.hex() if isinstance(vk, bytes) else vk
sig_hex = sig.hex() if isinstance(sig, bytes) else sig

print(f"\n=== FULL PUBLIC KEY (hex) ===")
print(vk_hex)
print(f"\n=== FULL SIGNATURE (hex) ===")
print(sig_hex)

# Also sign a realistic tx hash
tx_hash = "0x763ef095a2c869f674902c3ba4528f49a16eca94244f8f30fe1a410932b1638e"
tx_bytes = bytes.fromhex(tx_hash[2:])
print(f"\n=== SIGNING TX HASH ===")
print(f"TX hash: {tx_hash}")
tx_sig = f.sign(sk, tx_bytes)
print(f"TX signature length: {len(tx_sig)} bytes")
tx_valid = f.verify(vk, tx_sig, tx_bytes)
print(f"TX signature valid: {tx_valid}")
print(f"TX signature (hex): {tx_sig.hex()}")
