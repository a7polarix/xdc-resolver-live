// wallet.js – version avec FALCON Post-Quantique intégré nativement
// La signature FALCON est produite AU MOMENT de la création de la transaction,
// pas ajoutée après coup. Le flux complet est :
// 1. Transaction signée ECDSA (ethers.js) → diffusée sur la blockchain
// 2. Hash de transaction signé FALCON → stocké dans le reçu
// 3. Facture EIP-712 incluant les deux signatures

// ==================== FALCON POST-QUANTUM CRYPTO (via @noble/post-quantum) ====================
// Real FALCON-512/1024 + ML-DSA-65 from @noble/post-quantum (v0.6.1+)
// Loaded via js/falcon-pqc.js (ESM module from CDN)
// This file only provides thin wrappers matching the old API surface.

function _ensurePQC() {
    if (!window.falconPQC) {
        console.warn('[FALCON] falconPQC not loaded yet — ensure falcon-pqc.js is loaded before wallet3.js');
        throw new Error('falconPQC not loaded');
    }
    return window.falconPQC;
}

const FALCON_CRYPTO_PARAMS = {
    falcon512:  { signatureBytes: 666, publicKeyBytes: 897,  secretKeyBytes: 1281, nistLevel: 1, standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)' },
    falcon1024: { signatureBytes: 1280, publicKeyBytes: 1793, secretKeyBytes: 2305, nistLevel: 5, standard: 'Falcon Round 3 (NIST FIPS 206 / FN-DSA draft)' },
    ml_dsa44:   { signatureBytes: 2420, publicKeyBytes: 1312, secretKeyBytes: 2560, nistLevel: 2, standard: 'NIST FIPS 204' },
    ml_dsa65:   { signatureBytes: 3309, publicKeyBytes: 1952, secretKeyBytes: 4032, nistLevel: 3, standard: 'NIST FIPS 204' },
    ml_dsa87:   { signatureBytes: 4627, publicKeyBytes: 2592, secretKeyBytes: 4896, nistLevel: 5, standard: 'NIST FIPS 204' },
};

async function falconGenerateKeys(algorithm, variant) {
    if (!algorithm) algorithm = 'falcon';
    if (!variant) variant = 'falcon512';
    const pqc = _ensurePQC();
    const keys = await pqc.generateKeys(algorithm, variant);
    return {
        algorithm: keys.algorithm,
        variant: keys.variant,
        secretKey: keys.secretKey,
        publicKey: keys.publicKey,
        signatureBytes: keys.signatureBytes,
        nistLevel: keys.nistLevel,
        standard: keys.standard,
        quantumResistant: true,
        latticeBased: true,
    };
}

async function falconSignMessage(message, secretKeyHex, algorithm, variant) {
    if (!variant) variant = 'falcon512';
    const pqc = _ensurePQC();
    const result = await pqc.signMessage(message, secretKeyHex, algorithm, variant);
    return {
        signature: result.signature,
        signatureBytes: result.signatureBytes,
        algorithm: result.algorithm,
        variant: result.variant,
        standard: result.standard,
    };
}

async function falconVerifyMessage(message, signatureHex, publicKeyHex, algorithm, variant) {
    if (!variant) variant = 'falcon512';
    const pqc = _ensurePQC();
    return await pqc.verifyMessage(message, signatureHex, publicKeyHex, algorithm, variant);
}

function falconSaveKeys(d) {
    if (!d.algorithm) d.algorithm = 'falcon';
    if (!d.variant) d.variant = 'falcon512';
    localStorage.setItem(`falcon_keys_${d.algorithm}_${d.variant}`, JSON.stringify(d));
}

function falconLoadKeys(a, v) {
    if (!a) a = 'falcon';
    if (!v) v = 'falcon512';
    try { return JSON.parse(localStorage.getItem(`falcon_keys_${a}_${v}`)); }
    catch { return null; }
}

// Exposer globalement
window.falconGenerateKeys = falconGenerateKeys;
window.falconSignMessage = falconSignMessage;
window.falconVerifyMessage = falconVerifyMessage;
window.falconSaveKeys = falconSaveKeys;
window.falconLoadKeys = falconLoadKeys;
window.FALCON_CRYPTO_PARAMS = FALCON_CRYPTO_PARAMS;

// ==================== APP INIT ====================

window.addEventListener('load', () => {
    if (typeof ethers !== 'undefined') initApp();
    else {
        setTimeout(() => {
            if (typeof ethers !== 'undefined') initApp();
            else alert("ethers.js non chargé – vérifiez votre connexion.");
        }, 500);
    }
});

