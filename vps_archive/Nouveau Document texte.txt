HERMES COQUILLE -- PLAN D'INTEGRATION CHRONOLOGIQUE
=====================================================
Date: 2026-06-21
Objectif: Coquille NFT modulaire "Hermes-like" -- tout plug-and-play
Contrainte: RIEN n'est deploie sans "OK!!!"

PRINCIPE FONDAMENTAL
====================
La coquille est un NFT "vide" a la base. Il se remplit de CAPSULES.
Chaque capsule = un code + des regles + un schema JSON.
Les capsules sont echangeables, remplaçables, modifiables a chaud.
Le NFT ne stocke que des REFERENCES (CIDs IPFS, hashes, versions).
Le runtime lit les capsules et les execute.


====================================================================
PARTIE 1 -- LE CONCEPT DE CAPSULE (le coeur du systeme)
====================================================================

Une CAPSULE est un package qui contient tout ce dont un module a besoin
pour vivre dans la coquille.

Structure d'une capsule :

  capsule/
  ├── manifest.json       -- Identite, version, type, compatibilite
  ├── code/
  │   ├── main.py         -- Code executable (ou .js, .sh, .wasm)
  │   └── lib/            -- Dependances du module
  ├── rules/
  │   ├── rules.json      -- Regles d'execution (droits, limites, triggers)
  │   └── schema.json     -- Schema des inputs/outputs (JSON Schema)
  ├── config/
  │   ├── defaults.yaml   -- Configuration par defaut
  │   └── overrides.yaml  -- Surcharges (optionnel)
  └── meta/
      ├── description.md  -- Documentation humaine
      └── changelog.md     -- Historique des versions

Le manifest.json est le point d'entree. Il dit tout :

{
  "capsule_id": "web_search_v2",
  "name": "Web Search",
  "version": "2.1.0",
  "type": "tool",
  "format": "python",
  "entry": "code/main.py",
  "hash": "sha256:abc123...",
  "size": 45230,
  "dependencies": ["requests>=2.28", "beautifulsoup4"],
  "capabilities": ["web_search", "web_extract"],
  "permissions": ["network_http", "network_https"],
  "resource_limits": {
    "max_memory_mb": 256,
    "max_cpu_seconds": 30,
    "max_requests_per_minute": 60
  },
  "triggers": {
    "on_message": true,
    "on_schedule": false,
    "on_event": ["user_query"]
  },
  "compatible_shell": ">=1.0.0",
  "signature": "falcon_sig_here"
}

Ce manifest est stocke sur IPFS. Son CID est enregistre on-chain.
Quand le runtime demarre, il lit le manifest, telecharge le code,
verifie le hash, charge les regles, et execute.


====================================================================
PARTIE 2 -- COMMENT LA COQUILLE RECOIT LES CAPSULES
====================================================================

2.1 -- Le schema "setMany" on-chain

La coquille NFT possede un mapping de capsules :

  mapping(bytes32 => CapsuleRef) public capsules;

  struct CapsuleRef {
    bytes32 capsuleId;       // Identifiant unique (keccak256 du nom+version)
    string  ipfsCID;         // CID IPFS du package capsule
    bytes32 codeHash;        // SHA256 du code (integrite)
    string  manifestCID;     // CID IPFS du manifest
    uint256 installedAt;    // Timestamp d'installation
    bool    active;          // Actif ou non
    uint8   priority;        // Ordre d'execution si conflit
  }

Fonctions setMany (batch) :

  // Ajouter ou remplacer plusieurs capsules en une transaction
  function setMany(
    bytes32[] calldata capsuleIds,
    string[]  calldata ipfsCIDs,
    bytes32[] calldata codeHashes,
    string[]  calldata manifestCIDs,
    bool[]    calldata active
  ) external onlyOwner

  // Desactiver une capsule (sans la supprimer -- reversible)
  function deactivateCapsule(bytes32 capsuleId) external onlyOwner

  // Reactiver une capsule
  function activateCapsule(bytes32 capsuleId) external onlyOwner

  // Remplacer juste le code d'une capsule (update)
  function updateCapsuleCode(
    bytes32 capsuleId,
    string calldata newIpfsCID,
    bytes32 newCodeHash,
    string calldata newManifestCID
  ) external onlyOwner

  // Lire toutes les capsules actives
  function getActiveCapsules() external view returns (CapsuleRef[] memory)

