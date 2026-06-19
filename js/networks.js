// ==================== RÉSEAUX ====================
const NETWORKS = {
    xdc: {
        name: 'XDC Network',
        chainId: '0x32',
        rpc: 'https://rpc.xdcrpc.com',
        explorer: 'https://xdcscan.com',
        tokens: [
            { value: 'XDC', label: 'XDC (natif)', address: null, decimals: 18 },
            { value: 'USDC', label: 'USDC', address: '0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1', decimals: 6 },
            { value: 'CGO', label: 'CGO (Comtech Gold)', address: '0x8f9920283470f52128bf11b0c14e798be704fd15', decimals: 18 },
            { value: 'SRX', label: 'SRX (StorX)', address: '0x5d5f074837f5d4618b3916ba74de1bf9662a3fed', decimals: 18 },
            { value: 'PLI', label: 'PLI (Plugin)', address: '0xff7412ea7c8445c46a8254dfb557ac1e48094391', decimals: 18 },
            { value: 'LBT', label: 'LBT (Law Blocks)', address: '0x05940b2df33d6371201e7ae099ced4c363855dfe', decimals: 18 },
            { value: 'FXD', label: 'FXD (Fathom Dollar)', address: '0x49d3f7543335cf38Fa10889CCFF10207e22110B5', decimals: 18 }
        ],
        contractAddr: '0x295a7aB79368187a6CD03c464cfaAb04d799784E',
        oracleDefault: '0x0261911548dc291BDf6287e73DFf9B1BF8B08fE8',   // XDC/USD
        // 🔽 NOUVEAU : Oracle pour PLI/USD (à remplacer par l'adresse réelle)
        pliOracle: '0x___________'  // TODO: mettre l'adresse du contrat Oracle Chainlink pour PLI/USD
    },
    eth: {
        name: 'Ethereum',
        chainId: '0x1',
        rpc: 'https://ethereum-rpc.publicnode.com',
        explorer: 'https://etherscan.io',
        tokens: [
            { value: 'ETH', label: 'ETH (natif)', address: null, decimals: 18 },
            { value: 'USDC', label: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
            { value: 'USDT', label: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 }
        ],
        contractAddr: null,
        oracleDefault: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
        pliOracle: null
    },
    sepolia: {
        name: 'Sepolia Testnet',
        chainId: '0xaa36a7',
        rpc: 'https://rpc.sepolia.org',
        explorer: 'https://sepolia.etherscan.io',
        tokens: [
            { value: 'ETH', label: 'SepoliaETH (test)', address: null, decimals: 18 },
            { value: 'USDC', label: 'USDC (test)', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 }
        ],
        contractAddr: null,
        oracleDefault: null,
        pliOracle: null
    },
    apothem: {
        name: 'XDC Apothem Testnet',
        chainId: '0x33',
        rpc: 'https://rpc.apothem.network',
        explorer: 'https://explorer.apothem.network',
        tokens: [
            { value: 'XDC', label: 'XDC (test)', address: null, decimals: 18 }
        ],
        contractAddr: null,
        oracleDefault: null,
        pliOracle: null
    }
};

let currentNetwork = 'xdc';
function getNetwork() { return NETWORKS[currentNetwork]; }
function getTokenList() { return getNetwork().tokens; }
function getRpcUrl() { return getNetwork().rpc; }
function getExplorerUrl(hash) { return `${getNetwork().explorer}/tx/${hash}`; }

function populateTokens() {
    const s = document.getElementById('token');
    const s2 = document.getElementById('invoiceSymbol');
    const tokens = getTokenList();
    s.innerHTML = tokens.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
    s2.innerHTML = tokens.map(t => `<option>${t.value}</option>`).join('');
}

function getTokenAddress(symbol) {
    const t = getTokenList().find(t => t.value === symbol);
    return t ? t.address : null;
}

function getTokenDecimals(symbol) {
    const t = getTokenList().find(t => t.value === symbol);
    return t ? t.decimals : 18;
}

// Gestion du changement de réseau
document.getElementById('networkSelect').addEventListener('change', async (e) => {
    currentNetwork = e.target.value;
    const net = getNetwork();
    document.getElementById('networkBadge').textContent = net.name.split(' ')[0];
    document.getElementById('networkBadge').className = 'network-badge ' + currentNetwork;
    populateTokens();
    if (window._signer) {
        try {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainId }] });
        } catch (err) {
            if (err.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: net.chainId,
                        chainName: net.name,
                        rpcUrls: [net.rpc],
                        nativeCurrency: { symbol: currentNetwork === 'xdc' ? 'XDC' : 'ETH', decimals: 18 },
                        blockExplorerUrls: [net.explorer]
                    }]
                });
            }
        }
    }
    updateTTCEstimate();
    if (net.oracleDefault) testOracle(net.oracleDefault);
    else currentOraclePrice = null;
    // Rafraîchir le prix PLI si l'oracle est défini
    if (net.pliOracle) testPliOracle();
    else currentPliPrice = null;
});
populateTokens();

