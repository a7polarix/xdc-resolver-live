// js/auto-translate.js – Traduction automatique via MyMemory (batch unique)
// Version sécurisée contre les interférences Web3 (MetaMask/RPC) et le chargement dynamique

(function() {
    'use strict';

    // Éviter double exécution
    if (window.__autoTranslateLoaded) return;
    window.__autoTranslateLoaded = true;

    console.log('🔁 auto-translate.js chargé et sécurisé');

    const SUPPORTED_LANGS = {
        'fr': 'Français', 'en': 'English', 'es': 'Español', 'de': 'Deutsch',
        'zh': '中文', 'ru': 'Русский', 'ja': '日本語', 'vi': 'Tiếng Việt',
        'th': 'ไทย', 'id': 'Bahasa Indonesia', 'pt': 'Português', 'ar': 'العربية'
    };

    // Cache des traductions (localStorage)
    function getCacheKey(texts, target) {
        const key = texts.join('|||') + target;
        return `batch_${target}_${key.substring(0, 100)}`;
    }

    function getCached(texts, target) {
        try {
            const key = getCacheKey(texts, target);
            const cached = localStorage.getItem(key);
            if (cached) return JSON.parse(cached);
        } catch { return null; }
    }

    function setCache(texts, target, translations) {
        try {
            const key = getCacheKey(texts, target);
            localStorage.setItem(key, JSON.stringify(translations));
        } catch (e) { console.warn("⚠️ Échec stockage cache translation:", e); }
    }

    function detectLanguage() {
        const saved = localStorage.getItem('preferred_lang');
        if (saved && SUPPORTED_LANGS[saved]) return saved;

        const browserLang = navigator.language.split('-')[0];
        return SUPPORTED_LANGS[browserLang] ? browserLang : 'fr';
    }

    // Filtre de sécurité pour éviter les conflits avec le DOM système et Web3
    function shouldTranslateElement(element) {
        if (!element) return false;
        
        // Liste noire des balises structurelles ou de scripts
        const blacklistTags = ['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT', 'CANVAS', 'SVG', 'CODE', 'PRE'];
        if (blacklistTags.includes(element.tagName)) return false;

        // Éviter d'altérer les injections critiques de MetaMask ou des wallets XDC (contentscript)
        const id = element.id || '';
        const className = element.className || '';
        if (id.startsWith('metamask') || id.includes('wallet') || className.includes('web3') || className.includes('metamask')) {
            return false;
        }

        return true;
    }

    // Extraction propre des nœuds de texte éligibles
    function extractTextNodes(root) {
        const nodes = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                if (node.parentElement && shouldTranslateElement(node.parentElement)) {
                    const text = node.textContent.trim();
                    // Ignorer les chiffres purs, les hashes de transaction ou les chaînes trop courtes
                    if (text.length > 1 && !/^\d+$/.test(text) && !text.startsWith('0x')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
                return NodeFilter.FILTER_REJECT;
            }
        });

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        return nodes;
    }

    async function translateContent(targetLang) {
        if (targetLang === 'fr') return 0; // Langue source par défaut

        const textNodes = extractTextNodes(document.body);
        if (textNodes.length === 0) return 0;

        // Grouper les éléments par texte d'origine unique
        const elementMap = {};
        const uniqueTexts = [];

        textNodes.forEach(node => {
            const text = node.textContent.trim();
            if (!elementMap[text]) {
                elementMap[text] = [];
                uniqueTexts.push(text);
            }
            elementMap[text].push(node);
        });

        console.log(`📝 ${uniqueTexts.length} textes uniques à traduire en "${targetLang}"`);

        // Vérification du cache local avant appel API
        let translations = getCached(uniqueTexts, targetLang);

        if (!translations) {
            translations = {};
            // Découpage par paquets de 25 pour MyMemory (éviter les requêtes trop lourdes)
            const chunkSize = 25;
            
            for (let i = 0; i < uniqueTexts.length; i += chunkSize) {
                const chunk = uniqueTexts.slice(i, i + chunkSize);
                
                const promises = chunk.map(async (text) => {
                    try {
                        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fr|${targetLang}`;
                        const res = await fetch(url);
                        const data = await res.json();
                        if (data && data.responseData) {
                            translations[text] = data.responseData.translatedText;
                        } else {
                            translations[text] = text;
                        }
                    } catch {
                        translations[text] = text;
                    }
                });

                await Promise.all(promises);
            }
            setCache(uniqueTexts, targetLang, translations);
        }

        // Application des textes traduits dans le DOM
        let count = 0;
        uniqueTexts.forEach(originalText => {
            const translatedText = translations[originalText];
            if (translatedText && translatedText !== originalText) {
                const nodesToUpdate = elementMap[originalText] || [];
                nodesToUpdate.forEach(node => {
                    // Double vérification pour éviter d'écraser si le DOM a changé entre temps
                    if (node.textContent.trim() === originalText) {
                        node.textContent = translatedText;
                        count++;
                    }
                });
            }
        });

        console.log(`✅ ${count} nœuds de texte mis à jour.`);
        return count;
    }

    // Injection propre du sélecteur dans ta Toolbar
    function addLanguageSelector(currentLang) {
        if (document.getElementById('langSelectorContainer')) return;

        // Recherche d'un conteneur existant (comme la toolbar du chat ou du header)
        const targetContainer = document.querySelector('.header-card') || document.body;
        
        const wrapper = document.createElement('div');
        wrapper.id = 'langSelectorContainer';
        wrapper.style.cssText = 'position: absolute; top: 10px; right: 20px; z-index: 9999; display: flex; align-items: center; gap: 5px; font-family: monospace; font-size: 12px;';

        const select = document.createElement('select');
        select.style.cssText = 'background: #222; color: #fff; border: 1px solid #555; padding: 4px; border-radius: 6px; cursor: pointer;';
        
        Object.keys(SUPPORTED_LANGS).forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = SUPPORTED_LANGS[code];
            if (code === currentLang) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            window.forceTranslate(e.target.value);
        });

        const label = document.createElement('span');
        label.textContent = '🌐';
        
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        targetContainer.appendChild(wrapper);
    }

    // Observateur de mutations léger pour intercepter les menus dynamiques (ex: toolbar)
    function setupMutationObserver(lang) {
        if (lang === 'fr') return;

        let debounceTimer;
        const observer = new MutationObserver((mutations) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // Déconnecter temporairement pour éviter les boucles infinies de mutations
                observer.disconnect();
                translateContent(lang).then(() => {
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }, 300); // 300ms de debounce
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Initialisation
    async function init() {
        const lang = detectLanguage();
        console.log(`🌐 Langue ciblée : ${lang}`);

        await translateContent(lang);
        addLanguageSelector(lang);
        setupMutationObserver(lang);
    }

    // Lancement propre selon l'état du document
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    // Fonction de contrôle accessible à tout moment depuis la console
    window.forceTranslate = async function(lang) {
        if (!SUPPORTED_LANGS[lang]) {
            console.error(`Langue "${lang}" non supportée`);
            return;
        }
        localStorage.setItem('preferred_lang', lang);
        location.reload();
    };

})();