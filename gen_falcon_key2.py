import sys
sys.path.insert(0, 'F:\\fleurs de lys\\falcon-py')

from falcon import Falcon, params

n = 512
f = Falcon(n)

# Key generation
print("Generating FALCON-512 keypair...")
sk, vk = f.keygen()
print(f"Public key length: {len(vk)} bytes")

# The vk might be missing a leading zero byte for the polynomial degree
# Let's try prepending a byte to make it 897
if len(vk) == 896:
    vk_padded = b'\x00' + vk
    print(f"Padded public key length: {len(vk_padded)} bytes")
else:
    vk_padded = vk

# Sign
message = b"Test message"
sig = f.sign(sk, message)
print(f"Signature length: {len(sig)} bytes")

# Try verify with original vk
try:
    valid = f.verify(vk, sig, message)
    print(f"Verify with original vk ({len(vk)} bytes): {valid}")
except Exception as e:
    print(f"Verify with original vk failed: {e}")

# Try verify with padded vk
if len(vk) == 896:
    try:
        valid = f.verify(vk_padded, sig, message)
        print(f"Verify with padded vk ({len(vk_padded)} bytes): {valid}")
    except Exception as e:
        print(f"Verify with padded vk failed: {e}")

# Output the keys
print(f"\n=== PUBLIC KEY (hex) ===")
print(vk.hex())
print(f"\n=== SIGNATURE (hex) ===")
print(sig.hex())
print(f"\n=== SECRET KEY TYPE ===")
print(f"Type: {type(sk)}, Elements: {len(sk)}")
for i, elem in enumerate(sk):
    print(f"  sk[{i}]: type={type(elem)}, len={len(elem) if hasattr(elem, '__len__') else 'N/A'}")