// ==================== DICTIONNAIRES & I18N ====================
const LOCAL_CATEGORIES = {
    "crudeoil.rwa": "Énergie & Ressources",
    "compute.depin": "Calcul & IA",
    "fleursdelys.xdc": "Lore & Mythes",
    "boulangerie.xdc": "Agriculture & Alimentation"
};

const I18N = {
    fr: {
        copy_json: 'Copier JSON',
        copy_hash: 'Copier hash',
        download_receipt: 'Télécharger le reçu (HTML)',
        view_on_explorer: 'Voir sur Explorer',
        json_copied: 'JSON copié',
        hash_copied: 'Hash copié',
        receipt_downloaded: 'Reçu HTML téléchargé.'
    },
    en: {
        copy_json: 'Copy JSON',
        copy_hash: 'Copy hash',
        download_receipt: 'Download receipt (HTML)',
        view_on_explorer: 'View on Explorer',
        json_copied: 'JSON copied',
        hash_copied: 'Hash copied',
        receipt_downloaded: 'Receipt HTML downloaded.'
    }
};
function getBrowserLanguage() { return (navigator.language || 'fr').startsWith('fr') ? 'fr' : 'en'; }
const browserLang = getBrowserLanguage();
const langData = I18N[browserLang];
function t(k) { return langData[k] || k; }

// ==================== STOCKAGE LOCAL ====================
function saveLocalConfig() {
    localStorage.setItem('fl_siret', document.getElementById('siretField').value.trim());
    localStorage.setItem('fl_tva', document.getElementById('tvaField').value);
    localStorage.setItem('fl_adresse_siege', document.getElementById('adresseSiegeField').value);
    localStorage.setItem('fl_objet_prestation', document.getElementById('objetPrestationField').value);
    localStorage.setItem('fl_fiat_currency', document.getElementById('fiatCurrencyField').value.trim());
    localStorage.setItem('fl_categorie_perso', document.getElementById('categoriePersoField').value.trim());
    localStorage.setItem('fl_regime_tva', document.getElementById('regimeTvaField').value);
    localStorage.setItem('fl_mention_tva', document.getElementById('mentionTvaField').value);
}
function loadLocalConfig() {
    document.getElementById('siretField').value = localStorage.getItem('fl_siret') || '';
    document.getElementById('tvaField').value = localStorage.getItem('fl_tva') || '20';
    document.getElementById('adresseSiegeField').value = localStorage.getItem('fl_adresse_siege') || '';
    document.getElementById('objetPrestationField').value = localStorage.getItem('fl_objet_prestation') || '';
    document.getElementById('fiatCurrencyField').value = localStorage.getItem('fl_fiat_currency') || 'USD';
    document.getElementById('categoriePersoField').value = localStorage.getItem('fl_categorie_perso') || '';
    document.getElementById('regimeTvaField').value = localStorage.getItem('fl_regime_tva') || 'classique';
    document.getElementById('mentionTvaField').value = localStorage.getItem('fl_mention_tva') || '';
}
['siretField', 'tvaField', 'adresseSiegeField', 'objetPrestationField', 'fiatCurrencyField', 'categoriePersoField', 'regimeTvaField', 'mentionTvaField'].forEach(id => {
    document.getElementById(id).addEventListener(id === 'regimeTvaField' ? 'change' : 'input', saveLocalConfig);
});
loadLocalConfig();

// ==================== ORACLE XDC/USD ====================
let currentOraclePrice = null;
async function testOracle(oracleAddress) {
    const addr = oracleAddress && oracleAddress.trim() ? oracleAddress.trim() : getNetwork().oracleDefault;
    if (!addr || !addr.startsWith('0x')) return null;
    try {
        const p = new ethers.JsonRpcProvider(getRpcUrl());
        const c = new ethers.Contract(addr, [
            "function latestAnswer() view returns (int256)",
            "function decimals() view returns (uint8)"
        ], p);
        const dec = await c.decimals();
        const raw = await c.latestAnswer();
        const price = Number(raw) / (10 ** Number(dec));
        currentOraclePrice = price;
        const fiat = document.getElementById('fiatCurrencyField').value.trim() || 'USD';
        document.getElementById('oraclePriceDisplay').innerHTML = `${price.toFixed(8)} ${fiat}/${currentNetwork === 'xdc' ? 'XDC' : 'ETH'}`;
        return price;
    } catch (e) {
        document.getElementById('oraclePriceDisplay').innerHTML = 'Erreur';
        return null;
    }
}
document.getElementById('testOracleBtn').addEventListener('click', async () => {
    await testOracle(document.getElementById('oracleAddressField').value.trim());
});
document.getElementById('clearOracleCacheBtn').addEventListener('click', () => {
    currentOraclePrice = null;
    document.getElementById('oraclePriceDisplay').innerHTML = 'Cache vidé';
    document.getElementById('ttcEstimateDisplay').innerHTML = '--';
});

