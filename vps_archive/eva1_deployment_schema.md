# EVA-01.DEPIN — SCHEMA COMPLET DE DEPLOIEMENT
# ==============================================
# A envoyer à ton jumeau sur son PC pour l'implémentation
# ZERO deploiement sans "OK!!!" explicite

---

## PARTIE 1 : SMART CONTRACT — HermesAgent.sol

### 1.1 — Fichier source
**Chemin** : `/root/hermes_coquille/contracts/HermesAgent.sol`
**Solidity** : ^0.8.24
**Standards** : ERC-721 + ERC-7662 + ERC-7496 + ERC-4906

### 1.2 — Constructor (parametres de deploiement)

```
_name = "EVA-01 Agent"
_symbol = "EVA01"
_tokenId = 26542
_owner = 0xbAB23BC04E1a0236C0Ec6a591Dee61F851aE5996
_agentData = {
    name: "EVA-01",
    description: "Agent principal du Saint Empire Numerique - Vaisseau Fantome Atlantis",
    model: "mixtral-8x7b",
    systemPromptURI: "ipfs://Qm.../system.md",
    userPromptURI: "ipfs://Qm.../user.md",
    promptsEncrypted: true,
    imageURI: "ipfs://Qm.../eva01.png",
    agentCardURI: "https://agent.eva01.depin/.well-known/agent-card.json",
    status: 1
}
```

### 1.3 — Fonctions principales

```
setMany(params[])          → Installer/remplacer plusieurs capsules (batch)
addCapsule(id, CID, hash)  → Ajouter une seule capsule
updateCapsuleCode(id, ...) → Mettre a jour le code d'une capsule
activateCapsule(id)        → Activer une capsule
deactivateCapsule(id)      → Desactiver une capsule (reversible)
removeCapsule(id)          → Supprimer une capsule
getCapsule(id)             → Lire une capsule
getActiveCapsules()        → Lister les capsules actives
getAllCapsuleIds()         → Lister tous les capsuleIds
getAgentData()             → Lire les metadata agent
updateAgentData(data)      → Modifier les metadata agent
setTrait(key, value)       → Enregistrer un trait dynamique (ERC-7496)
getTrait(key)              → Lire un trait
updateTokenURI(uri)        → Modifier le tokenURI (ERC-4906)
```

### 1.4 — Events a ecouter

```
CapsuleAdded(tokenId, capsuleId, type, CID, priority)
CapsuleUpdated(tokenId, capsuleId, newCID, newHash)
CapsuleActivated(tokenId, capsuleId)
CapsuleDeactivated(tokenId, capsuleId)
CapsuleRemoved(tokenId, capsuleId)
AgentDataUpdated(tokenId, name, model)
TraitUpdated(tokenId, traitKey, value)
MetadataUpdate(tokenId)
```

### 1.5 — CapsuleType (enum)

```
0 = tool      → Outil d'action (web_search, file_read, browser)
1 = model     → IA embarquee (llm, image_gen, tts)
2 = connector → Pont vers l'exterieur (xdc_bridge, api_rest)
3 = rule_pack → Paquet de regles (safety_rules, privacy_rules)
4 = config    → Configuration pure (YAML/JSON)
5 = skill     → Competence combinee (tool+model+rules+config)
```

---

## PARTIE 2 : STRUCTURE D'UNE CAPSULE

### 2.1 — Arborescence

```
capsule_{nom}_{v{version}}/
├── manifest.json           ← Point d'entree (obligatoire)
├── code/
│   ├── main.py             ← Code executable (ou .js, .rs, .wasm)
│   └── lib/                ← Dependances du module
├── rules/
│   ├── rules.json          ← Regles d'execution
│   └── schema.json         ← Schema JSON des inputs/outputs
├── config/
│   ├── defaults.yaml       ← Configuration par defaut
│   └── overrides.yaml      ← Surcharges (optionnel)
└── meta/
    ├── description.md      ← Documentation humaine
    └── changelog.md        ← Historique des versions
```

### 2.2 — manifest.json (exemple pour compute_v1)