2.2 -- Le flux d'installation d'une capsule

  1. Developper la capsule en local
  2. Packer : zipper + IPFS add (recursif)
  3. Recuperer le CID
  4. Calculer le hash du code
  5. Appeler setMany[] sur le NFT
  6. Le runtime detecte le nouvel event CapsuleAdded
  7. Le runtime telecharge le package depuis IPFS
  8. Le runtime verifie le hash
  9. Le runtime decompresse dans /mnt/nvme/hermes/modules/{capsule_id}/
  10. Le runtime lit le manifest, installe les dependances
  11. Le runtime enregistre les regles dans le rule engine
  12. Le module est pret a l'execution

2.3 -- Le flux de remplacement d'une capsule

  1. Nouvelle version de la capsule prete
  2. setMany avec le meme capsuleId mais nouveau CID
  3. Le runtime detecte CapsuleUpdated
  4. Le runtime sauvegarde l'ancienne version (backup)
  5. Le runtime telecharge la nouvelle
  6. Le runtime verifie le hash
  7. Le runtime swap atomiquement (ou rollback si erreur)
  8. Le module est a jour, sans arret du systeme

2.4 -- Le flux de desactivation/reactivation

  1. deactivateCapsule(capsuleId)
  2. Le runtime detecte CapsuleDeactivated
  3. Le runtime decharge le module de la memoire
  4. Le runtime garde le code sur disque (pas de suppression)
  5. Le module ne repond plus aux triggers
  6. activateCapsule(capsuleId) pour le remettre en ligne


====================================================================
PARTIE 3 -- LE REGLE ENGINE (rules.json)
====================================================================

Chaque capsule a ses propres regles. Le rule engine les applique.

rules.json :

{
  "version": "1.0",
  "rules": [
    {
      "id": "rate_limit_search",
      "type": "rate_limit",
      "scope": "per_minute",
      "limit": 60,
      "action": "delay",
      "action_params": {"delay_seconds": 5}
    },
    {
      "id": "max_query_length",
      "type": "validation",
      "field": "input.query",
      "condition": "length <= 500",
      "action": "reject",
      "message": "Query too long"
    },
    {
      "id": "allowed_domains",
      "type": "allowlist",
      "field": "input.url",
      "allowed": ["*"],
      "blocked": ["localhost", "127.0.0.1", "10.0.0.0/8"],
      "action": "reject"
    },
    {
      "id": "output_sanitize",
      "type": "transform",
      "field": "output.results",
      "action": "truncate",
      "params": {"max_items": 10}
    },
    {
      "id": "require_auth",
      "type": "authorization",
      "scope": "execution",
      "required_role": "agent_owner",
      "action": "deny"
    }
  ]
  "error_handling": {
    "on_rule_violation": "log_and_reject",
    "on_module_crash": "restart_with_backoff",
    "max_restarts": 3,
    "backoff_seconds": 5
  }
}

Le rule engine est un composant du runtime. Il intercepte chaque
appel a un module et applique les regles declarees.


====================================================================
PARTIE 4 -- TYPES DE CAPSULES
====================================================================

4.1 -- CAPSULE TYPE: "tool"
     Un outil d'action. Ex: web_search, file_read, browser_navigate.
     Input: parametres d'action
     Output: resultat de l'action
     Regles: rate limiting, validation, permissions

4.2 -- CAPSULE TYPE: "model"
     Un modele IA embarque. Ex: llm_reasoning, image_gen, tts.
     Input: prompt + parametres
     Output: generation
     Regles: max_tokens, content_policy, resource_limits

4.3 -- CAPSULE TYPE: "connector"
     Un pont vers l'exterieur. Ex: xdc_bridge, xrpl_bridge, api_rest.
     Input: transaction ou requete
     Output: confirmation ou resultat
     Regles: max_amount, whitelist_addresses, multi_sig

4.4 -- CAPSULE TYPE: "rule_pack"
     Un paquet de regles supplementaires. Ex: safety_rules, privacy_rules.
     Pas de code executable, uniquement des regles JSON.
     Le rule engine les charge et les fusionne avec les regles existantes.

4.5 -- CAPSULE TYPE: "config"
     Configuration pure. Pas de code. Juste des valeurs JSON/YAML.
     Ex: agent_personality.yaml, network_endpoints.json
     Le runtime les lit et les applique au demarrage.

4.6 -- CAPSULE TYPE: "skill"
     Une competence combinee = tool + model + rules + config.
     Ex: "trading_skill" = market_data_tool + llm_analyzer + trading_rules
     Un skill est lui-meme une capsule qui reference d'autres capsules.


====================================================================
PARTIE 5 -- SCHEMA DE METADATA COMPLET
====================================================================