// ==================== NOUVEAU : ORACLE PLI/USD ====================
let currentPliPrice = null;
async function testPliOracle() {
    const pliAddr = getNetwork().pliOracle;
    if (!pliAddr || !pliAddr.startsWith('0x')) {
        console.warn("Oracle PLI non configuré pour ce réseau");
        return null;
    }
    try {
        const p = new ethers.JsonRpcProvider(getRpcUrl());
        const c = new ethers.Contract(pliAddr, [
            "function latestAnswer() view returns (int256)",
            "function decimals() view returns (uint8)"
        ], p);
        const dec = await c.decimals();
        const raw = await c.latestAnswer();
        const price = Number(raw) / (10 ** Number(dec));
        currentPliPrice = price;
        console.log(`Prix PLI/USD : ${price}`);
        return price;
    } catch (e) {
        console.error("Erreur oracle PLI :", e);
        return null;
    }
}
// Optionnel : un bouton pour tester l'oracle PLI (si vous voulez l'ajouter dans l'interface)
// document.getElementById('testPliOracleBtn')?.addEventListener('click', testPliOracle);

// ==================== CALCUL TTC (utilise l'oracle par défaut) ====================
async function updateTTCEstimate() {
    const amt = parseFloat(document.getElementById('amount').value) || 0;
    let price = currentOraclePrice;
    if (!price || isNaN(amt) || amt <= 0) {
        document.getElementById('ttcEstimateDisplay').innerHTML = '--';
        return;
    }
    const tva = parseFloat(document.getElementById('tvaField').value) || 0;
    const regime = document.getElementById('regimeTvaField').value;
    const effTva = regime === 'auto_entreprise' ? 0 : tva;
    const ttc = amt * price * (1 + effTva / 100);
    const fiat = document.getElementById('fiatCurrencyField').value || 'USD';
    document.getElementById('ttcEstimateDisplay').innerHTML = `${ttc.toFixed(4)} ${fiat}`;
}
document.getElementById('amount').addEventListener('input', updateTTCEstimate);
document.getElementById('tvaField').addEventListener('input', updateTTCEstimate);
document.getElementById('regimeTvaField').addEventListener('change', updateTTCEstimate);
setInterval(updateTTCEstimate, 30000);

// ==================== CHARGEMENT CONFIGURATION DEPUIS FICHIER ====================
document.getElementById('loadConfigBtn').addEventListener('click', () => {
    const file = document.getElementById('configFile').files[0];
    if (!file) return alert("Sélectionnez un fichier JSON");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target.result);
            if (config.siret) document.getElementById('siretField').value = config.siret;
            if (config.tva !== undefined) document.getElementById('tvaField').value = config.tva;
            if (config.adresse_siege) document.getElementById('adresseSiegeField').value = config.adresse_siege;
            if (config.objet_prestation) document.getElementById('objetPrestationField').value = config.objet_prestation;
            if (config.fiatCurrency) document.getElementById('fiatCurrencyField').value = config.fiatCurrency;
            if (config.categorie_personnalisee) document.getElementById('categoriePersoField').value = config.categorie_personnalisee;
            if (config.regime_tva) document.getElementById('regimeTvaField').value = config.regime_tva;
            if (config.mention_tva) document.getElementById('mentionTvaField').value = config.mention_tva;
            saveLocalConfig();
            alert("Configuration chargée");
            updateTTCEstimate();
            if (getNetwork().oracleDefault) testOracle(getNetwork().oracleDefault);
            if (getNetwork().pliOracle) testPliOracle();
        } catch (e) { alert("Erreur parsing JSON"); }
    };
    reader.readAsText(file);
});

// ==================== COPIER LES ADRESSES (classe .copyable) ====================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copyable')) {
        const text = e.target.value || e.target.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const msg = document.createElement('span');
            msg.textContent = ' Copié !';
            msg.style.cssText = 'font-size:0.7rem;color:#38a169;margin-left:0.3rem;';
            e.target.parentNode.appendChild(msg);
            setTimeout(() => msg.remove(), 1500);
        }).catch(() => {});
    }
});