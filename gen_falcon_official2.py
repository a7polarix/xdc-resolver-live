"""
Generate FALCON-512 keypair with official Python falcon.py
Then verify with @noble/post-quantum (KAT-verified JS implementation)
"""
import sys
sys.path.insert(0, r'F:\fleurs de lys\falcon-py')

from falcon import Falcon
import subprocess, json

# Step 1: Generate with Python reference
print("=== STEP 1: Generate with tprest/falcon.py (official Python reference) ===")
f = Falcon(512)
sk, vk = f.keygen()
print(f"PK length: {len(vk)} bytes")
print(f"SK elements: {len(sk)}")

message = b"Test FALCON-512"
sig = f.sign(sk, message)
print(f"Sig length: {len(sig)} bytes")

vk_hex = vk.hex()
sig_hex = sig.hex()

# Step 2: Verify with @noble/post-quantum via Node.js
print("\n=== STEP 2: Verify with @noble/post-quantum (KAT-verified) ===")

node_code = f"""
import {{ falcon512 }} from '@noble/post-quantum/falcon.js';

const pk = Buffer.from('{vk_hex}', 'hex');
const sig = Buffer.from('{sig_hex}', 'hex');
const msg = Buffer.from('Test FALCON-512');

console.log('PK bytes:', pk.length);
console.log('Sig bytes:', sig.length);

try {{
    const valid = falcon512.verify(sig, msg, pk);
    console.log('VERIFY RESULT:', valid);
}} catch(e) {{
    console.log('VERIFY ERROR:', e.message);
    
    // Try with padded PK (897 bytes)
    if (pk.length === 896) {{
        const pkPadded = Buffer.concat([Buffer.from([0x00]), pk]);
        console.log('Padded PK bytes:', pkPadded.length);
        try {{
            const valid2 = falcon512.verify(sig, msg, pkPadded);
            console.log('VERIFY WITH PADDED PK:', valid2);
        }} catch(e2) {{
            console.log('PADDED VERIFY ERROR:', e2.message);
        }}
    }}
}}
"""

result = subprocess.run(
    ['node', '--input-type=module', '-e', node_code],
    capture_output=True, text=True, timeout=30
)
print("STDOUT:", result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])

# Step 3: Check for repeating patterns
print("\n=== STEP 3: Pattern analysis ===")
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
print(f"Max chunk repeats: {max_repeats}")

# Step 4: Output for API integration
print(f"\n=== OUTPUT FOR API ===")
print(f"PK (hex): 0x{vk_hex}")
print(f"PK length: {len(vk)} bytes")
print(f"Sig (hex): 0x{sig_hex}")
print(f"Sig length: {len(sig)} bytes")

# Save to file for easy retrieval
with open(r'F:\fleurs de lys\falcon_key_official.txt', 'w') as out:
    out.write(f"FALCON-512 KEYPAIR (tprest/falcon.py official reference)\n")
    out.write(f"Generated: {__import__('datetime').datetime.now().isoformat()}\n\n")
    out.write(f"PUBLIC KEY ({len(vk)} bytes):\n0x{vk_hex}\n\n")
    out.write(f"SIGNATURE ({len(sig)} bytes):\n0x{sig_hex}\n")
print("\nSaved to falcon_key_official.txt")
