// wallet.js – version finale stable (oracle, factures, historique, journal, etc.)
// Ajouts : classification corrigée, suppression de dieu.xdc, catégories verrouillées.
// Modification : montant de la facture = TTC, calcul du HT automatique.
// Renommage : "valeur_usdc_moment" → "valeur_ht_fiat".
// Ordre des champs harmonisé : HT juste avant TTC.
// Signature EIP‑712 automatique après l'envoi de la transaction.
// + Flux caisse : la facture n'est pas affichée automatiquement, seulement sur clic "Reçu EIP".
// + Téléchargement des reçus en .txt (JSON brut)
// + Suppression du bouton "générer le reçu" dans la section hash
// + Version client sans valeur_ht_fiat
// + Boutons d'action centrés et verts une fois prêts
// + Défilement automatique vers la section facture après génération du reçu
// + Correction : les boutons maritime, trains, aircraft ouvrent le panneau de configuration des clés API (via le bouton "files")

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

    // ==================== CACHE LOCAL (adresse → domaine) ====================
    const domainCache = {
        set(address, domain) {
            if (!address || !domain) return;
            let cache = JSON.parse(localStorage.getItem('fl_domain_cache') || '{}');
            cache[address.toLowerCase()] = domain;
            localStorage.setItem('fl_domain_cache', JSON.stringify(cache));
        },
        get(address) {
            if (!address) return null;
            let cache = JSON.parse(localStorage.getItem('fl_domain_cache') || '{}');
            return cache[address.toLowerCase()] || null;
        }
    };

    const els = {
        connectBtn:        document.getElementById('connectBtn'),
        disconnectBtn:     document.getElementById('disconnectBtn'),
        sendBtn:           document.getElementById('sendBtn'),
        accountInfo:       document.getElementById('accountInfo'),
        balanceInfo:       document.getElementById('balanceInfo'),
        txStatus:          document.getElementById('txStatus'),
        donateStatus:      document.getElementById('donateStatus'),
        invoiceContainer:  document.getElementById('invoiceContainer'),
        manualInvoice:     document.getElementById('manualInvoice'),
        fromDomain:        document.getElementById('fromDomain'),
        toDomain:          document.getElementById('toDomain'),
        amount:            document.getElementById('amount'),
        token:             document.getElementById('token'),
        quickDonateBtn:    document.getElementById('quickDonateBtn'),
        donateAmount:      document.getElementById('donateAmount'),
        invoiceHash:       document.getElementById('invoiceHash'),
        verifyHashBtn:     document.getElementById('verifyHashBtn'),
        invoiceFrom:       document.getElementById('invoiceFrom'),
        invoiceTo:         document.getElementById('invoiceTo'),
        invoiceAmount:     document.getElementById('invoiceAmount'),
        invoiceSymbol:     document.getElementById('invoiceSymbol'),
        // generateInvoiceBtn supprimé – plus de référence
        sendDomainBtn:     document.getElementById('sendDomainBtn'),
        sendDomainName:    document.getElementById('sendDomainName'),
        sendDomainTo:      document.getElementById('sendDomainTo'),
        sendDomainStatus:  document.getElementById('sendDomainStatus')
    };

    // ==================== VIDER LES CHAMPS DE CONFIGURATION OPTIONNELLE ====================
    const optionalFields = [
        'siretField', 'adresseSiegeField', 'objetPrestationField',
        'oracleAddressField', 'fiatCurrencyField', 'categoriePersoField', 'mentionTvaField'
    ];
    optionalFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const tvaField = document.getElementById('tvaField');
    if (tvaField) tvaField.value = '0';
    const fiatField = document.getElementById('fiatCurrencyField');
    if (fiatField && fiatField.value === '') fiatField.value = 'USD';

    // ==================== ORACLE ====================
    let oracleRawAnswer = null;
    let oracleDecimals = 8;
    let oraclePrice = null;
    const oraclePriceDisplay = document.getElementById('oraclePriceDisplay');
    const ttcEstimateDisplay = document.getElementById('ttcEstimateDisplay');
    if (oraclePriceDisplay) oraclePriceDisplay.innerText = 'Non testé';
    if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = '--';

    async function testOracle(customAddress = null) {
        const addr = customAddress || document.getElementById('oracleAddressField').value.trim();
        if (!addr) {
            alert("Veuillez entrer une adresse de contrat oracle.");
            return;
        }
        try {
            const p = new ethers.JsonRpcProvider(getRpcUrl());
            const oracle = new ethers.Contract(addr, [
                "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
                "function decimals() view returns (uint8)"
            ], p);
            const roundData = await oracle.latestRoundData();
            const answer = roundData.answer;
            const decimals = await oracle.decimals();
            oracleDecimals = Number(decimals);
            const realPrice = parseFloat(ethers.formatUnits(answer, oracleDecimals));
            oracleRawAnswer = answer;
            oraclePrice = realPrice;
            if (oraclePriceDisplay) oraclePriceDisplay.innerText = `${realPrice.toFixed(8)} USD/XDC`;
            updateTTCEstimateWithPrice(realPrice);
            alert(`Oracle testé : ${realPrice} USD/XDC`);
        } catch (e) {
            alert("Erreur oracle : " + e.message);
        }
    }

    function updateTTCEstimateWithPrice(price) {
        const amountInput = document.getElementById('amount');
        const tva = parseFloat(document.getElementById('tvaField')?.value) || 0;
        const regime = document.getElementById('regimeTvaField')?.value;
        const effectiveTva = regime === 'auto_entreprise' ? 0 : tva;
        const amount = parseFloat(amountInput?.value);
        if (!isNaN(amount) && price !== null && !isNaN(price)) {
            const ttc = amount * price * (1 + effectiveTva / 100);
            if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = `${ttc.toFixed(4)} ${document.getElementById('fiatCurrencyField')?.value || 'USD'}`;
        } else {
            if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = '--';
        }
    }

    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', () => {
            if (oraclePrice !== null) updateTTCEstimateWithPrice(oraclePrice);
            else if (ttcEstimateDisplay) ttcEstimateDisplay.innerText = '--';
        });
    }

    async function getCurrentXDCPrice() {
        if (oraclePrice !== null) return oraclePrice;
        try {
            const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=xinfin&vs_currencies=usd');
            const d = await r.json();
            if (d.xinfin && d.xinfin.usd) return d.xinfin.usd;
        } catch (e) {}
        return null;
    }

    let fleursAddress = null;

    async function getFleursAddress() {
        if (fleursAddress) return fleursAddress;
        try {
            const resolved = await resolveDomain("fleursdelys.xdc");
            fleursAddress = resolved;
            return resolved;
        } catch (e) {
            console.warn("Impossible de résoudre fleursdelys.xdc", e);
            return null;
        }
    }

    window.checkFLDomains = async function(domainNames) {
        const flAddr = await getFleursAddress();
        if (!flAddr) return [];
        const owned = [];
        for (const domain of domainNames) {
            try {
                let owner;
                try {
                    const r = await fetchWithTimeout(
                        `https://fleurs-resolver-final.vercel.app/api/resolve?domain=${encodeURIComponent(domain)}`,
                        5000
                    );
                    if (r.ok) { const data = await r.json(); owner = data.result; }
                } catch (e) {}
                if (!owner || owner === "0x0000000000000000000000000000000000000000") {
                    const p2 = new ethers.JsonRpcProvider(getRpcUrl());
                    const c  = new ethers.Contract(
                        NETWORKS.xdc.contractAddr,
                        ["function getDomainInfo(string name) view returns (tuple(address owner, address resolver, uint256 expiry))"],
                        p2
                    );
                    const info = await c.getDomainInfo(domain.toLowerCase().trim());
                    owner = info.owner;
                }
                if (owner && owner.toLowerCase() === flAddr.toLowerCase()) owned.push(domain);
            } catch (e) {}
        }
        return owned;
    };

    window.checkOwnedDomains = async function(domainNames) {
        if (!signer || !userAddress || currentNetwork !== 'xdc') return [];
        const owned = [];
        for (const domain of domainNames) {
            try {
                let owner;
                try {
                    const r = await fetchWithTimeout(
                        `https://fleurs-resolver-final.vercel.app/api/resolve?domain=${encodeURIComponent(domain)}`,
                        5000
                    );
                    if (r.ok) { const data = await r.json(); owner = data.result; }
                } catch (e) {}
                if (!owner || owner === "0x0000000000000000000000000000000000000000") {
                    const p2 = new ethers.JsonRpcProvider(getRpcUrl());
                    const c  = new ethers.Contract(
                        NETWORKS.xdc.contractAddr,
                        ["function getDomainInfo(string name) view returns (tuple(address owner, address resolver, uint256 expiry))"],
                        p2
                    );
                    const info = await c.getDomainInfo(domain.toLowerCase().trim());
                    owner = info.owner;
                }
                if (owner && owner.toLowerCase() === userAddress.toLowerCase()) owned.push(domain);
            } catch (e) {}
        }
        return owned;
    };

    const CATEGORY_DOMAINS = {
        pnj: ["alucard.xdc", "focalzero.xdc", "perseus.xdc", "nemesis.xdc", "prometheus.xdc", "heracles.xdc", "medusa.xdc", "nostradamus.xdc", "topgun.xdc", "saintseiya.xdc", "dragonballz.xdc", "angels.xdc", "voodoo.xdc", "tarot.xdc", "mythology.xdc", "licorne.xdc", "jeannedarc.xdc", "⚜️⚜️⚜️.xdc", "fleursdelys.xdc", "guilde.xdc", "suntzu.xdc", "suntsu.xdc", "arcadia.depin", "sanctuary.depin", "colossus.xdc", "berserk.xdc", "gemini.depin", "agents.xdc", "cryptomancer.xdc", "9thcircle.depin", "eva-01.depin", "wizard.depin", "quest.depin", "diceroll.depin", "deathnote.depin", "लक्ष्मी.xdc", "सरस्वती.xdc", "पार्वती.xdc", "त्रिदेवी.xdc"],
        energy: ["energy.depin", "energie.xdc", "энергия.xdc", "энергия.rwa", "энергия.depin", "crudeoil.rwa", "crudeoil.depin", "petroleum.rwa", "petroleum.depin", "thorium.depin", "carbon.depin", "pipeline.xdc", "pipeline.rwa", "pipeline.depin", "battery.rwa", "battery.depin"],
        minerals: ["argent.xdc", "золото.xdc", "золото.rwa", "золото.depin", "алмаз.xdc", "алмаз.rwa", "алмаз.depin", "металлы.xdc", "металлы.rwa", "металлы.depin", "platinium.xdc", "ruby.xdc", "sapphire.xdc", "sapphire.rwa", "sapphire.depin", "emerald.rwa", "emerald.depin", "aluminum.rwa", "aluminum.depin", "jewel.xdc", "necklace.xdc", "rings.xdc"],
        commodity: ["commodity.depin", "agriculture.rwa", "agriculture.depin", "coffee.rwa", "coffee.depin", "soybeans.rwa", "spices.xdc", "saffron.xdc", "saffron.rwa", "saffron.depin", "katana.xdc", "katana.rwa", "katana.depin"],
        compute: ["compute.xdc", "compute.rwa", "compute.depin", "computer.rwa", "computer.depin", "ordinateur.xdc", "motherboard.xdc", "speaker.xdc", "storage.rwa", "storage.depin", "datacenter.rwa", "datacenter.depin", "cloud.depin", "backup.depin", "internet.depin", "bandwidth.depin", "3dprinter.depin", "deeplearning.xdc", "quantum.depin", "singularity.xdc", "singularity.rwa", "singularity.depin", "spectrum.depin", "tesseract.xdc", "circle.depin", "node.depin", "ledger.depin"],
        network: ["xdcnetwork.depin", "ethereum.depin", "ripple.depin", "network.rwa", "network.depin", "oracle.rwa", "oracle.depin", "gateway.rwa", "gateway.depin", "nvidia.depin", "apple.depin", "microsoft.depin", "amazon.depin", "palantir.rwa", "palantir.depin", "deutschetelekom.rwa", "deutschetelekom.depin", "capsulecorp.xdc", "capsulecorp.rwa", "capsulecorp.depin"],
        industry: ["fincantieri.xdc", "fincantieri.rwa", "fincantieri.depin", "factory.depin", "gigafactory.rwa", "gigafactory.depin", "robotic.rwa", "robotic.depin", "cyborg.rwa", "cyborg.depin", "exoskeleton.xdc", "exoskeleton.rwa", "exoskeleton.depin", "starlink.rwa", "starlink.depin", "starship.rwa", "starship.depin", "satellite.rwa", "satellite.depin", "constellation.rwa", "constellation.depin", "spacetravel.xdc", "telescope.xdc", "astronomy.depin", "neuralink.rwa", "neuralink.depin", "colossus.rwa", "colossus.depin", "optimus.rwa", "optimus.depin", "logistics.depin", "supplychain.depin", "drones.depin"],
        mobility: ["mobility.xdc", "mobility.rwa", "mobility.depin", "voiture.xdc", "voitures.xdc", "motorcycle.rwa", "motorcycle.depin", "yacht.rwa", "yacht.depin", "maritime.rwa", "maritime.depin", "shipping.rwa", "shipping.depin", "navigation.xdc", "navigation.rwa", "navigation.depin", "aircraft.rwa", "aircraft.depin", "ar-lenses.xdc", "arlenses.xdc"],
        geopolitics: ["asia.depin", "africa.depin", "northamerica.rwa", "northamerica.depin", "oceania.depin", "global.rwa", "global.depin", "france.depin", "gallia.xdc", "gallia.rwa", "gallia.depin", "web3hexagone.xdc", "singapore.rwa", "singapore.depin", "🇸🇬.depin", "russia.depin", "thailand.rwa", "thailand.depin", "latvia.xdc", "latvija.xdc", "latvia.rwa", "latvija.rwa", "latvia.depin", "latvija.depin", "greenland.depin", "california.depin", "monaco.depin", "vatican.depin", "jerusalem.rwa", "jerusalem.depin", "babylon.depin", "helsinki.xdc", "دولة-قطر.xdc", "دولةقطر.xdc", "القرآن.xdc", "embassy.depin", "universe.depin", "cosmos.depin", "tartaria.depin", "legacy.depin"],
        finance: ["bourse.xdc", "finance.depin", "banking.rwa", "banking.depin", "liquidity.rwa", "liquidity.depin", "stablecoin.rwa", "stablecoin.depin", "payments.rwa", "payments.depin", "xmoney.xdc", "xmoney.rwa", "xmoney.depin", "settlement.rwa", "debt.rwa", "debt.depin", "assurance.rwa", "assurance.depin", "trade.depin", "immobilier.xdc", "immobilier.depin", "realestate.depin", "عقارات.xdc", "عقارات.rwa", "عقارات.depin", "mortgage.depin", "smartcity.rwa", "smartcity.depin"],
        gastronomy: ["champagne.rwa", "champagne.depin", "bordeaux.xdc", "armagnac.xdc", "armagnac.rwa", "armagnac.depin", "foiegras.xdc", "foiegras.rwa", "foiegras.depin", "tequila.xdc", "tequila.rwa", "tequila.depin", "ricard.xdc", "marieblachère.xdc", "boulangerie.xdc", "baguette.xdc", "fromage.xdc", "cheese.xdc", "cheese.rwa", "cheese.depin", "boucherie.xdc", "truffle.xdc", "truffle.rwa", "truffle.depin", "shrimp.xdc", "shrimp.rwa", "shrimp.depin", "protein.xdc", "food.rwa", "food.depin", "supermarket.rwa", "supermarket.depin", "hashish.xdc", "tabac.xdc"],
        art: ["artgallery.xdc", "artgallery.rwa", "artgallery.depin", "paint.xdc", "cinema.rwa", "cinema.depin", "streaming.xdc", "streaming.rwa", "streaming.depin", "broadcast.rwa", "broadcast.depin", "media.depin", "magazine.rwa", "magazine.depin", "studio.rwa", "studio.depin", "music.rwa", "guitar.rwa", "gaming.rwa", "gaming.depin", "casino.depin", "photographe.xdc", "camera.rwa", "mallworld.xdc", "design.depin"],
        health: ["pharmacie.xdc", "health.rwa", "health.depin", "healthcare.depin", "wellbeing.depin", "aloevera.rwa", "aloevera.depin", "bodyguard.xdc", "voyage.xdc", "travel.rwa", "travel.depin", "croisieres.xdc", "occasion.xdc", "globalstore.xdc", "religion.depin", "nature.depin", "controller.xdc", "controller.rwa", "controller.depin", "education.depin", "school.depin", "university.depin", "physics.depin", "mathematics.depin"],
        other: []
    };

    window.getDomainsByCategory = async function(category) {
        const domainsList = CATEGORY_DOMAINS[category];
        if (!domainsList || domainsList.length === 0) return [];
        const owned = await window.checkFLDomains(domainsList);
        return owned;
    };

    let activeCategoryButton = null;

    function updateCategoryResult(domains, category) {
        const resultDiv = document.getElementById('categoryResult');
        const contentDiv = document.getElementById('categoryResultContent');
        if (!resultDiv || !contentDiv) return;
        if (domains.length === 0) {
            contentDiv.innerHTML = `📂 Catégorie ${category} : aucun domaine possédé par Fleurs de Lys.`;
        } else {
            contentDiv.innerHTML = `📂 Catégorie ${category} :<br>✅ ${domains.join('<br>✅ ')}<br><br>📧 Contact : sem@fleursdelys.xyz`;
        }
        resultDiv.classList.add('show');
    }

    function hideCategoryResult() {
        const resultDiv = document.getElementById('categoryResult');
        if (resultDiv) resultDiv.classList.remove('show');
    }

    function setActiveButton(btn) {
        if (activeCategoryButton === btn) return;
        if (activeCategoryButton) activeCategoryButton.classList.remove('active');
        activeCategoryButton = btn;
        if (btn) btn.classList.add('active');
    }

    setTimeout(() => {
        const categoryButtons = document.querySelectorAll('#categoriesBar button');
        const closeCategoryBtn = document.getElementById('closeCategoryResult');
        if (!categoryButtons.length) return;

        categoryButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const category = btn.dataset.category;
                if (!category) return;
                if (activeCategoryButton === btn) return;
                setActiveButton(btn);
                const domains = await window.getDomainsByCategory(category);
                updateCategoryResult(domains, category);
            });
        });

        if (closeCategoryBtn) {
            closeCategoryBtn.addEventListener('click', () => {
                hideCategoryResult();
                if (activeCategoryButton) {
                    activeCategoryButton.classList.remove('active');
                    activeCategoryButton = null;
                }
            });
        }
    }, 1000);

    function setDisconnected() {
        els.accountInfo.innerText  = "wallet : non connecté";
        els.balanceInfo.innerText  = "solde : --";
        els.sendBtn.disabled       = true;  els.sendBtn.classList.remove('ready');
        els.sendDomainBtn.disabled = true;  els.sendDomainBtn.classList.remove('ready');
        els.connectBtn.classList.remove('ready');
        els.connectBtn.style.display    = 'inline-block';
        els.disconnectBtn.style.display = 'none';
        userAddress = null;
        signer      = null;
        provider    = null;
        window._signer = null;
        const receiptBtn = document.getElementById('receiptBtn');
        if (receiptBtn) { receiptBtn.disabled = true; receiptBtn.classList.remove('ready'); }
        document.getElementById('signEipInvoiceBtn').style.display = 'none';
    }
    setDisconnected();

    function updateSendBtnState() {
        const ok = signer && els.fromDomain.value.trim() !== "" && els.toDomain.value.trim() !== "" &&
                   !isNaN(parseFloat(els.amount.value)) && parseFloat(els.amount.value) > 0;
        els.sendBtn.disabled = !ok;
        els.sendBtn.classList.toggle('ready', !!ok);
    }
    els.fromDomain.addEventListener('input', updateSendBtnState);
    els.toDomain.addEventListener('input', updateSendBtnState);
    els.amount.addEventListener('input', updateSendBtnState);

    function updateSendDomainBtnState() {
        const ok = signer && els.sendDomainName.value.trim() &&
                   els.sendDomainTo.value.trim() && currentNetwork === 'xdc';
        els.sendDomainBtn.disabled = !ok;
        els.sendDomainBtn.classList.toggle('ready', !!ok);
    }
    els.sendDomainName.addEventListener('input', updateSendDomainBtnState);
    els.sendDomainTo.addEventListener('input', updateSendDomainBtnState);
    document.getElementById('networkSelect').addEventListener('change', updateSendDomainBtnState);

    function truncate(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''; }

    async function getDomainCategory(domain) {
        if (!domain || domain.startsWith('0x')) return null;
        const catPerso = document.getElementById('categoriePersoField').value.trim();
        if (catPerso) return catPerso;
        if (window.LOCAL_CATEGORIES && LOCAL_CATEGORIES[domain.toLowerCase()]) return LOCAL_CATEGORIES[domain.toLowerCase()];
        try {
            const parts = domain.split('.');
            if (parts.length >= 2 && parts.slice(-2).join('.').toLowerCase() === '⚜️⚜️⚜️.xdc') {
                const p = new ethers.JsonRpcProvider(getRpcUrl());
                const c = new ethers.Contract(
                    NETWORKS.xdc.contractAddr,
                    ["function getDomainInfo(string name) view returns (tuple(address owner, address resolver, uint256 expiry))"],
                    p
                );
                const info = await c.getDomainInfo(domain.toLowerCase().trim());
                if (info.owner !== ethers.ZeroAddress) return "Lore & Mythes";
            }
        } catch (e) {}
        return "invité";
    }

    async function fetchWithTimeout(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
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
                    ["function getAddress(string) view returns (address)"],
                    p
                );
                const a = await c.getAddress(domain.toLowerCase().trim());
                if (a && a !== "0x0000000000000000000000000000000000000000") return a;
            } catch (e) {}
        }
        throw new Error("Domaine non résolu : " + domain);
    }

    async function fetchTxDetails(h) {
        if (!provider) provider = new ethers.JsonRpcProvider(getRpcUrl());
        const tx = await provider.getTransaction(h);
        if (!tx) throw new Error("Transaction introuvable");
        let from = tx.from, to = tx.to, amount, symbol = getTokenList()[0].value, nonce = tx.nonce;
        if (tx.value && tx.value !== 0n) {
            amount = parseFloat(ethers.formatEther(tx.value));
        } else {
            const rc = await provider.getTransactionReceipt(h);
            if (!rc?.logs) throw new Error("Logs non trouvés");
            const top = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
            let found = false;
            for (const log of rc.logs) {
                if (log.topics[0] === top) {
                    from   = "0x" + log.topics[1].slice(26);
                    to     = "0x" + log.topics[2].slice(26);
                    amount = Number(ethers.formatUnits(ethers.toBigInt(log.data), 18));
                    found  = true;
                    break;
                }
            }
            if (!found) throw new Error("Aucun transfert détecté");
        }
        const block = await provider.getBlock(tx.blockNumber);
        const ts    = new Date(block.timestamp * 1000).toISOString();
        const short = h.slice(2, 10);
        const inv   = `FDL-${new Date().getFullYear()}-${short}${nonce}`;
        const xdcPrice = await getCurrentXDCPrice();
        const usdValue = (xdcPrice !== null && !isNaN(amount)) ? (amount * xdcPrice).toFixed(4) : null;
        return { amount, symbol, from, to, invoiceNumber: inv, timestampUTC: ts, usdcValue: usdValue };
    }

    async function qrDataURL(data, size = 150) {
        const u = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
        const b = await (await fetch(u)).blob();
        return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(b); });
    }

    function getConfigFields() {
        return {
            siret:                  document.getElementById('siretField').value.trim(),
            tva:                    parseFloat(document.getElementById('tvaField').value) || 0,
            adresse_siege:          document.getElementById('adresseSiegeField').value.trim(),
            objet_prestation:       document.getElementById('objetPrestationField').value.trim(),
            fiatCurrency:           document.getElementById('fiatCurrencyField').value.trim() || 'USD',
            categorie_personnalisee:document.getElementById('categoriePersoField').value.trim(),
            regime_tva:             document.getElementById('regimeTvaField').value,
            mention_tva:            document.getElementById('mentionTvaField').value.trim()
        };
    }

    async function buildInvoiceData(h, amt, from, to, sym, inv, ts, catFrom, catTo, amtStr, usdValue, signature) {
        const cfg = getConfigFields();
        const price = oraclePrice;
        const effTva = cfg.regime_tva === 'auto_entreprise' ? 0 : cfg.tva;
        let ttc_fiat = null, ht_fiat = null, rate = null;

        const ttc_amt = parseFloat(amt);
        const ht_amt = effTva > 0 ? ttc_amt / (1 + effTva / 100) : ttc_amt;

        if (price && !isNaN(ttc_amt)) {
            rate = price;
            ttc_fiat = ttc_amt * price;
            ht_fiat = ht_amt * price;
        }

        const mention = cfg.regime_tva === 'auto_entreprise'
            ? (cfg.mention_tva || "TVA non applicable, art. 293B du CGI")
            : cfg.mention_tva;

        const f = {
            numero: inv,
            emetteur: from,
            categorie_emetteur: catFrom || "invité",
            destinataire: to,
            categorie_destinataire: catTo || "invité",
            montant: `${ttc_amt} ${sym}`,
            devise: sym,
            date: ts,
            hash: h,
            lien: getExplorerUrl(h),
            valeur_ht_fiat: ht_fiat !== null ? `${ht_fiat.toFixed(4)} ${cfg.fiatCurrency}` : null,
            tva_appliquee: effTva > 0 ? `${effTva}%` : (cfg.regime_tva === 'auto_entreprise' ? "0% (auto-entreprise)" : undefined),
            montant_ttc_fiat: ttc_fiat !== null ? `${ttc_fiat.toFixed(4)} ${cfg.fiatCurrency}` : null,
            taux_change_utilise: rate !== null ? `${rate.toFixed(8)} ${cfg.fiatCurrency}/${sym}` : null,
            siret: cfg.siret || undefined,
            adresse_siege: cfg.adresse_siege || undefined,
            objet_prestation: cfg.objet_prestation || undefined,
            mention_tva: mention || undefined
        };
        if (signature) f.eip712_signature = signature;
        Object.keys(f).forEach(key => f[key] === undefined && delete f[key]);
        return f;
    }

    function buildClientData(f) {
        const c = { ...f };
        // Supprimer les champs techniques et la valeur HT en fiat
        ['categorie_emetteur', 'categorie_destinataire', 'siret', 'adresse_siege',
         'objet_prestation', 'mention_tva', 'eip712_signature', 'valeur_ht_fiat']
            .forEach(k => delete c[k]);
        return c;
    }

    function printInvoice() {
        const content = els.invoiceContainer.innerHTML;
        if (!content || els.invoiceContainer.style.display === 'none') {
            alert("Aucune facture à imprimer.");
            return;
        }
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><title>Impression facture</title>
            <style>
                body { font-family: monospace; padding: 20px; background: white; color: #1e2a3a; }
                pre { white-space: pre-wrap; }
                .qr-code-img { text-align: center; margin: 20px 0; }
                .qr-code-img img { width: 180px; height: 180px; }
            </style>
            </head><body>${content}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }

    async function displayInvoice(h, amt, from, to, sym, inv, ts, catFrom = null, catTo = null, amtStr = null, usdValue = null, signature = null) {
        const full      = await buildInvoiceData(h, amt, from, to, sym, inv, ts, catFrom, catTo, amtStr, usdValue, signature);
        const client    = buildClientData(full);
        const qrD       = { hash: h, from, to, amount: amtStr || `${amt} ${sym}`, date: ts, explorer: getExplorerUrl(h), usd: usdValue };
        const qrURL     = await qrDataURL(JSON.stringify(qrD));
        const fullStr   = JSON.stringify({ facture: full }, null, 2);
        const clientStr = JSON.stringify({ facture: client }, null, 2);

        els.invoiceContainer.innerHTML = `<pre style="white-space:pre-wrap;">${fullStr}</pre><div class="qr-code-img"><img src="${qrURL}" alt="QR"></div>`;
        els.invoiceContainer.style.display = 'block';

        // Afficher et activer les boutons
        ['copyJsonBtn','copyHashBtn','saveClientBtn','saveComptaBtn','saveBothBtn','printInvoiceBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = 'inline-block';
                btn.classList.add('ready'); // vert
            }
        });

        document.getElementById('copyJsonBtn').onclick  = () => { navigator.clipboard.writeText(fullStr);  alert("JSON copié"); };
        document.getElementById('copyHashBtn').onclick  = () => { navigator.clipboard.writeText(h);         alert("Hash copié"); };
        document.getElementById('saveClientBtn').onclick = () => downloadInvoice(clientStr, inv, 'client');
        document.getElementById('saveComptaBtn').onclick = () => downloadInvoice(fullStr,   inv, 'comptable');
        document.getElementById('saveBothBtn').onclick   = () => {
            downloadInvoice(clientStr, inv, 'client');
            setTimeout(() => downloadInvoice(fullStr, inv, 'comptable'), 500);
        };
        document.getElementById('printInvoiceBtn').onclick = printInvoice;

        if (typeof detectAndShowMainLocation === 'function') detectAndShowMainLocation();

        // ===== NOUVEAU : Défilement automatique vers la section de la facture =====
        const invoiceSection = document.getElementById('invoiceSection');
        if (invoiceSection) {
            invoiceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Nouvelle fonction : téléchargement en .txt (JSON brut)
    function downloadInvoice(jsonStr, inv, suffix) {
        const blob = new Blob([jsonStr], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `recu_${inv}_${suffix}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        alert("Reçu téléchargé en .txt");
    }

    async function refreshBalance() {
        if (!signer || !userAddress) return;
        try {
            const balance = await provider.getBalance(userAddress);
            const sym     = getTokenList()[0].value;
            els.balanceInfo.innerText = `💰 ${ethers.formatEther(balance)} ${sym}`;
        } catch (e) {}
    }

    async function attemptAutoSign() {
        const p = window._lastTxData;
        if (!p) return;
        if (!signer) {
            console.warn("Wallet non connecté, impossible de signer automatiquement.");
            return;
        }

        const fromAddr = p.originalFrom || p.from;
        const toAddr = p.originalTo || p.to;
        if (!fromAddr.startsWith('0x') || !toAddr.startsWith('0x')) {
            console.warn("Adresses originales non disponibles, signature automatique annulée.");
            return;
        }

        const domain = {
            name: "FleursDeLys",
            version: "1",
            chainId: currentNetwork === 'xdc' ? 50 : 1,
            verifyingContract: NETWORKS.xdc.contractAddr || "0x0000000000000000000000000000000000000000"
        };

        const message = {
            from: fromAddr,
            to: toAddr,
            amount: ethers.parseUnits(String(p.amount), 18).toString(),
            txHash: p.hash,
            invoiceNumber: p.invoiceNumber,
            date: p.timestampUTC
        };

        const types = {
            Message: [
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
            console.log("Signature EIP-712 obtenue :", signature.substring(0, 40) + "...");
            window._signedReceipt = { p, signature };
            window._lastTxData.signature = signature;
            return signature;
        } catch (e) {
            console.warn("Signature automatique refusée ou erreur :", e.message);
            const eipResult = document.getElementById('eipResult');
            if (eipResult) eipResult.innerHTML = `⚠️ Signature automatique annulée. Vous pouvez la signer manuellement.`;
            return null;
        }
    }

    async function donate(amt) {
        if (!signer) return alert("Connectez wallet.");
        if (isNaN(amt) || amt <= 0) return;
        els.donateStatus.innerHTML = "⏳ Envoi...";
        try {
            const target   = currentNetwork === 'xdc' ? await resolveDomain("fleursdelys.xdc") : userAddress;
            const fromDisp = els.fromDomain.value || truncate(userAddress);
            const tx       = await signer.sendTransaction({ to: target, value: ethers.parseEther(amt.toString()), gasLimit: 50000 });
            els.donateStatus.innerHTML = `📡 Tx: ${tx.hash.slice(0, 10)}...`;
            await tx.wait();
            const tok = getTokenList()[0].value;
            els.donateStatus.innerHTML = `✅ Don de ${amt} ${tok} effectué !`;
            await refreshBalance();
            const d = await fetchTxDetails(tx.hash);
            const fromCat = await getDomainCategory(fromDisp);
            const toCat = "Trésorerie";
            addTxEntry({
                type: 'outgoing', from: fromDisp, to: target, amount: amt, token: tok,
                hash: tx.hash, usdcValue: d.usdcValue,
                siret:       document.getElementById('siretField').value.trim(),
                tva:         document.getElementById('tvaField').value,
                catEmetteur: fromCat, catDestinataire: toCat
            });
            window._lastTxData = {
                hash: tx.hash, amount: amt, symbol: tok,
                from: fromDisp, to: "fleursdelys.xdc",
                originalFrom: d.from, originalTo: d.to,
                invoiceNumber: d.invoiceNumber, timestampUTC: d.timestampUTC,
                usdcValue: d.usdcValue, catFrom: fromCat, catTo: toCat, amtStr: null,
                signature: null
            };
            const receiptBtn = document.getElementById('receiptBtn');
            receiptBtn.disabled = false;
            receiptBtn.classList.add('ready');
            els.donateStatus.innerHTML += '<br>📄 Cliquez sur "Reçu EIP" pour générer la facture.';
        } catch (e) { els.donateStatus.innerHTML = `❌ ${e.message}`; }
    }

    async function connectWallet() {
        if (!window.ethereum) {
            alert("Aucun wallet détecté. Installez MetaMask ou XDCPay puis rechargez la page.");
            return;
        }
        try {
            provider    = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer      = await provider.getSigner();
            userAddress = await signer.getAddress();
            window._signer = signer;

            els.accountInfo.innerHTML       = `✅ ${truncate(userAddress)}`;
            els.connectBtn.classList.add('ready');
            els.connectBtn.style.display    = 'none';
            els.disconnectBtn.style.display = 'inline-block';

            await refreshBalance();
            updateSendBtnState();
            updateSendDomainBtnState();

            window.ethereum.on('accountsChanged', () => location.reload());
            window.ethereum.on('chainChanged', () => location.reload());

        } catch (e) {
            alert("Erreur de connexion : " + e.message);
            setDisconnected();
        }
    }

    function disconnectWallet() {
        setDisconnected();
    }

    els.connectBtn.onclick    = connectWallet;
    els.disconnectBtn.onclick = disconnectWallet;
    els.quickDonateBtn.onclick = () => {
        const a = parseFloat(els.donateAmount.value);
        if (!isNaN(a) && a > 0) donate(a);
        else alert("Montant invalide");
    };

    els.sendBtn.onclick = async () => {
        const toDomainName = els.toDomain.value.trim();
        const amt  = parseFloat(els.amount.value);
        const tok  = els.token.value;
        const fromDomainName = els.fromDomain.value.trim();
        if (!toDomainName || isNaN(amt) || amt <= 0) return alert("Remplissez les champs.");
        if (!signer) return alert("Connectez wallet.");
        els.txStatus.innerHTML = "🔍 Vérification du domaine émetteur...";
        try {
            if (fromDomainName && !fromDomainName.startsWith('0x')) {
                const resolvedFrom = await resolveDomain(fromDomainName);
                if (resolvedFrom.toLowerCase() !== userAddress.toLowerCase()) {
                    els.txStatus.innerHTML = "❌ Le domaine émetteur ne correspond pas à votre wallet.";
                    return;
                }
            } else {
                els.txStatus.innerHTML = "❌ Vous devez spécifier un domaine émetteur valide (ex: monfils.xdc).";
                return;
            }
            const targetAddress = await resolveDomain(toDomainName);
            domainCache.set(targetAddress, toDomainName);
            domainCache.set(userAddress, fromDomainName);

            els.txStatus.innerHTML = `⏳ Envoi de ${amt} ${tok}...`;
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

            try {
                await refreshBalance();
                const d = await fetchTxDetails(tx.hash);
                const fromCat  = await getDomainCategory(fromDomainName);
                const toCat    = await getDomainCategory(toDomainName);
                addTxEntry({
                    type: 'outgoing', from: fromDomainName, to: toDomainName, amount: amt, token: tok,
                    hash: tx.hash, usdcValue: d.usdcValue,
                    siret: document.getElementById('siretField').value.trim(),
                    tva:   document.getElementById('tvaField').value,
                    catEmetteur: fromCat, catDestinataire: toCat
                });
                window._lastTxData = {
                    hash: tx.hash, amount: amt, symbol: tok,
                    from: fromDomainName, to: toDomainName,
                    originalFrom: d.from, originalTo: d.to,
                    invoiceNumber: d.invoiceNumber, timestampUTC: d.timestampUTC,
                    usdcValue: d.usdcValue, catFrom: fromCat, catTo: toCat, amtStr: null,
                    signature: null
                };
                const receiptBtn = document.getElementById('receiptBtn');
                receiptBtn.disabled = false;
                receiptBtn.classList.add('ready');
                els.txStatus.innerHTML += '<br>📄 Cliquez sur "Reçu EIP" pour générer la facture.';
                els.amount.value = '';
                updateSendBtnState();
            } catch (postErr) {
                els.txStatus.innerHTML += `<br>⚠️ Erreur post-transaction : ${postErr.message}`;
                console.error(postErr);
            }
        } catch (e) {
            els.txStatus.innerHTML += `<br>❌ ${e.message}`;
        }
    };

    els.sendDomainBtn.onclick = async () => {
        const domainName = els.sendDomainName.value.trim();
        let toDomainOrAddr = els.sendDomainTo.value.trim();
        if (!domainName || !toDomainOrAddr) return alert("Remplissez le nom du domaine et l'adresse destinataire.");
        if (!signer)               return alert("Connectez wallet.");
        if (currentNetwork !== 'xdc') return alert("L'envoi de domaine n'est disponible que sur XDC Network.");

        els.sendDomainStatus.innerHTML = "🔍 Résolution du destinataire...";
        try {
            let targetAddress;
            let targetDisplay = toDomainOrAddr;
            if (!toDomainOrAddr.startsWith('0x')) {
                targetAddress = await resolveDomain(toDomainOrAddr);
                targetDisplay = toDomainOrAddr;
                els.sendDomainStatus.innerHTML = `✅ Destinataire résolu : ${targetAddress.slice(0, 6)}...`;
            } else {
                targetAddress = toDomainOrAddr;
            }
            if (!targetAddress.startsWith('0x') || targetAddress.length !== 42) return alert("Adresse destinataire invalide.");

            const contract = new ethers.Contract(NETWORKS.xdc.contractAddr, [
                "function getTokenId(string name) view returns (uint256)",
                "function ownerOf(uint256 tokenId) view returns (address)",
                "function transferFrom(address from, address to, uint256 tokenId)"
            ], signer);

            const tokenId = await contract.getTokenId(domainName.toLowerCase().trim());
            const owner   = await contract.ownerOf(tokenId);
            if (owner.toLowerCase() !== userAddress.toLowerCase()) {
                els.sendDomainStatus.innerHTML = "❌ Ce domaine ne vous appartient pas.";
                return;
            }

            els.sendDomainStatus.innerHTML = "⏳ Transfert du domaine...";
            const tx = await contract.transferFrom(userAddress, targetAddress, tokenId, { gasLimit: 150000 });
            els.sendDomainStatus.innerHTML = `📡 Tx: ${tx.hash.slice(0, 10)}...`;
            await tx.wait();
            els.sendDomainStatus.innerHTML += '<br>✅ Succès !';

            const invoiceNumber  = `FDL-${new Date().getFullYear()}-${tx.hash.slice(2, 10)}`;
            const timestampUTC   = new Date().toISOString();
            const fromCat        = await getDomainCategory(domainName);
            const toCat          = await getDomainCategory(targetDisplay);
            const xdcPrice       = await getCurrentXDCPrice();
            const usdValueStr    = (xdcPrice !== null) ? (1 * xdcPrice).toFixed(4) : null;

            addTxEntry({
                type: 'outgoing', from: domainName, to: targetDisplay,
                amount: '1', token: 'NFT', hash: tx.hash, usdcValue: usdValueStr,
                siret:       document.getElementById('siretField').value.trim(),
                tva:         document.getElementById('tvaField').value,
                catEmetteur: fromCat, catDestinataire: toCat
            });

            window._lastTxData = {
                hash: tx.hash, amount: 1, symbol: 'NFT',
                from: domainName, to: targetDisplay,
                originalFrom: userAddress, originalTo: targetAddress,
                invoiceNumber, timestampUTC,
                usdcValue: usdValueStr, catFrom: fromCat, catTo: toCat, amtStr: '1 NFT',
                signature: null
            };
            const receiptBtn = document.getElementById('receiptBtn');
            receiptBtn.disabled = false;
            receiptBtn.classList.add('ready');
            els.sendDomainStatus.innerHTML += '<br>📄 Cliquez sur "Reçu EIP" pour générer la facture.';

            if (typeof detectAndShowMainLocation === 'function') detectAndShowMainLocation();
            els.sendDomainName.value = '';
            els.sendDomainTo.value   = '';
            updateSendDomainBtnState();

        } catch (e) { els.sendDomainStatus.innerHTML = `❌ ${e.message}`; }
    };

    document.getElementById('receiptBtn').addEventListener('click', async () => {
        const data = window._lastTxData;
        if (!data) {
            alert("Aucune transaction récente. Effectuez un paiement d'abord.");
            return;
        }
        let signature = data.signature;
        if (!signature) {
            const result = await attemptAutoSign();
            if (result) signature = result;
            if (signature) window._lastTxData.signature = signature;
        }
        await displayInvoice(
            data.hash, data.amount, data.from, data.to, data.symbol,
            data.invoiceNumber, data.timestampUTC,
            data.catFrom, data.catTo, data.amtStr, data.usdcValue,
            signature
        );
        alert("Facture générée. Utilisez les boutons ci-dessous pour l'imprimer ou la télécharger.");
    });

    els.verifyHashBtn.onclick = async () => {
        const h = els.invoiceHash.value.trim();
        if (!h?.startsWith('0x') || h.length < 66) return alert("Hash invalide.");
        els.manualInvoice.style.display = 'none';
        try {
            if (!provider) provider = new ethers.JsonRpcProvider(getRpcUrl());
            const { amount, symbol, from, to, invoiceNumber, timestampUTC, usdcValue } = await fetchTxDetails(h);
            
            const fromDomain = domainCache.get(from);
            const toDomain = domainCache.get(to);
            const fromDisplay = fromDomain || from;
            const toDisplay = toDomain || to;
            
            els.invoiceAmount.value  = amount;
            els.invoiceSymbol.value  = symbol;
            els.invoiceSymbol.disabled = true;
            els.invoiceFrom.value    = fromDisplay;
            els.invoiceTo.value      = toDisplay;
            
            alert(`✅ Vérifié : ${amount} ${symbol} (≈${usdcValue} USD)${fromDomain ? `\nÉmetteur: ${fromDomain}` : ''}${toDomain ? `\nDestinataire: ${toDomain}` : ''}`);
            
            window._lastTxData = { 
                hash: h, amount, symbol, 
                from: fromDisplay, 
                to: toDisplay,
                originalFrom: from,
                originalTo: to,
                invoiceNumber, timestampUTC, usdcValue,
                catFrom: await getDomainCategory(fromDisplay),
                catTo: await getDomainCategory(toDisplay),
                amtStr: `${amount} ${symbol}`,
                signature: null
            };
            document.getElementById('signEipInvoiceBtn').style.display = 'inline-block';
            document.getElementById('receiptBtn').disabled = false;
            document.getElementById('receiptBtn').classList.add('ready');
        } catch (e) { alert("Erreur : " + e.message); }
    };

    // Le gestionnaire de 'generateInvoiceBtn' est supprimé car le bouton n'existe plus.

    function saveSignedInvoiceToJournal(invoiceData, signature) {
        const entry = {
            id: Date.now(),
            type: 'facture_signee',
            timestamp: new Date().toISOString(),
            transaction: {
                hash: invoiceData.hash,
                from: invoiceData.emetteur,
                to: invoiceData.destinataire,
                amount: invoiceData.montant,
                devise: invoiceData.devise,
                date: invoiceData.date,
                lien: invoiceData.lien
            },
            eip712signature: signature
        };
        let journalEntries = JSON.parse(localStorage.getItem('fl_journal_entries') || '[]');
        journalEntries.unshift(entry);
        localStorage.setItem('fl_journal_entries', JSON.stringify(journalEntries));
        alert("✅ Entrée ajoutée au journal (onglet 📖)");
        refreshJournalDisplay();
    }

    function addTransactionToJournal(tx) {
        if (!tx) return;
        const entry = {
            id: Date.now(),
            type: 'transaction',
            timestamp: new Date().toISOString(),
            transaction: {
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                amount: `${tx.amount} ${tx.token}`,
                usdcValue: tx.usdcValue,
                date: new Date(tx.timestamp).toLocaleString()
            }
        };
        let journalEntries = JSON.parse(localStorage.getItem('fl_journal_entries') || '[]');
        journalEntries.unshift(entry);
        localStorage.setItem('fl_journal_entries', JSON.stringify(journalEntries));
        alert("✅ Transaction ajoutée au journal");
        refreshJournalDisplay();
    }

    function refreshJournalDisplay() {
        const textarea = document.getElementById('journalNotes');
        if (!textarea) return;
        const entries = JSON.parse(localStorage.getItem('fl_journal_entries') || '[]');
        if (entries.length === 0) {
            textarea.value = localStorage.getItem('fl_journal_notes') || '';
            return;
        }
        let content = '';
        for (const e of entries) {
            if (e.type === 'facture_signee') {
                content += `[${e.timestamp}] FACTURE SIGNÉE EIP-712\n`;
                content += `  Tx: ${e.transaction.hash}\n`;
                content += `  De: ${e.transaction.from}\n`;
                content += `  Vers: ${e.transaction.to}\n`;
                content += `  Montant: ${e.transaction.amount}\n`;
                content += `  Signature: ${e.eip712signature.substring(0, 80)}...\n`;
                content += `  Lien: ${e.transaction.lien}\n`;
                content += `---\n`;
            } else if (e.type === 'transaction') {
                content += `[${e.timestamp}] TRANSACTION\n`;
                content += `  Tx: ${e.transaction.hash}\n`;
                content += `  De: ${e.transaction.from}\n`;
                content += `  Vers: ${e.transaction.to}\n`;
                content += `  Montant: ${e.transaction.amount} (${e.transaction.usdcValue} USD)\n`;
                content += `---\n`;
            } else {
                content += `[${e.timestamp}] NOTE: ${e.text}\n---\n`;
            }
        }
        const manualNotes = localStorage.getItem('fl_journal_notes') || '';
        if (manualNotes.trim()) {
            content += `\n=== NOTES MANUELLES ===\n${manualNotes}\n`;
        }
        textarea.value = content;
    }

    function saveJournalNotes() {
        const notes = document.getElementById('journalNotes').value;
        localStorage.setItem('fl_journal_notes', notes);
        alert("Notes sauvegardées.");
    }

    document.getElementById('signEipInvoiceBtn').addEventListener('click', async () => {
        const p = window._lastTxData || window._pendingManual;
        if (!p) return alert("Vérifiez d'abord un hash.");
        if (!signer) return alert("Connectez le wallet.");

        const fromAddr = p.originalFrom || p.from;
        const toAddr = p.originalTo || p.to;
        if (!fromAddr.startsWith('0x') || !toAddr.startsWith('0x')) {
            alert("Impossible de signer : les adresses originales ne sont pas disponibles.");
            return;
        }

        const domain = {
            name: "FleursDeLys",
            version: "1",
            chainId: currentNetwork === 'xdc' ? 50 : 1,
            verifyingContract: NETWORKS.xdc.contractAddr || "0x0000000000000000000000000000000000000000"
        };

        const message = {
            from: fromAddr,
            to: toAddr,
            amount: ethers.parseUnits(String(p.amount), 18).toString(),
            txHash: p.hash,
            invoiceNumber: p.invoiceNumber,
            date: p.timestampUTC
        };

        const types = {
            Message: [
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
            
            const receiptBtn = document.getElementById('receiptBtn');
            receiptBtn.disabled = false;
            receiptBtn.classList.add('ready');
            
            window._signedReceipt = { p, signature };
            if (window._lastTxData) window._lastTxData.signature = signature;
            
            await displayInvoice(p.hash, p.amount, p.from, p.to, p.symbol, p.invoiceNumber, p.timestampUTC,
                p.catFrom, p.catTo, p.amtStr, p.usdcValue, signature);
            
        } catch (e) {
            document.getElementById('eipResult').innerText = `❌ Erreur : ${e.message}`;
        }
    });

    window.transactionHistory = window.transactionHistory || [];

    window.addTxEntry = function(tx) {
        const txWithTime = { ...tx, timestamp: Date.now() };
        window.transactionHistory.unshift(txWithTime);
        
        const txLogList = document.getElementById('txLogList');
        const txLogCount = document.getElementById('txLogCount');
        const entryDiv = document.createElement('div');
        entryDiv.className = 'tx-log-item';
        const date = new Date().toLocaleString();
        entryDiv.innerHTML = `
            <div><b>${tx.type === 'outgoing' ? '📤 Envoi' : '📥 Réception'}</b> ${tx.amount} ${tx.token} (≈${tx.usdcValue} USD)</div>
            <small>De: ${tx.from} → À: ${tx.to}<br>${date}<br>Hash: <span class="tx-hash-link" data-hash="${tx.hash}">${tx.hash.slice(0,10)}...</span></small>
            <button class="receipt-from-history" data-hash="${tx.hash}" style="margin-top:4px; padding:2px 6px; font-size:0.7rem;">📄 Reçu</button>
        `;
        txLogList.prepend(entryDiv);
        const count = txLogList.children.length;
        txLogCount.innerText = `${count} transaction(s)`;
        
        entryDiv.querySelector('.tx-hash-link').addEventListener('click', () => {
            navigator.clipboard.writeText(tx.hash);
            alert("Hash copié dans le presse-papier");
        });
        entryDiv.querySelector('.receipt-from-history').addEventListener('click', async (e) => {
            const hash = e.currentTarget.dataset.hash;
            try {
                if (!provider) provider = new ethers.JsonRpcProvider(getRpcUrl());
                const details = await fetchTxDetails(hash);
                const fromDomain = domainCache.get(details.from);
                const toDomain = domainCache.get(details.to);
                const fromDisplay = fromDomain || details.from;
                const toDisplay = toDomain || details.to;
                const fromCat = await getDomainCategory(fromDisplay);
                const toCat = await getDomainCategory(toDisplay);
                window._lastTxData = { 
                    hash: details.hash, amount: details.amount, symbol: details.symbol, 
                    from: fromDisplay, to: toDisplay,
                    originalFrom: details.from, originalTo: details.to,
                    invoiceNumber: details.invoiceNumber, timestampUTC: details.timestampUTC,
                    usdcValue: details.usdcValue, catFrom: fromCat, catTo: toCat,
                    amtStr: `${details.amount} ${details.symbol}`,
                    signature: null
                };
                document.getElementById('signEipInvoiceBtn').style.display = 'inline-block';
                document.getElementById('receiptBtn').disabled = false;
                document.getElementById('receiptBtn').classList.add('ready');
                alert("Transaction chargée. Cliquez sur 'Reçu EIP' pour générer la facture.");
            } catch(err) {
                alert("Erreur : " + err.message);
            }
        });
    };

    document.getElementById('resetConfigBtn').addEventListener('click', () => {
        if (confirm("Réinitialiser toute la configuration locale (clés API, paramètres, historique) ?")) {
            Object.keys(localStorage).filter(k => k.startsWith('fl_')).forEach(k => localStorage.removeItem(k));
            location.reload();
        }
    });

    const journalBtn = document.getElementById('journalBtn');
    const journalOverlay = document.getElementById('journalOverlay');
    const closeJournalBtn = document.getElementById('closeJournalBtn');
    const saveJournalBtn = document.getElementById('saveJournalBtn');
    
    if (journalBtn && journalOverlay) {
        journalBtn.onclick = (e) => {
            e.stopPropagation();
            refreshJournalDisplay();
            journalOverlay.style.display = 'flex';
        };
        const closeJournal = () => {
            journalOverlay.style.display = 'none';
            const ta = document.getElementById('journalNotes');
            if (ta) ta.value = '';
        };
        if (closeJournalBtn) closeJournalBtn.onclick = (e) => { e.stopPropagation(); closeJournal(); };
        journalOverlay.addEventListener('click', (e) => { if (e.target === journalOverlay) closeJournal(); });
    }
    if (saveJournalBtn) saveJournalBtn.onclick = saveJournalNotes;

    const sendToJournalBtn = document.getElementById('sendToJournalBtn');
    if (sendToJournalBtn) {
        sendToJournalBtn.addEventListener('click', () => {
            if (!window.transactionHistory || window.transactionHistory.length === 0) {
                alert("Aucune transaction dans l'historique.");
                return;
            }
            const lastTx = window.transactionHistory[0];
            addTransactionToJournal(lastTx);
        });
    }

    const testOracleBtn = document.getElementById('testOracleBtn');
    if (testOracleBtn) {
        testOracleBtn.addEventListener('click', () => testOracle());
    }

    // ==================== GESTION DES BOUTONS API (MARITIME, TRAINS, AIRCRAFT) ====================
    // On attache un écouteur aux boutons de la barre d'outils
    const toolbarButtons = document.querySelectorAll('.toolbar button[data-action]');
    toolbarButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const action = this.dataset.action;
            // Si l'action est maritime, trains ou aircraft, on ouvre le panneau de configuration via le bouton "files"
            if (['maritime', 'trains', 'aircraft'].includes(action)) {
                const filesBtn = document.querySelector('.toolbar button[data-action="files"]');
                if (filesBtn) {
                    filesBtn.click(); // simule le clic pour ouvrir le panneau
                    // Optionnel : on peut afficher une alerte pour guider l'utilisateur
                    alert(`Veuillez entrer votre clé API pour ${action} dans le panneau qui s'ouvre.`);
                } else {
                    alert("Le bouton de configuration des clés API est introuvable.");
                }
            }
            // Les autres actions (files, ai, radio) sont gérées par toolbar.js
        });
    });

    getFleursAddress().then(() => console.log("Adresse Fleurs de Lys prête"));

    setTimeout(() => {}, 1000);
}