5.1 -- Agent Metadata (le NFT lui-meme)

{
  "name": "EVA-01",
  "description": "Agent principal du Saint Empire Numerique",
  "version": "1.0.0",
  "image": "ipfs://Qm...",
  "model": "mixtral-8x7b",
  "system_prompt_uri": "ipfs://Qm.../system.md",
  "user_prompt_uri": "ipfs://Qm.../user.md",
  "prompts_encrypted": true,
  "capsule_registry": {
    "total": 8,
    "active": 6,
    "capsules": [
      {
        "id": "web_search_v2",
        "cid": "ipfs://Qm.../web_search_v2.tar.gz",
        "hash": "sha256:abc...",
        "type": "tool",
        "active": true,
        "priority": 1
      },
      {
        "id": "llm_reasoning_v1",
        "cid": "ipfs://Qm.../llm_reasoning_v1.tar.gz",
        "hash": "sha256:def...",
        "type": "model",
        "active": true,
        "priority": 2
      }
    ]
  },
  "sub_domains": ["eva-01.depin", "falcon.depin"],
  "agent_endpoints": {
    "a2a": "https://agent.eva01.depin/.well-known/agent-card.json",
    "mcp": "https://agent.eva01.depin/mcp",
    "api": "https://agent.eva01.depin/api/v1"
  },
  "attributes": [
    {"trait_type": "status", "value": "active"},
    {"trait_type": "capsule_count", "value": "8"},
    {"trait_type": "uptime_days", "value": "42"}
  ]
}

5.2 -- Module Metadata (chaque module/capsule)

{
  "capsule_id": "web_search_v2",
  "name": "Web Search",
  "version": "2.1.0",
  "type": "tool",
  "format": "python",
  "entry": "code/main.py",
  "hash": "sha256:abc123...",
  "size": 45230,
  "dependencies": ["requests>=2.28"],
  "capabilities": ["web_search", "web_extract"],
  "permissions": ["network_http", "network_https"],
  "resource_limits": {
    "max_memory_mb": 256,
    "max_cpu_seconds": 30
  },
  "triggers": {
    "on_message": true,
    "on_event": ["user_query"]
  },
  "compatible_shell": ">=1.0.0"
}


====================================================================
PARTIE 6 -- ARCHITECTURE DE STOCKAGE (NVMe)
====================================================================

/mnt/nvme/hermes/
├── agents/
│   └── eva-01/
│       ├── nft_state.json         # Etat du NFT (on-chain cache)
│       ├── config.yaml            # Config globale de l'agent
│       ├── system_prompt.md       # Prompt systeme
│       └── user_prompt.md         # Prompt utilisateur
├── capsules/
│   ├── web_search_v2/
│   │   ├── manifest.json
│   │   ├── code/
│   │   │   ├── main.py
│   │   │   └── lib/
│   │   ├── rules/
│   │   │   ├── rules.json
│   │   │   └── schema.json
│   │   ├── config/
│   │   │   └── defaults.yaml
│   │   └── meta/
│   │       └── description.md
│   ├── llm_reasoning_v1/
│   │   └── ...
│   └── xdc_bridge_v1/
│       └── ...
├── models/
│   ├── mixtral-8x7b.gguf
│   └── falcon-180B.gguf
├── registry/
│   ├── installed.json         # Liste des capsules installees
│   ├── versions.json         # Historique des versions
│   └── backups/              # Backup des anciennes versions
│       └── web_search_v1/
├── states/
│   ├── context.json           # Contexte courant
│   ├── memory.json            # Memoire a long terme
│   └── sessions/              # Sessions actives
├── logs/
│   ├── agent.log
│   ├── capsules/
│   │   ├── web_search_v2.log
│   │   └── llm_reasoning_v1.log
│   └── audit.log              # Toutes les actions (immutable)
└── cache/
    ├── ipfs/                  # Cache local IPFS
    └── contracts/             # ABI et bytecode caches


====================================================================
PARTIE 7 -- PLAN CHRONOLOGIQUE AFFINE
====================================================================

PHASE 0 -- PREPARATION
----------------------
[ ] 0.1  Creer arborescence /root/hermes_coquille/
[ ] 0.2  Init git repo + .gitignore
[ ] 0.3  Installer outils: Node.js, Hardhat, IPFS Kubo, Python 3.12
[ ] 0.4  Setup Hardhat project dans contracts/
[ ] 0.5  Creer structure NVMe sur PC Windows (/mnt/nvme/hermes/)