```json
{
  "capsule_id": "compute_v1",
  "name": "Compute Module",
  "version": "1.0.0",
  "type": "tool",
  "format": "python",
  "entry": "code/main.py",
  "hash": "sha256:abc123def456...",
  "code_hash": "sha256:abc123def456...",
  "size": 45230,
  "description": "Module de calcul decentralise pour EVA-01",
  "author": "Fleurs de Lys",
  "license": "MIT",
  "dependencies": ["requests>=2.28", "numpy>=1.24"],
  "capabilities": ["compute", "batch_processing", "gpu_accelerated"],
  "permissions": ["network_http", "network_https", "fs_read", "fs_write"],
  "resource_limits": {
    "max_memory_mb": 512,
    "max_cpu_seconds": 60,
    "max_requests_per_minute": 30,
    "max_disk_mb": 2048,
    "max_concurrent": 2,
    "max_output_size_bytes": 131072
  },
  "triggers": {
    "on_message": true,
    "on_event": ["compute_request", "batch_job"],
    "on_schedule": "0 */6 * * *",
    "on_api_call": "/api/compute"
  },
  "compatible_shell": ">=1.0.0",
  "signature": "falcon_sig_here"
}
```

### 2.3 — rules.json (exemple)

```json
{
  "version": "1.0",
  "rules": [
    {
      "id": "rate_limit_compute",
      "type": "rate_limit",
      "scope": "per_minute",
      "limit": 30,
      "action": "delay",
      "action_params": {"delay_seconds": 2}
    },
    {
      "id": "max_input_size",
      "type": "validation",
      "field": "input.data",
      "condition": "size <= 1048576",
      "action": "reject",
      "message": "Input data exceeds 1MB limit"
    },
    {
      "id": "require_auth",
      "type": "authorization",
      "scope": "execution",
      "required_role": "agent_owner",
      "action": "deny"
    }
  ],
  "error_handling": {
    "on_rule_violation": "log_and_reject",
    "on_module_crash": "restart_with_backoff",
    "max_restarts": 3,
    "backoff_seconds": 5
  }
}
```

---

## PARTIE 3 : FLUX DE DEPLOIEMENT COMPLET

### 3.1 — Etape 1 : Deploiement du contrat

```bash
# Installer Hardhat
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init

# Configurer hardhat.config.js pour XDC
```

```javascript
// hardhat.config.js
module.exports = {
  solidity: "0.8.24",
  networks: {
    xdc: {
      url: "https://rpc.xdcrpc.com",
      chainId: 50,
      accounts: [PRIVATE_KEY]
    },
    apothem: {
      url: "https://rpc.apothem.network",
      chainId: 51,
      accounts: [PRIVATE_KEY]
    }
  }
};
```

```bash
# Compiler
npx hardhat compile

# Deployer sur testnet d'abord
npx hardhat run scripts/deploy.js --network apothem

# Deployer sur mainnet (APRES OK!!!)
npx hardhat run scripts/deploy.js --network xdc
```

### 3.2 — Etape 2 : Preparer une capsule

```bash
# 1. Creer l'arborescence
mkdir -p capsule_compute_v1/{code,config,rules,meta}

# 2. Ecrire le code (main.py, rules.json, etc.)

# 3. Packager
tar -czf capsule_compute_v1.tar.gz capsule_compute_v1/

# 4. Uploader sur IPFS
ipfs add -r capsule_compute_v1.tar.gz
# → Recuperer le CID (ex: QmXk9r3mT7wZLxiP4s8nF5q2bYH3cD6eA9RjKvNpLx5oWz)

# 5. Calculer le hash
sha256sum capsule_compute_v1/code/main.py
# → sha256:abc123def456...

# 6. Signer avec Falcon (optionnel)
falcon-sign capsule_compute_v1/code/main.py
```

### 3.3 — Etape 3 : Appeler setMany()

```javascript
const ethers = require('ethers');

const provider = new ethers.JsonRpcProvider("https://rpc.xdcrpc.com");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

// Calculer le capsuleId
const capsuleId = ethers.keccak256(ethers.toUtf8Bytes("compute_v1"));

// Appeler setMany
const tx = await contract.setMany([{
    capsuleId: capsuleId,
    ipfsCID: "ipfs://QmXk9r3mT7wZLxiP4s8nF5q2bYH3cD6eA9RjKvNpLx5oWz",
    manifestCID: "ipfs://QmMk3pR7sV2wY5xA8cE1fG4iJ3kL6mN9oP5qR7sT2uW4xY",
    codeHash: "0xabc123def456...",
    signature: "",
    active: true,
    priority: 1,
    capsuleType: 0  // tool
}]);

await tx.wait();
console.log("Capsule installee!");
```

### 3.4 — Etape 4 : Verifier

```javascript
// Lire la capsule
const capsule = await contract.getCapsule(capsuleId);
console.log(capsule.ipfsCID);
console.log(capsule.active);
console.log(capsule.capsuleType);

// Lister toutes les capsules actives
const active = await contract.getActiveCapsules();
console.log(`${active.length} capsules actives`);
```