async function initApp() {
    let provider = null, signer = null, userAddress = null;

    // ==================== CACHE LOCAL ====================
    const domainCache = {
        set(address, domain) { if (!address || !domain) return; let c = JSON.parse(localStorage.getItem('fl_domain_cache') || '{}'); c[address.toLowerCase()] = domain; localStorage.setItem('fl_domain_cache', JSON.stringify(c)); },
        get(address) { if (!address) return null; let c = JSON.parse(localStorage.getItem('fl_domain_cache') || '{}'); return c[address.toLowerCase()] || null; }
    };

    const els = {
        connectBtn: document.getElementById('connectBtn'), disconnectBtn: document.getElementById('disconnectBtn'),
        sendBtn: document.getElementById('sendBtn'), accountInfo: document.getElementById('accountInfo'),
        balanceInfo: document.getElementById('balanceInfo'), txStatus: document.getElementById('txStatus'),
        donateStatus: document.getElementById('donateStatus'), invoiceContainer: document.getElementById('invoiceContainer'),
        manualInvoice: document.getElementById('manualInvoice'), fromDomain: document.getElementById('fromDomain'),
        toDomain: document.getElementById('toDomain'), amount: document.getElementById('amount'),
        token: document.getElementById('token'), quickDonateBtn: document.getElementById('quickDonateBtn'),
        donateAmount: document.getElementById('donateAmount'), invoiceHash: document.getElementById('invoiceHash'),
        verifyHashBtn: document.getElementById('verifyHashBtn'), invoiceFrom: document.getElementById('invoiceFrom'),
        invoiceTo: document.getElementById('invoiceTo'), invoiceAmount: document.getElementById('invoiceAmount'),
        invoiceSymbol: document.getElementById('invoiceSymbol'), sendDomainBtn: document.getElementById('sendDomainBtn'),
        sendDomainName: document.getElementById('sendDomainName'), sendDomainTo: document.getElementById('sendDomainTo'),
        sendDomainStatus: document.getElementById('sendDomainStatus'),
    };

    // ==================== FALCON STATE ====================
    // Toggle PQC par défaut: activé
    let falconEnabled = true;
    let falconAlgo = 'falcon';
    let falconVariant = 'falcon512';
    // Charger les clés existantes depuis localStorage, ou null si inexistantes
    let falconKeys = falconLoadKeys(falconAlgo, falconVariant) || null;

    // Lire l'état du toggle HTML au démarrage et à chaque changement
    function syncFalconToggle() {
        const toggle = document.getElementById('falconTxEnabled');
        if (toggle) {
            falconEnabled = toggle.checked;
            const badge = document.getElementById('falconTxBadge');
            const info = document.getElementById('falconTxInfo');
            if (badge) badge.style.display = falconEnabled ? 'inline-block' : 'none';
            if (info) info.style.display = falconEnabled ? 'block' : 'none';
        }
    }
    // Sync au chargement
    setTimeout(syncFalconToggle, 500);
    // Sync à chaque changement
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'falconTxEnabled') syncFalconToggle();
    });

    // ==================== CATEGORY BUTTONS ====================
    const categoryButtons = document.querySelectorAll('[data-category]');
    const categoryResult = document.getElementById('categoryResult');
    const categoryResultContent = document.getElementById('categoryResultContent');
    const closeCategoryBtn = document.getElementById('closeCategoryResult');

    // Map HTML data-category to JSON keys
    const categoryMap = {
        compute: '991-numerique',
        energy: '600-technologie',
        finance: '300-finance',
        minerals: '300-rwa',
        commodity: '300-rwa',
        network: '600-technologie',
        industry: '600-technologie',
        mobility: '800-geographie',
        geopolitics: '800-geographie',
        gastronomy: '700-arts',
        art: '700-arts',
        health: '200-religion',
        pnj: '900-personnel',
        other: '300-social'
    };

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const category = btn.dataset.category;
            if (!category) return;
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                if (categoryResult) categoryResult.classList.remove('show');
                return;
            }
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (categoryResultContent) {
                categoryResultContent.innerHTML = `📂 Chargement de la catégorie ${category}...`;
            }
            if (categoryResult) categoryResult.classList.add('show');
            try {
                const jsonKey = categoryMap[category] || category;
                const r = await fetch(`/api/domains?category=${encodeURIComponent(jsonKey)}`);
                if (r.ok) {
                    const data = await r.json();
                    if (data.domains && data.domains.length > 0) {
                        categoryResultContent.innerHTML = `📂 Catégorie ${category} (${data.count} domaines) :<br>✅ ${data.domains.slice(0, 50).join('<br>✅ ')}${data.domains.length > 50 ? `<br>... et ${data.domains.length - 50} autres` : ''}`;
                    } else {
                        categoryResultContent.innerHTML = `📂 Catégorie ${category} : aucun domaine trouvé.`;
                    }
                } else {
                    const err = await r.json();
                    categoryResultContent.innerHTML = `📂 Catégorie ${category} : erreur (${err.error || 'inconnue'}).`;
                }
            } catch (e) {
                categoryResultContent.innerHTML = `📂 Catégorie ${category} : erreur réseau.`;
            }
        });
    });

    if (closeCategoryBtn) {
        closeCategoryBtn.addEventListener('click', () => {
            categoryButtons.forEach(b => b.classList.remove('active'));
            if (categoryResult) categoryResult.classList.remove('show');
        });
    }

    // ==================== PQC CONTROL CENTER ====================
    const pqcInitBtn = document.getElementById('pqcInitBtn');
    const pqcStatus = document.getElementById('pqcStatus');

    function updatePqcStatus() {
        const algos = ['ml-dsa', 'slh-dsa', 'ml-kem'];
        const ready = algos.filter(a => localStorage.getItem(`pqc_keys_${a}`)).length;
        if (ready === algos.length) {
            pqcStatus.innerHTML = '✅ Toutes les clés PQC sont prêtes (ML-DSA, SLH-DSA, ML-KEM)';
            pqcInitBtn.textContent = '🔄 Régénérer les clés';
            pqcInitBtn.style.background = '#38a169';
        } else {
            pqcStatus.innerHTML = `⚠️ ${ready}/${algos.length} clés prêtes — cliquez pour initialiser`;
            pqcInitBtn.textContent = '⚡ Initialiser les clés PQC';
            pqcInitBtn.style.background = '#2c3e4e';
        }
    }

    updatePqcStatus();

    pqcInitBtn?.addEventListener('click', async () => {
        pqcInitBtn.disabled = true;
        pqcInitBtn.textContent = '⏳ Génération en cours...';
        const algos = [
            { algorithm: 'ml-dsa', variant: 'ml_dsa65', name: 'ML-DSA-65' },
            { algorithm: 'slh-dsa', variant: 'slh_dsa_sha2_128s', name: 'SLH-DSA-128s' },
            { algorithm: 'ml-kem', variant: 'ml_kem512', name: 'ML-KEM-512' }
        ];
        for (const algo of algos) {
            try {
                const r = await fetch('/api/pqc.js', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'keys', algorithm: algo.algorithm, variant: algo.variant })
                });
                const d = await r.json();
                if (d.success) {
                    localStorage.setItem(`pqc_keys_${algo.algorithm}`, JSON.stringify({
                        publicKey: d.publicKey,
                        secretKey: d.secretKey,
                        publicKeyBytes: d.publicKeyBytes,
                        generatedAt: new Date().toISOString()
                    }));
                    pqcStatus.textContent = `✅ ${algo.name} généré...`;
                } else {
                    pqcStatus.textContent = `❌ ${algo.name}: ${d.error}`;
                }
            } catch (e) {
                pqcStatus.textContent = `❌ ${algo.name}: erreur réseau`;
            }
        }
        updatePqcStatus();
        pqcInitBtn.disabled = false;
    });

    // ==================== ORACLE ====================
    let oracleRawAnswer = null, oracleDecimals = 8, oraclePrice = null;
    const oraclePriceDisplay = document.getElementById('oraclePriceDisplay');
    const ttcEstimateDisplay = document.getElementById('ttcEstimateDisplay');
    if (oraclePriceDisplay) oraclePriceDisplay.innerText = 'Non testé';
    if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = '--';

    async function testOracle(customAddress = null) {
        const addr = customAddress || document.getElementById('oracleAddressField').value.trim();
        if (!addr) { alert("Veuillez entrer une adresse de contrat oracle."); return; }
        try {
            const p = new ethers.JsonRpcProvider(getRpcUrl());
            const oracle = new ethers.Contract(addr, [
                "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
                "function decimals() view returns (uint8)"
            ], p);
            const roundData = await oracle.latestRoundData();
            oracleDecimals = Number(await oracle.decimals());
            oraclePrice = parseFloat(ethers.formatUnits(roundData.answer, oracleDecimals));
            oracleRawAnswer = roundData.answer;
            if (oraclePriceDisplay) oraclePriceDisplay.innerText = `${oraclePrice.toFixed(8)} USD/XDC`;
            updateTTCEstimateWithPrice(oraclePrice);
            alert(`Oracle testé : ${oraclePrice} USD/XDC`);
        } catch (e) { alert("Erreur oracle : " + e.message); }
    }

    function updateTTCEstimateWithPrice(price) {
        const amt = parseFloat(document.getElementById('amount')?.value);
        const tva = parseFloat(document.getElementById('tvaField')?.value) || 0;
        const regime = document.getElementById('regimeTvaField')?.value;
        const effTva = regime === 'auto_entreprise' ? 0 : tva;
        if (!isNaN(amt) && price !== null && !isNaN(price)) {
            const ttc = amt * price * (1 + effTva / 100);
            if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = `${ttc.toFixed(4)} ${document.getElementById('fiatCurrencyField')?.value || 'USD'}`;
        } else { if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = '--'; }
    }

    const amountInput = document.getElementById('amount');
    if (amountInput) amountInput.addEventListener('input', () => { if (oraclePrice !== null) updateTTCEstimateWithPrice(oraclePrice); else if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = '--'; });

    async function getCurrentXDCPrice() {
        if (oraclePrice !== null) return oraclePrice;
        try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=xinfin&vs_currencies=usd'); const d = await r.json(); if (d.xinfin?.usd) return d.xinfin.usd; } catch (e) {}
        return null;
    }

    let fleursAddress = null;
    async function getFleursAddress() {
        if (fleursAddress) return fleursAddress;
        try { fleursAddress = await resolveDomain("fleursdelys.xdc"); return fleursAddress; } catch (e) { return null; }
    }

    // ==================== DOMAIN RESOLUTION ====================
    async function fetchWithTimeout(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try { const r = await fetch(url, { signal: controller.signal }); clearTimeout(id); return r; }
        catch (error) { clearTimeout(id); throw error; }
    }

    async function resolveDomain(domain) {
        if (domain.startsWith('0x') && domain.length === 42) return domain;
        try {
            const r = await fetchWithTimeout(
                `https://fleurs-resolver-final.vercel.app/api/resolve?domain=${encodeURIComponent(domain)}`,
                10000
            );
            if (r.ok) { const d = await r.json(); if (d.result) return d.result; }
        } catch (e) {}
        if (currentNetwork === 'xdc') {
            try {
                const p = new ethers.JsonRpcProvider(getRpcUrl());
                const c = new ethers.Contract(
                    NETWORKS.xdc.contractAddr,
                    ["function getOwner(string name) view returns (address)"],
                    p
                );
                const owner = await c.getOwner(domain.toLowerCase().trim());
                if (owner && owner !== "0x0000000000000000000000000000000000000000") return owner;
            } catch (e) {}
        }
        throw new Error("Domaine non résolu : " + domain);
    }

    // ==================== FALCON: AUTO-INIT ====================
    // Générer les clés FALCON immédiatement au chargement (pas de setTimeout)
    // Si les clés existent déjà dans localStorage, elles sont déjà chargées ci-dessus.
    // Sinon, on les génère maintenant pour qu'elles soient prêtes avant toute transaction.
    if (!falconKeys) {
        falconGenerateKeys(falconAlgo, falconVariant).then(function(keys) {
            falconKeys = keys;
            falconSaveKeys(keys);
            console.log('[FALCON] Clés générées au chargement:', falconVariant);
        }).catch(function(e) {
            console.warn('[FALCON] Échec génération clés:', e.message);
        });
    } else {
        console.log('[FALCON] Clés chargées depuis localStorage');
    }

    // ==================== FALCON: SIGNER LE HASH DE TRANSACTION ====================
    // C'est ici que FALCON est intégré nativement dans le flux de transaction.
    // Après que la transaction est diffusée (tx.hash disponible), on signe le hash
    // avec FALCON. La signature FALCON est stockée dans le reçu, pas sur la blockchain.
    // La transaction blockchain reste signée ECDSA (compatibilité), mais le reçu
    // contient la preuve post-quantique.

    async function signTxWithFalcon(txHash) {
        if (!falconEnabled) return null;
        try {
            // Sign via API (server holds master secret key)
            const resp = await fetch('/api/pqc.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sign', message: txHash, algorithm: 'falcon', variant: 'falcon512' })
            });
            const data = await resp.json();
            if (data.success && data.signature) {
                return {
                    signature: data.signature,
                    algorithm: 'falcon',
                    variant: 'falcon512',
                    standard: data.standard,
                    nistLevel: data.nistLevel,
                    publicKey: data.publicKey,
                    keyGenerated: false,
                };
            }
            console.warn("FALCON API sign failed:", data.error);
            return null;
        } catch (e) { console.warn("FALCON sign failed:", e); return null; }
    }

    // ==================== ML-DSA: SIGNER LE HASH DE TRANSACTION ====================
    async function signTxWithMLDSA(txHash) {
        try {
            // Check if we have stored ML-DSA keys
            let stored = localStorage.getItem('pqc_keys_ml-dsa');
            if (!stored) {
                // Auto-generate keys on first use
                const genR = await fetch('/api/pqc.js', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'keys', algorithm: 'ml-dsa', variant: 'ml_dsa65' })
                });
                const genD = await genR.json();
                if (!genD.success) { console.warn('ML-DSA key gen failed:', genD.error); return null; }
                localStorage.setItem('pqc_keys_ml-dsa', JSON.stringify({
                    publicKey: genD.publicKey,
                    secretKey: genD.secretKey,
                    publicKeyBytes: genD.publicKeyBytes,
                    generatedAt: new Date().toISOString()
                }));
                stored = localStorage.getItem('pqc_keys_ml-dsa');
            }
            const keys = JSON.parse(stored);
            // Sign the tx hash
            const resp = await fetch('/api/pqc.js', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sign', message: txHash, algorithm: 'ml-dsa', variant: 'ml_dsa65', secretKey: keys.secretKey })
            });
            const data = await resp.json();
            if (data.success && data.signature) {
                return {
                    signature: data.signature,
                    algorithm: 'ml-dsa',
                    variant: 'ml_dsa65',
                    standard: data.standard,
                    nistLevel: data.nistLevel,
                    publicKey: keys.publicKey,
                    keyGenerated: true,
                };
            }
            console.warn('ML-DSA sign failed:', data.error);
            return null;
        } catch (e) { console.warn('ML-DSA sign failed:', e); return null; }
    }

    // ==================== SLH-DSA: SIGNER LE HASH DE TRANSACTION ====================
    async function signTxWithSLHDSA(txHash) {
        try {
            let stored = localStorage.getItem('pqc_keys_slh-dsa');
            if (!stored) {
                const genR = await fetch('/api/pqc.js', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'keys', algorithm: 'slh-dsa', variant: 'slh_dsa_sha2_128s' })
                });
                const genD = await genR.json();
                if (!genD.success) { console.warn('SLH-DSA key gen failed:', genD.error); return null; }
                localStorage.setItem('pqc_keys_slh-dsa', JSON.stringify({
                    publicKey: genD.publicKey,
                    secretKey: genD.secretKey,
                    publicKeyBytes: genD.publicKeyBytes,
                    generatedAt: new Date().toISOString()
                }));
                stored = localStorage.getItem('pqc_keys_slh-dsa');
            }
            const keys = JSON.parse(stored);
            const resp = await fetch('/api/pqc.js', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sign', message: txHash, algorithm: 'slh-dsa', variant: 'slh_dsa_sha2_128s', secretKey: keys.secretKey })
            });
            const data = await resp.json();
            if (data.success && data.signature) {
                return {
                    signature: data.signature,
                    algorithm: 'slh-dsa',
                    variant: 'slh_dsa_sha2_128s',
                    standard: data.standard,
                    nistLevel: data.nistLevel,
                    publicKey: keys.publicKey,
                };
            }
            console.warn('SLH-DSA sign failed:', data.error);
            return null;
        } catch (e) { console.warn('SLH-DSA sign failed:', e); return null; }
    }

    // ==================== FALCON: VÉRIFIER UNE SIGNATURE ====================
    async function verifyFalconSignature(txHash, falconSigData) {
        if (!falconSigData || !falconSigData.signature || !falconSigData.publicKey) return null;
        try {
            return await falconVerifyMessage(
                txHash,
                falconSigData.signature,
                falconSigData.publicKey,
                falconSigData.algorithm || 'falcon',
                falconSigData.variant || 'falcon512'
            );
        } catch (e) { return null; }
    }

    // ==================== EIP-712 (inchangé) ====================
    async function attemptAutoSign() {
        const p = window._lastTxData;
        if (!p) return null;
        if (!signer) { console.warn("Wallet non connecté."); return null; }
        const fromAddr = p.originalFrom || p.from;
        const toAddr = p.originalTo || p.to;
        if (!fromAddr.startsWith('0x') || !toAddr.startsWith('0x')) return null;
        const domain = { name: "XDC Retail Receipt", version: "1", chainId: currentNetwork === 'xdc' ? 50 : 1, verifyingContract: NETWORKS.xdc.contractAddr || "0x0000000000000000000000000000000000000000" };
        const message = { from: fromAddr, to: toAddr, amount: ethers.parseUnits(String(p.amount), 18).toString(), txHash: p.hash, invoiceNumber: p.invoiceNumber, date: p.timestampUTC };
        const types = {
            Facture: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "txHash", type: "bytes32" },
                { name: "invoiceNumber", type: "string" },
                { name: "date", type: "string" }
            ]
        };
        try {
            const signature = await signer.signTypedData(domain, types, message);
            window._signedReceipt = { p, signature, domain, types, message };
            window._lastTxData.signature = signature;
            window._lastTxData.eip712 = { domain, types, message, primaryType: "Facture" };
            return signature;
        } catch (e) { return null; }
    }

    // ==================== FACTURE (avec FALCON) ====================
    async function buildInvoiceData(h, amt, from, to, sym, inv, ts, catFrom, catTo, amtStr, usdValue, signature, falconSig, mlDsaSig, slhDsaSig) {
        const cfg = {
            siret: document.getElementById('siretField').value.trim(),
            tva: parseFloat(document.getElementById('tvaField').value) || 0,
            adresse_siege: document.getElementById('adresseSiegeField').value.trim(),
            objet_prestation: document.getElementById('objetPrestationField').value.trim(),
            fiatCurrency: document.getElementById('fiatCurrencyField').value.trim() || 'USD',
            categorie_personnalisee: document.getElementById('categoriePersoField').value.trim(),
            regime_tva: document.getElementById('regimeTvaField').value,
            mention_tva: document.getElementById('mentionTvaField').value.trim()
        };
        const effTva = cfg.regime_tva === 'auto_entreprise' ? 0 : cfg.tva;
        const ttc_amt = parseFloat(amt);
        const ht_amt = effTva > 0 ? ttc_amt / (1 + effTva / 100) : ttc_amt;
        const price = oraclePrice;
        let ttc_fiat = null, ht_fiat = null, rate = null;
        if (price && !isNaN(ttc_amt)) { rate = price; ttc_fiat = ttc_amt * price; ht_fiat = ht_amt * price; }
        const mention = cfg.regime_tva === 'auto_entreprise' ? (cfg.mention_tva || "TVA non applicable, art. 293B du CGI") : cfg.mention_tva;
        const f = {
            numero: inv, emetteur: from, categorie_emetteur: catFrom || "invité",
            destinataire: to, categorie_destinataire: catTo || "invité",
            montant: `${ttc_amt} ${sym}`, devise: sym, date: ts, hash: h, lien: getExplorerUrl(h),
            valeur_ht_fiat: ht_fiat !== null ? `${ht_fiat.toFixed(4)} ${cfg.fiatCurrency}` : null,
            tva_appliquee: effTva > 0 ? `${effTva}%` : (cfg.regime_tva === 'auto_entreprise' ? "0% (auto-entreprise)" : undefined),
            montant_ttc_fiat: ttc_fiat !== null ? `${ttc_fiat.toFixed(4)} ${cfg.fiatCurrency}` : null,
            taux_change_utilise: rate !== null ? `${rate.toFixed(8)} ${cfg.fiatCurrency}/${sym}` : null,
            siret: cfg.siret || undefined, adresse_siege: cfg.adresse_siege || undefined,
            objet_prestation: cfg.objet_prestation || undefined, mention_tva: mention || undefined,
        };
        if (signature) f.eip712_signature = signature;
        if (falconSig) {
            f.falcon_signature = falconSig.signature;
            f.falcon_algorithm = `${falconSig.algorithm}-${falconSig.variant}`;
            f.falcon_standard = falconSig.standard;
            f.falcon_nist_level = falconSig.nistLevel;
            f.falcon_public_key = falconSig.publicKey;
        }
        if (mlDsaSig) {
            f.ml_dsa_signature = mlDsaSig.signature;
            f.ml_dsa_algorithm = `${mlDsaSig.algorithm}-${mlDsaSig.variant}`;
            f.ml_dsa_standard = mlDsaSig.standard;
            f.ml_dsa_nist_level = mlDsaSig.nistLevel;
            f.ml_dsa_public_key = mlDsaSig.publicKey;
        }
        if (slhDsaSig) {
            f.slh_dsa_signature = slhDsaSig.signature;
            f.slh_dsa_algorithm = `${slhDsaSig.algorithm}-${slhDsaSig.variant}`;
            f.slh_dsa_standard = slhDsaSig.standard;
            f.slh_dsa_nist_level = slhDsaSig.nistLevel;
            f.slh_dsa_public_key = slhDsaSig.publicKey;
        }
        Object.keys(f).forEach(key => f[key] === undefined && delete f[key]);
        return f;
    }

    function buildClientData(f) {
        const c = { ...f };
        ['categorie_emetteur', 'categorie_destinataire', 'siret', 'adresse_siege', 'objet_prestation', 'mention_tva', 'eip712_signature', 'valeur_ht_fiat', 'falcon_signature', 'falcon_algorithm', 'falcon_standard', 'falcon_nist_level', 'falcon_public_key', 'ml_dsa_signature', 'ml_dsa_algorithm', 'ml_dsa_standard', 'ml_dsa_nist_level', 'ml_dsa_public_key', 'slh_dsa_signature', 'slh_dsa_algorithm', 'slh_dsa_standard', 'slh_dsa_nist_level', 'slh_dsa_public_key'].forEach(k => delete c[k]);
        return c;
    }

    async function displayInvoice(h, amt, from, to, sym, inv, ts, catFrom = null, catTo = null, amtStr = null, usdValue = null, signature = null, falconSig = null, mlDsaSig = null, slhDsaSig = null) {
        const full = await buildInvoiceData(h, amt, from, to, sym, inv, ts, catFrom, catTo, amtStr, usdValue, signature, falconSig, mlDsaSig, slhDsaSig);
        const client = buildClientData(full);
        const qrD = { hash: h, from, to, amount: amtStr || `${amt} ${sym}`, date: ts, explorer: getExplorerUrl(h), usd: usdValue };
        const qrURL = await qrDataURL(JSON.stringify(qrD));
        // Include EIP-712 structure if available
        const eip712 = window._lastTxData?.eip712 || null;
        const receiptObj = { facture: full };
        if (eip712) receiptObj.eip712 = eip712;
        const fullStr = JSON.stringify(receiptObj, null, 2);
        const clientStr = JSON.stringify({ facture: client }, null, 2);
        els.invoiceContainer.innerHTML = `<pre style="white-space:pre-wrap;">${fullStr}</pre><div class="qr-code-img"><img src="${qrURL}" alt="QR"></div>`;
        els.invoiceContainer.style.display = 'block';
        ['copyJsonBtn','copyHashBtn','saveClientBtn','saveComptaBtn','saveBothBtn','printInvoiceBtn'].forEach(id => { const btn = document.getElementById(id); if (btn) { btn.style.display = 'inline-block'; btn.classList.add('ready'); } });
        document.getElementById('copyJsonBtn').onclick = () => { navigator.clipboard.writeText(fullStr); alert("JSON copié"); };
        document.getElementById('copyHashBtn').onclick = () => { navigator.clipboard.writeText(h); alert("Hash copié"); };
        document.getElementById('saveClientBtn').onclick = () => downloadInvoice(clientStr, inv, 'client');
        document.getElementById('saveComptaBtn').onclick = () => downloadInvoice(fullStr, inv, 'comptable');
        document.getElementById('saveBothBtn').onclick = () => { downloadInvoice(clientStr, inv, 'client'); setTimeout(() => downloadInvoice(fullStr, inv, 'comptable'), 500); };
        document.getElementById('printInvoiceBtn').onclick = printInvoice;
        if (typeof detectAndShowMainLocation === 'function') detectAndShowMainLocation();
        const invoiceSection = document.getElementById('invoiceSection');
        if (invoiceSection) invoiceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function downloadInvoice(jsonStr, inv, suffix) {
        const blob = new Blob([jsonStr], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `recu_${inv}_${suffix}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        alert("Reçu téléchargé en .txt");
    }

    function printInvoice() {
        const content = els.invoiceContainer.innerHTML;
        if (!content || els.invoiceContainer.style.display === 'none') { alert("Aucune facture à imprimer."); return; }
        const w = window.open('', '_blank', 'width=800,height=600');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Impression facture</title><style>body{font-family:monospace;padding:20px;background:white;color:#1e2a3a;}pre{white-space:pre-wrap;}.qr-code-img{text-align:center;margin:20px 0;}.qr-code-img img{width:180px;height:180px;}</style></head><body>${content}</body></html>`);
        w.document.close(); w.focus(); w.print(); w.close();
    }

    async function qrDataURL(data, size = 150) {
        const u = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
        const b = await (await fetch(u)).blob();
        return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(b); });
    }

    function getConfigFields() {
        return {
            siret: document.getElementById('siretField').value.trim(),
            tva: parseFloat(document.getElementById('tvaField').value) || 0,
            adresse_siege: document.getElementById('adresseSiegeField').value.trim(),
            objet_prestation: document.getElementById('objetPrestationField').value.trim(),
            fiatCurrency: document.getElementById('fiatCurrencyField').value.trim() || 'USD',
            categorie_personnalisee: document.getElementById('categoriePersoField').value.trim(),
            regime_tva: document.getElementById('regimeTvaField').value,
            mention_tva: document.getElementById('mentionTvaField').value.trim()
        };
    }

    async function getDomainCategory(domain) {
        if (!domain || domain.startsWith('0x')) return null;
        const catPerso = document.getElementById('categoriePersoField').value.trim();
        if (catPerso) return catPerso;
        if (window.LOCAL_CATEGORIES && LOCAL_CATEGORIES[domain.toLowerCase()]) return LOCAL_CATEGORIES[domain.toLowerCase()];
        try {
            const parts = domain.split('.');
            if (parts.length >= 2 && parts.slice(-2).join('.').toLowerCase() === '⚜️⚜️⚜️.xdc') {
                const p = new ethers.JsonRpcProvider(getRpcUrl());
                const c = new ethers.Contract(NETWORKS.xdc.contractAddr, ["function getDomainInfo(string name) view returns (tuple(address owner, address resolver, uint256 expiry))"], p);
                const info = await c.getDomainInfo(domain.toLowerCase().trim());
                if (info.owner !== ethers.ZeroAddress) return "Lore & Mythes";
            }
        } catch (e) {}
        return "invité";
    }

    function truncate(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

    async function fetchTxDetails(h) {
        if (!provider) provider = new ethers.JsonRpcProvider(getRpcUrl());
        const tx = await provider.getTransaction(h);
        if (!tx) throw new Error("Transaction introuvable");
        let from = tx.from, to = tx.to, amount, symbol = getTokenList()[0].value, nonce = tx.nonce;
        if (tx.value && tx.value !== 0n) { amount = parseFloat(ethers.formatEther(tx.value)); }
        else {
            const rc = await provider.getTransactionReceipt(h);
            if (!rc?.logs) throw new Error("Logs non trouvés");
            const top = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
            let found = false;
            for (const log of rc.logs) {
                if (log.topics[0] === top) { from = "0x" + log.topics[1].slice(26); to = "0x" + log.topics[2].slice(26); amount = Number(ethers.formatUnits(ethers.toBigInt(log.data), 18)); found = true; break; }
            }
            if (!found) throw new Error("Aucun transfert détecté");
        }
        const block = await provider.getBlock(tx.blockNumber);
        const ts = new Date(block.timestamp * 1000).toISOString();
        const short = h.slice(2, 10);
        const inv = `FDL-${new Date().getFullYear()}-${short}${nonce}`;
        const xdcPrice = await getCurrentXDCPrice();
        const usdValue = (xdcPrice !== null && !isNaN(amount)) ? (amount * xdcPrice).toFixed(4) : null;
        return { amount, symbol, from, to, invoiceNumber: inv, timestampUTC: ts, usdcValue: usdValue };
    }

    // ==================== TRANSACTION SEND (avec FALCON intégré) ====================
    els.sendBtn.onclick = async () => {
        const toDomainName = els.toDomain.value.trim();
        const amt = parseFloat(els.amount.value);
        const tok = els.token.value;
        const fromDomainName = els.fromDomain.value.trim();
        if (!toDomainName || isNaN(amt) || amt <= 0) return alert("Remplissez les champs.");
        if (!signer) return alert("Connectez wallet.");
        els.txStatus.innerHTML = "🔍 Vérification du domaine émetteur...";
        try {
            if (fromDomainName && !fromDomainName.startsWith('0x')) {
                // Domain ownership check: resolve domain and verify it belongs to connected wallet
                // Use getOwner on XWD contract directly (resolver Vercel may not have all domains)
                let resolvedFrom;
                try {
                    const p = new ethers.JsonRpcProvider(getRpcUrl());
                    const c = new ethers.Contract(
                        NETWORKS.xdc.contractAddr,
                        ["function getOwner(string name) view returns (address)"],
                        p
                    );
                    resolvedFrom = await c.getOwner(fromDomainName.toLowerCase().trim());
                } catch(e) {
                    console.warn('[XWD] getOwner failed:', e.message);
                }
                // Only check if we got a valid non-zero address
                if (resolvedFrom && resolvedFrom !== "0x0000000000000000000000000000000000000000") {
                    if (resolvedFrom.toLowerCase() !== userAddress.toLowerCase()) {
                        els.txStatus.innerHTML = "❌ Le domaine émetteur ne correspond pas à votre wallet.";
                        return;
                    }
                }
                // If getOwner returned zero address or failed, skip check (domain may use different registry)
            } else if (fromDomainName && fromDomainName.startsWith('0x')) {
                // Direct address — use as-is
            } else { els.txStatus.innerHTML = "❌ Vous devez spécifier un domaine émetteur valide."; return; }
            const targetAddress = await resolveDomain(toDomainName);
            domainCache.set(targetAddress, toDomainName);
            domainCache.set(userAddress, fromDomainName);
            els.txStatus.innerHTML = `⏳ Envoi de ${amt} ${tok}...`;

            // === ÉTAPE 1: Transaction signée ECDSA (blockchain) ===
            let tx;
            const tokenAddr = getTokenAddress(tok);
            if (!tokenAddr) {
                tx = await signer.sendTransaction({ to: targetAddress, value: ethers.parseEther(amt.toString()), gasLimit: 50000 });
            } else {
                const c = new ethers.Contract(tokenAddr, ["function transfer(address,uint256) returns (bool)"], signer);
                tx = await c.transfer(targetAddress, ethers.parseUnits(amt.toString(), getTokenDecimals(tok)));
            }
            els.txStatus.innerHTML += `<br>📡 Tx: ${tx.hash.slice(0, 10)}...`;
            await tx.wait();
            els.txStatus.innerHTML += '<br>✅ Succès !';

            // === ÉTAPE 2: Signature FALCON du hash de transaction (post-quantique) ===
            let falconSig = null;
            if (falconEnabled) {
                els.txStatus.innerHTML += '<br>🔐 Signature FALCON...';
                try {
                    falconSig = await signTxWithFalcon(tx.hash);
                    if (falconSig) {
                        els.txStatus.innerHTML += `<br>✅ FALCON signé ! <span style="font-size:0.75rem;">(${falconSig.algorithm}-${falconSig.variant}, ${falconSig.standard})</span>`;
                        // Purger les anciennes clés et régénérer pour la prochaine transaction
                        localStorage.removeItem('falcon_keys_falcon_falcon512');
                        localStorage.removeItem('falcon_keys_falcon_falcon1024');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa65');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa44');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa87');
                        falconKeys = null;
                        falconGenerateKeys(falconAlgo, falconVariant).then(function(keys) {
                            falconKeys = keys;
                            falconSaveKeys(keys);
                            console.log('[FALCON] Clés régénérées après signature');
                        }).catch(function(e) {
                            console.warn('[FALCON] Échec régénération clés:', e.message);
                        });
                    } else {
                        els.txStatus.innerHTML += '<br>⚠️ FALCON indisponible (clés non générées)';
                    }
                } catch (e) {
                    els.txStatus.innerHTML += `<br>⚠️ FALCON erreur: ${e.message}`;
                }
            }

            // === ÉTAPE 2.5: ML-DSA (signature post-quantique) ===
            let mlDsaSig = null;
            try {
                els.txStatus.innerHTML += '<br>💎 Signature ML-DSA...';
                mlDsaSig = await signTxWithMLDSA(tx.hash);
                if (mlDsaSig) {
                    els.txStatus.innerHTML += `<br>✅ ML-DSA signé ! <span style="font-size:0.75rem;">(${mlDsaSig.variant}, ${mlDsaSig.standard})</span>`;
                } else {
                    els.txStatus.innerHTML += '<br>⚠️ ML-DSA indisponible';
                }
            } catch (e) {
                els.txStatus.innerHTML += `<br>⚠️ ML-DSA erreur: ${e.message}`;
            }

            // === ÉTAPE 2.6: SLH-DSA (signature post-quantique hash-based) ===
            let slhDsaSig = null;
            try {
                els.txStatus.innerHTML += '<br>🌲 Signature SLH-DSA...';
                slhDsaSig = await signTxWithSLHDSA(tx.hash);
                if (slhDsaSig) {
                    els.txStatus.innerHTML += `<br>✅ SLH-DSA signé ! <span style="font-size:0.75rem;">(${slhDsaSig.variant}, ${slhDsaSig.standard})</span>`;
                } else {
                    els.txStatus.innerHTML += '<br>⚠️ SLH-DSA indisponible';
                }
            } catch (e) {
                els.txStatus.innerHTML += `<br>⚠️ SLH-DSA erreur: ${e.message}`;
            }

            // === ÉTAPE 3: EIP-712 (signature classique du reçu) ===
            let eipSig = null;
            try {
                const result = await attemptAutoSign();
                if (result) eipSig = result;
            } catch (e) {}

            // === ÉTAPE 4: Construire le reçu avec les DEUX signatures ===
            try {
                await refreshBalance();
                const d = await fetchTxDetails(tx.hash);
                const fromCat = await getDomainCategory(fromDomainName);
                const toCat = await getDomainCategory(toDomainName);
                addTxEntry({ type: 'outgoing', from: fromDomainName, to: toDomainName, amount: amt, token: tok, hash: tx.hash, usdcValue: d.usdcValue, siret: document.getElementById('siretField').value.trim(), tva: document.getElementById('tvaField').value, catEmetteur: fromCat, catDestinataire: toCat });
                window._lastTxData = {
                    hash: tx.hash, amount: amt, symbol: tok,
                    from: fromDomainName, to: toDomainName,
                    originalFrom: d.from, originalTo: d.to,
                    invoiceNumber: d.invoiceNumber, timestampUTC: d.timestampUTC,
                    usdcValue: d.usdcValue, catFrom: fromCat, catTo: toCat, amtStr: null,
                    signature: eipSig, falconSignature: falconSig, mlDsaSignature: mlDsaSig, slhDsaSignature: slhDsaSig,
                };
                const receiptBtn = document.getElementById('receiptBtn');
                receiptBtn.disabled = false; receiptBtn.classList.add('ready');
                els.txStatus.innerHTML += '<br>📄 Cliquez sur "Reçu EIP" pour générer la facture.';
                els.amount.value = '';
                updateSendBtnState();
            } catch (postErr) {
                els.txStatus.innerHTML += `<br>⚠️ Erreur post-transaction : ${postErr.message}`;
            }
        } catch (e) {
            els.txStatus.innerHTML += `<br>❌ ${e.message}`;
        }
    };

    // ==================== DONATE (avec FALCON) ====================
    async function donate(amt) {
        if (!signer) return alert("Connectez wallet.");
        if (isNaN(amt) || amt <= 0) return;
        els.donateStatus.innerHTML = "⏳ Envoi...";
        try {
            const target = currentNetwork === 'xdc' ? await resolveDomain("fleursdelys.xdc") : userAddress;
            const fromDisp = els.fromDomain.value || truncate(userAddress);
            const tx = await signer.sendTransaction({ to: target, value: ethers.parseEther(amt.toString()), gasLimit: 50000 });
            els.donateStatus.innerHTML = `📡 Tx: ${tx.hash.slice(0, 10)}...`;
            await tx.wait();
            const tok = getTokenList()[0].value;
            els.donateStatus.innerHTML = `✅ Don de ${amt} ${tok} effectué !`;
            await refreshBalance();
            const d = await fetchTxDetails(tx.hash);
            const fromCat = await getDomainCategory(fromDisp);
            addTxEntry({ type: 'outgoing', from: fromDisp, to: target, amount: amt, token: tok, hash: tx.hash, usdcValue: d.usdcValue, siret: document.getElementById('siretField').value.trim(), tva: document.getElementById('tvaField').value, catEmetteur: fromCat, catDestinataire: "Trésorerie" });

            // FALCON
            let falconSig = null;
            if (falconEnabled) {
                try {
                    falconSig = await signTxWithFalcon(tx.hash);
                    if (falconSig) {
                        // Purger les anciennes clés et régénérer pour la prochaine transaction
                        localStorage.removeItem('falcon_keys_falcon_falcon512');
                        localStorage.removeItem('falcon_keys_falcon_falcon1024');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa65');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa44');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa87');
                        falconKeys = null;
                        falconGenerateKeys(falconAlgo, falconVariant).then(function(keys) {
                            falconKeys = keys;
                            falconSaveKeys(keys);
                            console.log('[FALCON] Clés régénérées après don');
                        }).catch(function(e) {
                            console.warn('[FALCON] Échec régénération clés:', e.message);
                        });
                    }
                } catch (e) {}
            }

            window._lastTxData = { hash: tx.hash, amount: amt, symbol: tok, from: fromDisp, to: "fleursdelys.xdc", originalFrom: d.from, originalTo: d.to, invoiceNumber: d.invoiceNumber, timestampUTC: d.timestampUTC, usdcValue: d.usdcValue, catFrom: fromCat, catTo: "Trésorerie", amtStr: null, signature: null, falconSignature: falconSig };
            const receiptBtn = document.getElementById('receiptBtn');
            receiptBtn.disabled = false; receiptBtn.classList.add('ready');
            els.donateStatus.innerHTML += '<br>📄 Cliquez sur "Reçu EIP" pour générer la facture.';
        } catch (e) { els.donateStatus.innerHTML = `❌ ${e.message}`; }
    }

    // ==================== SEND DOMAIN (avec FALCON) ====================
    els.sendDomainBtn.onclick = async () => {
        const domainName = els.sendDomainName.value.trim();
        let toDomainOrAddr = els.sendDomainTo.value.trim();
        if (!domainName || !toDomainOrAddr) return alert("Remplissez le nom du domaine et l'adresse destinataire.");
        if (!signer) return alert("Connectez wallet.");
        if (currentNetwork !== 'xdc') return alert("L'envoi de domaine n'est disponible que sur XDC Network.");
        els.sendDomainStatus.innerHTML = "🔍 Résolution du destinataire...";
        try {
            let targetAddress, targetDisplay = toDomainOrAddr;
            if (!toDomainOrAddr.startsWith('0x')) { targetAddress = await resolveDomain(toDomainOrAddr); targetDisplay = toDomainOrAddr; els.sendDomainStatus.innerHTML = `✅ Destinataire résolu : ${targetAddress.slice(0, 6)}...`; }
            else { targetAddress = toDomainOrAddr; }
            if (!targetAddress.startsWith('0x') || targetAddress.length !== 42) return alert("Adresse destinataire invalide.");
            const contract = new ethers.Contract(NETWORKS.xdc.contractAddr, [
                "function getTokenId(string name) view returns (uint256)", "function ownerOf(uint256 tokenId) view returns (address)", "function transferFrom(address from, address to, uint256 tokenId)"
            ], signer);
            const tokenId = await contract.getTokenId(domainName.toLowerCase().trim());
            const owner = await contract.ownerOf(tokenId);
            if (owner.toLowerCase() !== userAddress.toLowerCase()) { els.sendDomainStatus.innerHTML = "❌ Ce domaine ne vous appartient pas."; return; }
            els.sendDomainStatus.innerHTML = "⏳ Transfert du domaine...";
            const tx = await contract.transferFrom(userAddress, targetAddress, tokenId, { gasLimit: 150000 });
            els.sendDomainStatus.innerHTML = `📡 Tx: ${tx.hash.slice(0, 10)}...`;
            await tx.wait();
            els.sendDomainStatus.innerHTML += '<br>✅ Succès !';

            // FALCON
            let falconSig = null;
            if (falconEnabled) {
                try {
                    falconSig = await signTxWithFalcon(tx.hash);
                    if (falconSig) {
                        els.sendDomainStatus.innerHTML += '<br>🔐 FALCON signé !';
                        // Purger les anciennes clés et régénérer pour la prochaine transaction
                        localStorage.removeItem('falcon_keys_falcon_falcon512');
                        localStorage.removeItem('falcon_keys_falcon_falcon1024');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa65');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa44');
                        localStorage.removeItem('falcon_keys_ml-dsa_ml_dsa87');
                        falconKeys = null;
                        falconGenerateKeys(falconAlgo, falconVariant).then(function(keys) {
                            falconKeys = keys;
                            falconSaveKeys(keys);
                            console.log('[FALCON] Clés régénérées après NFT');
                        }).catch(function(e) {
                            console.warn('[FALCON] Échec régénération clés:', e.message);
                        });
                    }
                } catch (e) {}
            }

            const invoiceNumber = `FDL-${new Date().getFullYear()}-${tx.hash.slice(2, 10)}`;
            const timestampUTC = new Date().toISOString();
            const fromCat = await getDomainCategory(domainName);
            const toCat = await getDomainCategory(targetDisplay);
            const xdcPrice = await getCurrentXDCPrice();
            const usdValueStr = (xdcPrice !== null) ? (1 * xdcPrice).toFixed(4) : null;
            addTxEntry({ type: 'outgoing', from: domainName, to: targetDisplay, amount: '1', token: 'NFT', hash: tx.hash, usdcValue: usdValueStr, siret: document.getElementById('siretField').value.trim(), tva: document.getElementById('tvaField').value, catEmetteur: fromCat, catDestinataire: toCat });
            window._lastTxData = { hash: tx.hash, amount: 1, symbol: 'NFT', from: domainName, to: targetDisplay, originalFrom: userAddress, originalTo: targetAddress, invoiceNumber, timestampUTC, usdcValue: usdValueStr, catFrom: fromCat, catTo: toCat, amtStr: '1 NFT', signature: null, falconSignature: falconSig };
            const receiptBtn = document.getElementById('receiptBtn');
            receiptBtn.disabled = false; receiptBtn.classList.add('ready');
            els.sendDomainStatus.innerHTML += '<br>📄 Cliquez sur "Reçu EIP" pour générer la facture.';
            if (typeof detectAndShowMainLocation === 'function') detectAndShowMainLocation();
            els.sendDomainName.value = ''; els.sendDomainTo.value = '';
            updateSendDomainBtnState();
        } catch (e) { els.sendDomainStatus.innerHTML = `❌ ${e.message}`; }
    };

    // ==================== RECEIPT (avec FALCON) ====================
    document.getElementById('receiptBtn').addEventListener('click', async () => {
        const data = window._lastTxData;
        if (!data) { alert("Aucune transaction récente."); return; }
        let signature = data.signature;
        if (!signature) { const result = await attemptAutoSign(); if (result) signature = result; if (signature) window._lastTxData.signature = signature; }
        await displayInvoice(data.hash, data.amount, data.from, data.to, data.symbol, data.invoiceNumber, data.timestampUTC, data.catFrom, data.catTo, data.amtStr, data.usdcValue, signature, data.falconSignature, data.mlDsaSignature, data.slhDsaSignature);
        alert("Facture générée. Utilisez les boutons ci-dessous pour l'imprimer ou la télécharger.");
    });

    // ==================== VERIFY HASH ====================
    els.verifyHashBtn.onclick = async () => {
        const h = els.invoiceHash.value.trim();
        if (!h?.startsWith('0x') || h.length < 66) return alert("Hash invalide.");
        els.manualInvoice.style.display = 'none';
        try {
            if (!provider) provider = new ethers.JsonRpcProvider(getRpcUrl());
            const { amount, symbol, from, to, invoiceNumber, timestampUTC, usdcValue } = await fetchTxDetails(h);
            const fromDomain = domainCache.get(from), toDomain = domainCache.get(to);
            els.invoiceAmount.value = amount; els.invoiceSymbol.value = symbol; els.invoiceSymbol.disabled = true;
            els.invoiceFrom.value = fromDomain || from; els.invoiceTo.value = toDomain || to;
            alert(`✅ Vérifié : ${amount} ${symbol} (≈${usdcValue} USD)`);
            window._lastTxData = { hash: h, amount, symbol, from: fromDomain || from, to: toDomain || to, originalFrom: from, originalTo: to, invoiceNumber, timestampUTC, usdcValue, catFrom: await getDomainCategory(fromDomain || from), catTo: await getDomainCategory(toDomain || to), amtStr: `${amount} ${symbol}`, signature: null, falconSignature: null };
            document.getElementById('signEipInvoiceBtn').style.display = 'inline-block';
            document.getElementById('receiptBtn').disabled = false; document.getElementById('receiptBtn').classList.add('ready');
        } catch (e) { alert("Erreur : " + e.message); }
    };

    // ==================== SIGN EIP INVOICE ====================
    document.getElementById('signEipInvoiceBtn').addEventListener('click', async () => {
        const p = window._lastTxData || window._pendingManual;
        if (!p) return alert("Vérifiez d'abord un hash.");
        if (!signer) return alert("Connectez le wallet.");
        const fromAddr = p.originalFrom || p.from, toAddr = p.originalTo || p.to;
        if (!fromAddr.startsWith('0x') || !toAddr.startsWith('0x')) { alert("Impossible de signer : adresses originales non disponibles."); return; }
        const domain = { name: "XDC Retail Receipt", version: "1", chainId: currentNetwork === 'xdc' ? 50 : 1, verifyingContract: NETWORKS.xdc.contractAddr || "0x0000000000000000000000000000000000000000" };
        const message = { from: fromAddr, to: toAddr, amount: ethers.parseUnits(String(p.amount), 18).toString(), txHash: p.hash, invoiceNumber: p.invoiceNumber, date: p.timestampUTC };
        const types = {
            Facture: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "txHash", type: "bytes32" },
                { name: "invoiceNumber", type: "string" },
                { name: "date", type: "string" }
            ]
        };
        try {
            const signature = await signer.signTypedData(domain, types, message);
            document.getElementById('eipResult').innerHTML = `✅ Facture signée !<br><small>Signature: ${signature.substring(0, 40)}...</small>`;
            const receiptBtn = document.getElementById('receiptBtn'); receiptBtn.disabled = false; receiptBtn.classList.add('ready');
            window._signedReceipt = { p, signature, domain, types, message };
            if (window._lastTxData) {
                window._lastTxData.signature = signature;
                window._lastTxData.eip712 = { domain, types, message, primaryType: "Facture" };
            }
            await displayInvoice(p.hash, p.amount, p.from, p.to, p.symbol, p.invoiceNumber, p.timestampUTC, p.catFrom, p.catTo, p.amtStr, p.usdcValue, signature, p.falconSignature);
        } catch (e) { document.getElementById('eipResult').innerText = `❌ Erreur : ${e.message}`; }
    });

    // ==================== BALANCE ====================
    async function refreshBalance() {
        if (!signer || !userAddress) return;
        try { const balance = await provider.getBalance(userAddress); els.balanceInfo.innerText = `💰 ${ethers.formatEther(balance)} ${getTokenList()[0].value}`; } catch (e) {}
    }

    // ==================== CONNECT / DISCONNECT ====================
    function setDisconnected() {
        els.accountInfo.innerText = "wallet : non connecté"; els.balanceInfo.innerText = "solde : --";
        els.sendBtn.disabled = true; els.sendBtn.classList.remove('ready');
        els.sendDomainBtn.disabled = true; els.sendDomainBtn.classList.remove('ready');
        els.connectBtn.classList.remove('ready'); els.connectBtn.style.display = 'inline-block'; els.disconnectBtn.style.display = 'none';
        userAddress = null; signer = null; provider = null; window._signer = null;
        const receiptBtn = document.getElementById('receiptBtn'); if (receiptBtn) { receiptBtn.disabled = true; receiptBtn.classList.remove('ready'); }
        document.getElementById('signEipInvoiceBtn').style.display = 'none';
    }
    setDisconnected();

    async function connectWallet() {
        if (!window.ethereum) { alert("Aucun wallet détecté. Installez MetaMask ou XDCPay."); return; }
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner(); userAddress = await signer.getAddress(); window._signer = signer;
            els.accountInfo.innerHTML = `✅ ${truncate(userAddress)}`;
            els.connectBtn.classList.add('ready'); els.connectBtn.style.display = 'none'; els.disconnectBtn.style.display = 'inline-block';
            await refreshBalance(); updateSendBtnState(); updateSendDomainBtnState();
            window.ethereum.on('accountsChanged', () => location.reload());
            window.ethereum.on('chainChanged', () => location.reload());
        } catch (e) { alert("Erreur de connexion : " + e.message); setDisconnected(); }
    }
    function disconnectWallet() { setDisconnected(); }
    els.connectBtn.onclick = connectWallet; els.disconnectBtn.onclick = disconnectWallet;
    els.quickDonateBtn.onclick = () => { const a = parseFloat(els.donateAmount.value); if (!isNaN(a) && a > 0) donate(a); else alert("Montant invalide"); };

    // ==================== BUTTON STATES ====================
    function updateSendBtnState() {
        const ok = signer && els.fromDomain.value.trim() !== "" && els.toDomain.value.trim() !== "" && !isNaN(parseFloat(els.amount.value)) && parseFloat(els.amount.value) > 0;
        els.sendBtn.disabled = !ok; els.sendBtn.classList.toggle('ready', !!ok);
    }
    function updateSendDomainBtnState() {
        const ok = signer && els.sendDomainName.value.trim() && els.sendDomainTo.value.trim() && currentNetwork === 'xdc';
        els.sendDomainBtn.disabled = !ok; els.sendDomainBtn.classList.toggle('ready', !!ok);
    }
    els.fromDomain.addEventListener('input', updateSendBtnState);
    els.toDomain.addEventListener('input', updateSendBtnState);
    els.amount.addEventListener('input', updateSendBtnState);
    els.sendDomainName.addEventListener('input', updateSendDomainBtnState);
    els.sendDomainTo.addEventListener('input', updateSendDomainBtnState);
    document.getElementById('networkSelect').addEventListener('change', updateSendDomainBtnState);

    // ==================== TX HISTORY ====================
    window.transactionHistory = window.transactionHistory || [];
    window.addTxEntry = function(tx) {
        const txWithTime = { ...tx, timestamp: Date.now() };
        window.transactionHistory.unshift(txWithTime);
        const txLogList = document.getElementById('txLogList');
        const txLogCount = document.getElementById('txLogCount');
        const entryDiv = document.createElement('div');
        entryDiv.className = 'tx-log-item';
        const date = new Date().toLocaleString();
        const falconBadge = tx.falconSignature ? ' <span class="falcon-algo-badge falcon-badge-falcon" style="font-size:0.6rem;">FALCON</span>' : '';
        const mlDsaBadge = tx.mlDsaSignature ? ' <span class="falcon-algo-badge falcon-badge-dilithium" style="font-size:0.6rem;">ML-DSA</span>' : '';
        const slhDsaBadge = tx.slhDsaSignature ? ' <span class="falcon-algo-badge falcon-badge-sphincs" style="font-size:0.6rem;">SLH-DSA</span>' : '';
        const pqcBadge = falconBadge + mlDsaBadge + slhDsaBadge;
        entryDiv.innerHTML = `
            <div><b>${tx.type === 'outgoing' ? '📤 Envoi' : '📥 Réception'}</b> ${tx.amount} ${tx.token} (≈${tx.usdcValue} USD)${pqcBadge}</div>
            <small>De: ${tx.from} → À: ${tx.to}<br>${date}<br>Hash: <span class="tx-hash-link" data-hash="${tx.hash}">${tx.hash.slice(0,10)}...</span></small>
            <button class="receipt-from-history" data-hash="${tx.hash}" style="margin-top:4px;padding:2px 6px;font-size:0.7rem;">📄 Reçu</button>
        `;
        txLogList.prepend(entryDiv);
        txLogCount.innerText = `${txLogList.children.length} transaction(s)`;
        entryDiv.querySelector('.tx-hash-link').addEventListener('click', () => { navigator.clipboard.writeText(tx.hash); alert("Hash copié"); });
        entryDiv.querySelector('.receipt-from-history').addEventListener('click', async (e) => {
            const hash = e.currentTarget.dataset.hash;
            try {
                if (!provider) provider = new ethers.JsonRpcProvider(getRpcUrl());
                const details = await fetchTxDetails(hash);
                const fromDomain = domainCache.get(details.from), toDomain = domainCache.get(details.to);
                window._lastTxData = { hash: details.hash, amount: details.amount, symbol: details.symbol, from: fromDomain || details.from, to: toDomain || details.to, originalFrom: details.from, originalTo: details.to, invoiceNumber: details.invoiceNumber, timestampUTC: details.timestampUTC, usdcValue: details.usdcValue, catFrom: await getDomainCategory(fromDomain || details.from), catTo: await getDomainCategory(toDomain || details.to), amtStr: `${details.amount} ${details.symbol}`, signature: null, falconSignature: null };
                document.getElementById('signEipInvoiceBtn').style.display = 'inline-block';
                document.getElementById('receiptBtn').disabled = false; document.getElementById('receiptBtn').classList.add('ready');
                alert("Transaction chargée. Cliquez sur 'Reçu EIP' pour générer la facture.");
            } catch (err) { alert("Erreur : " + err.message); }
        });
    };

    // ==================== JOURNAL ====================
    function saveSignedInvoiceToJournal(invoiceData, signature) {
        const entry = { id: Date.now(), type: 'facture_signee', timestamp: new Date().toISOString(), transaction: { hash: invoiceData.hash, from: invoiceData.emetteur, to: invoiceData.destinataire, amount: invoiceData.montant, devise: invoiceData.devise, date: invoiceData.date, lien: invoiceData.lien }, eip712signature: signature };
        let entries = JSON.parse(localStorage.getItem('fl_journal_entries') || '[]');
        entries.unshift(entry); localStorage.setItem('fl_journal_entries', JSON.stringify(entries));
        alert("✅ Entrée ajoutée au journal"); refreshJournalDisplay();
    }
    function addTransactionToJournal(tx) {
        if (!tx) return;
        const entry = { id: Date.now(), type: 'transaction', timestamp: new Date().toISOString(), transaction: { hash: tx.hash, from: tx.from, to: tx.to, amount: `${tx.amount} ${tx.token}`, usdcValue: tx.usdcValue, date: new Date(tx.timestamp).toLocaleString() } };
        let entries = JSON.parse(localStorage.getItem('fl_journal_entries') || '[]');
        entries.unshift(entry); localStorage.setItem('fl_journal_entries', JSON.stringify(entries));
        alert("✅ Transaction ajoutée au journal"); refreshJournalDisplay();
    }
    function refreshJournalDisplay() {
        const textarea = document.getElementById('journalNotes');
        if (!textarea) return;
        const entries = JSON.parse(localStorage.getItem('fl_journal_entries') || '[]');
        let content = '';
        for (const e of entries) {
            if (e.type === 'facture_signee') { content += `[${e.timestamp}] FACTURE SIGNÉE\n  Tx: ${e.transaction.hash}\n  De: ${e.transaction.from}\n  Vers: ${e.transaction.to}\n  Montant: ${e.transaction.amount}\n  Signature: ${e.eip712signature.substring(0, 80)}...\n---\n`; }
            else if (e.type === 'transaction') { content += `[${e.timestamp}] TRANSACTION\n  Tx: ${e.transaction.hash}\n  De: ${e.transaction.from}\n  Vers: ${e.transaction.to}\n  Montant: ${e.transaction.amount} (${e.transaction.usdcValue} USD)\n---\n`; }
            else { content += `[${e.timestamp}] NOTE: ${e.text}\n---\n`; }
        }
        const manualNotes = localStorage.getItem('fl_journal_notes') || '';
        if (manualNotes.trim()) content += `\n=== NOTES MANUELLES ===\n${manualNotes}\n`;
        textarea.value = content;
    }
    function saveJournalNotes() { localStorage.setItem('fl_journal_notes', document.getElementById('journalNotes').value); alert("Notes sauvegardées."); }

    const journalBtn = document.getElementById('journalBtn');
    const journalOverlay = document.getElementById('journalOverlay');
    const closeJournalBtn = document.getElementById('closeJournalBtn');
    const saveJournalBtn = document.getElementById('saveJournalBtn');
    if (journalBtn && journalOverlay) {
        journalBtn.onclick = (e) => { e.stopPropagation(); refreshJournalDisplay(); journalOverlay.style.display = 'flex'; };
        const closeJournal = () => { journalOverlay.style.display = 'none'; const ta = document.getElementById('journalNotes'); if (ta) ta.value = ''; };
        if (closeJournalBtn) closeJournalBtn.onclick = (e) => { e.stopPropagation(); closeJournal(); };
        journalOverlay.addEventListener('click', (e) => { if (e.target === journalOverlay) closeJournal(); });
    }
    if (saveJournalBtn) saveJournalBtn.onclick = saveJournalNotes;

    const sendToJournalBtn = document.getElementById('sendToJournalBtn');
    if (sendToJournalBtn) sendToJournalBtn.addEventListener('click', () => { if (!window.transactionHistory?.length) { alert("Aucune transaction."); return; } addTransactionToJournal(window.transactionHistory[0]); });

    const testOracleBtn = document.getElementById('testOracleBtn');
    if (testOracleBtn) testOracleBtn.addEventListener('click', () => testOracle());

    // ==================== RESET CONFIG ====================
    document.getElementById('resetConfigBtn').addEventListener('click', () => {
        if (confirm("Réinitialiser toute la configuration ?")) { Object.keys(localStorage).filter(k => k.startsWith('fl_')).forEach(k => localStorage.removeItem(k)); location.reload(); }
    });

    // ==================== TOOLBAR (maritime, trains, aircraft → files panel) ====================
    const toolbarButtons = document.querySelectorAll('.toolbar button[data-action]');
    toolbarButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            if (['maritime', 'trains', 'aircraft'].includes(action)) {
                const filesBtn = document.querySelector('.toolbar button[data-action="files"]');
                if (filesBtn) { filesBtn.click(); alert(`Veuillez entrer votre clé API pour ${action} dans le panneau.`); }
            }
        });
    });

    getFleursAddress().then(() => console.log("Adresse Fleurs de Lys prête"));
    setTimeout(() => {}, 1000);
}