PHASE 1 -- SCHEMAS & DEFINITIONS (pas de code, juste des definitions)
--------------------------------------------------------------------
[ ] 1.1  Ecrire le schema complet de capsule (manifest.json)
[ ] 1.2  Ecrire le schema rules.json (rule engine)
[ ] 1.3  Ecrire le schema agent.metadata.json
[ ] 1.4  Ecrire le schema module.metadata.json
[ ] 1.5  Definir les types de capsules (tool, model, connector, rule_pack, config, skill)
[ ] 1.6  Definir les structures on-chain (CapsuleRef, setMany params)
[ ] 1.7  Creer des exemples de capsules factices (pour tester le schema)

PHASE 2 -- SMART CONTRACT (Solidity)
------------------------------------
[ ] 2.1  HermesAgent.sol
      - ERC-721 + ERC-721URIStorage + Ownable
      - ERC-7662 (Agent Data)
      - ERC-7496 (Dynamic Traits)
      - ERC-4906 (Metadata Update events)
      - Mapping capsules
      - Fonctions: setMany, deactivateCapsule, activateCapsule, updateCapsuleCode
      - Events: CapsuleAdded, CapsuleUpdated, CapsuleDeactivated, CapsuleActivated

[ ] 2.2  HermesRuleRegistry.sol
      - Enregistre les regles on-chain (optionnel, pour verification)
      - Mapping capsuleId => rulesHash
      - Permet de verifier l'integrite des regles

[ ] 2.3  Tests Hardhat
      - Deploiement local
      - setMany avec 5 capsules
      - Update capsule
      - Deactivate/reactivate
      - Verifier events

PHASE 3 -- PACKAGER OUTIL (pour creer les capsules)
---------------------------------------------------
[ ] 3.1  capsule_packager.py
      - Prend un repertoire capsule/
      - Valide le manifest.json
      - Calcule le hash du code
      - Compresse en .tar.gz
      - Upload sur IPFS
      - Retourne le CID + hash

[ ] 3.2  capsule_installer.py
      - Prend un CID IPFS
      - Telecharge le package
      - Verifie le hash
      - Decompresse dans /mnt/nvme/hermes/capsules/{id}/
      - Installe les dependances Python
      - Enregistre dans registry/installed.json

[ ] 3.3  capsule_verifier.py
      - Verifie l'integrite d'une capsule installee
      - Compare le hash on-chain vs hash du fichier local
      - Signale les divergences

PHASE 4 -- RUNTIME OFF-CHAIN
-----------------------------
[ ] 4.1  rule_engine.py
      - Charge les rules.json de chaque capsule
      - Intercepte les appels aux modules
      - Applique: rate_limit, validation, allowlist, transform, authorization
      - Log les violations

[ ] 4.2  capsule_loader.py
      - Scan /mnt/nvme/hermes/capsules/
      - Charge chaque manifest.json
      - Valide la compatibilite (compatible_shell)
      - Installe les dependances
      - Enregistre dans le registre du runtime

[ ] 4.3  agent.py
      - Classe HermesAgent
      - Lit le NFT sur XDC (tokenURI, capsules[])
      - Charge chaque capsule via capsule_loader
      - Applique les regles via rule_engine
      - Expose les modules au routeur de taches

[ ] 4.4  task_router.py
      - Recoit une tache (texte, JSON, evenement)
      - Identifie quel module peut la traiter (capabilities)
      - Applique les regles pre-execution
      - Execute via le module approprie
      - Applique les regles post-execution
      - Retourne le resultat

[ ] 4.5  api/server.py (FastAPI)
      GET  /agent/info
      GET  /agent/capsules
      POST /agent/capsules/install     -- installe une capsule
      POST /agent/capsules/uninstall   -- desinstalle
      POST /agent/capsules/update      -- met a jour
      POST /agent/capsules/enable      -- active
      POST /agent/capsules/disable     -- desactive
      POST /agent/execute              -- execute une tache
      GET  /agent/state
      GET  /agent/logs

[ ] 4.6  event_listener.py
      - Ecoute les events du smart contract XDC
      - CapsuleAdded -> installe
      - CapsuleUpdated -> met a jour
      - CapsuleDeactivated -> desactive
      - CapsuleActivated -> reactive

PHASE 5 -- BRIDGES (cross-chain)
---------------------------------
Ordre: plus simple d'abord.

[ ] 5.1  Wanchain (XDC <-> XRPL)
      - Wallet XDCPay + Xumm
      - Portail wanbridge.web
      - Monitor les transactions

[ ] 5.2  LayerZero (XDC -> 125+ chaines)
      - SDK integration
      - Endpoints XDC configures