---

## PARTIE 4 : MODULES A DEPLOYER (12 modules atomiques)

| # | Domaine | Capsule ID | Type | Description |
|---|---------|------------|------|-------------|
| 1 | energy.depin | energy_v1 | tool | Settlement Atomique (atomic2s) |
| 2 | compute.depin | compute_v1 | tool | Calcul decentralise |
| 3 | payments.depin | payments_v1 | connector | Paiements XDC |
| 4 | computer.depin | computer_v1 | tool | Infrastructure compute |
| 5 | network.depin | network_v1 | connector | Connectivite reseau |
| 6 | node.depin | node_v1 | tool | Gestion des noeuds |
| 7 | satellite.depin | satellite_v1 | connector | Oracles temps reel |
| 8 | constellation.depin | constellation_v1 | tool | Knowledge Graph |
| 9 | unicode.depin | unicode_v1 | tool | Traitement du langage |
| 10 | pinyin.depin | pinyin_v1 | tool | Donnees IRL (IoT) |
| 11 | logos.depin | logos_v1 | connector | Interoperabilite cross-chain |
| 12 | liquidity.depin | liquidity_v1 | tool | Gouvernance et consensus |

---

## PARTIE 5 : COUTS ESTIMES (XDC)

| Operation | Gas estime | Cout XDC | Cout USD |
|-----------|------------|----------|----------|
| Deploiement contrat | ~2M gas | ~0.01 XDC | ~$0.001 |
| setMany (1 capsule) | ~150K gas | ~0.00075 XDC | ~$0.0001 |
| setMany (12 capsules) | ~1.5M gas | ~0.0075 XDC | ~$0.001 |
| addCapsule (1) | ~100K gas | ~0.0005 XDC | ~$0.0001 |
| IPFS pinning | — | Gratuit | Gratuit |
| **TOTAL** | | **~0.02 XDC** | **~$0.003** |

---

## PARTIE 6 : FICHIERS DE REFERENCE

| Fichier | Chemin |
|---------|--------|
| Contrat Solidity | `/root/hermes_coquille/contracts/HermesAgent.sol` |
| Schema capsule | `/root/hermes_coquille/schemas/capsule_manifest.schema.json` |
| Schema agent | `/root/hermes_coquille/schemas/agent_metadata.schema.json` |
| Schema setMany | `/root/hermes_coquille/schemas/setMany.schema.json` |
| Schema rules | `/root/hermes_coquille/schemas/capsule_rules.schema.json` |
| Exemple manifest | `/root/hermes_coquille/schemas/examples/capsule_manifest.example.json` |
| Exemple rules | `/root/hermes_coquille/schemas/examples/capsule_rules.example.json` |
| Plan complet | `/root/hermes_coquille_plan.md` |
| Architecture | `/root/eva1_architecture_reference.md` |
| SETMANY_INFO | `/root/hermes_coquille/contracts/SETMANY_INFO.md` |

---

## PARTIE 7 : CHECKLIST DE DEPLOIEMENT

```
[ ] 1. Installer Hardhat + dependances
[ ] 2. Configurer hardhat.config.js (XDC mainnet + apothem)
[ ] 3. Compiler HermesAgent.sol
[ ] 4. Deploiement testnet (apothem) — TESTER
[ ] 5. Verifier sur apothem.xdcscan.com
[ ] 6. Deploiement mainnet (xdc) — OK!!! requis
[ ] 7. Verifier sur xdcscan.com
[ ] 8. Noter l'adresse du contrat
[ ] 9. Preparer capsule compute_v1
[ ] 10. Packager + IPFS → CID
[ ] 11. Calculer SHA256
[ ] 12. Appeler setMany([compute_v1])
[ ] 13. Verifier l'event CapsuleAdded
[ ] 14. Repeter pour les 11 autres modules
[ ] 15. Tester le runtime off-chain
```

---

## NOTES IMPORTANTES

1. **ZERO deploiement sans "OK!!!" explicite**
2. **Tester TOUJOURS sur Apothem (testnet) d'abord**
3. **Le contrat est Soulbound** — non-transferable (le NFT reste au owner)
4. **Les capsules sont reversibles** — on peut desactiver sans supprimer
5. **Le gas est quasi-nul sur XDC** — pas de souci de cout
6. **IPFS est necessaire** — les packages capsules sont stockes sur IPFS
7. **Le runtime off-chain ecoute les events** — il detecte automatiquement les nouvelles capsules