[ ] 5.3  Axelar (XRPL EVM Sidechain -> 80+)
      - Bridge XRP <-> eXRP
      - Depuis sidechain vers autres

[ ] 5.4  Allbridge (Stellar <-> EVM)
      - Core pour stablecoins
      - Next pour tokens arbitraires

[ ] 5.5  CCTP Circle (USDC natif)
      - Burn/mint USDC cross-chain
      - Stellar <-> EVM

[ ] 5.6  Overledger (long terme)
      - API unifiee multi-DLT
      - Connecteurs XDC + XRPL + Stellar

PHASE 6 -- OUTILS CLI
----------------------
[ ] 6.1  hermes_cli.py
      hermes init                    -- initialise l'agent
      hermes capsule create          -- cree une capsule vide
      hermes capsule package         -- package + up IPFS
      hermes capsule install         -- installe localement
      hermes capsule publish         -- enregistre on-chain (OK!!!)
      hermes capsule list            -- liste les capsules
      hermes capsule update          -- update une capsule
      hermes capsule rollback        -- revenir a une version precedente
      hermes agent status            -- statut complet
      hermes agent execute           -- execute une tache
      hermes agent logs             -- voir les logs

PHASE 7 -- TESTS
-----------------
[ ] 7.1  Tests schemas (validation JSON Schema)
[ ] 7.2  Tests packager (creation capsule + hash + IPFS)
[ ] 7.3  Tests rule_engine (chaque type de regle)
[ ] 7.4  Tests capsule_loader (chargement + dependances)
[ ] 7.5  Tests task_router (routing + execution)
[ ] 7.6  Tests d'integration (flux complet)
[ ] 7.7  Testnet (QUAND TU DIRAS OK!!!)

PHASE 8 -- DOCUMENTATION
-------------------------
[ ] 8.1  docs/ARCHITECTURE.md
[ ] 8.2  docs/CAPSULE_SPEC.md        -- Specification complete des capsules
[ ] 8.3  docs/RULE_ENGINE.md         -- Comment fonctionnent les regles
[ ] 8.4  docs/API.md
[ ] 8.5  docs/BRIDGES.md
[ ] 8.6  docs/DEPLOY.md


====================================================================
RESUME VISUEL DU FLUX D'UNE CAPSULE
====================================================================

  DEVELOPPEMENT                    ON-CHAIN                    RUNTIME
  ─────────────                    ────────                    ───────
  ecrire code + regles
       │
       ▼
  capsule_packager.py
  ┌─────────────────┐
  │ zip + IPFS add  │
  │ calcul hash     │
  │ retourne CID    │
  └────────┬────────┘
           │
           ▼
  setMany([capsuleId], [CID], [hash], ...)
  ┌─────────────────┐
  │ event           │
  │ CapsuleAdded    │──────────────────────────────────────┐
  └─────────────────┘                                      │
                                                           ▼
                                                  event_listener.py
                                                           │
                                                           ▼
                                                  capsule_installer.py
                                                  ┌─────────────────┐
                                                  │ DL depuis IPFS  │
                                                  │ verifie hash    │
                                                  │ decompresse     │
                                                  │ installe deps   │
                                                  └────────┬────────┘
                                                           │
                                                           ▼
                                                  capsule_loader.py
                                                  ┌─────────────────┐
                                                  │ lit manifest    │
                                                  │ valide compat   │
                                                  │ charge rules    │
                                                  │ registre ready  │
                                                  └────────┬────────┘
                                                           │
                                                           ▼
                                                  rule_engine.py
                                                  ┌─────────────────┐
                                                  │ charge rules    │
                                                  │ pre-execute     │
                                                  │ execute module  │
                                                  │ post-execute    │
                                                  │ log resultat    │
                                                  └─────────────────┘


====================================================================
DEPENDANCES ENTRE PHASES
====================================================================

Phase 0 (preparation)
  └──► Phase 1 (schemas) -- pas de code, juste definitions
         └──► Phase 2 (smart contracts)
                └──► Phase 3 (packager)
                       └──► Phase 4 (runtime)
                              └──► Phase 5 (bridges)
                                     └──► Phase 6 (CLI)
                                            └──► Phase 7 (tests)
                                                   └──► Phase 8 (docs)

Phase 1 peut commencer immediatement (pas de code).
Phase 2 depend de Phase 1 (schemas definis).
Phase 3 depend de Phase 2 (contrat a tester).
Phase 4 depend de Phase 3 (capsules a charger).
Phase 5 peut se faire en parallele de Phase 4.
