// js/translator.js
(function(){
    const LANG = {
        'fr':'Français','en':'English','es':'Español','de':'Deutsch',
        'zh':'中文','ru':'Русский','ja':'日本語','vi':'Tiếng Việt',
        'th':'ไทย','id':'Bahasa Indonesia','pt':'Português','ar':'العربية'
    };

    let currentLang = localStorage.getItem('preferred_lang') || 'fr';
    let translations = {};

    function loadLang(lang, callback) {
        fetch(`/lang/${lang}.json`)
            .then(r => r.json())
            .then(data => { translations = data; callback(); })
            .catch(() => { translations = {}; callback(); });
    }

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = translations[key];
                } else {
                    el.textContent = translations[key];
                }
            }
        });
    }

    function buildSelector() {
        const container = document.getElementById('toolbar') || document.body;
        const sel = document.createElement('select');
        sel.style.cssText = 'background:#2d3748;color:#fff;border:1px solid #4a5568;border-radius:20px;padding:4px 12px;cursor:pointer;';
        for (const [code, name] of Object.entries(LANG)) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name;
            if (code === currentLang) opt.selected = true;
            sel.appendChild(opt);
        }
        sel.addEventListener('change', function(){
            localStorage.setItem('preferred_lang', this.value);
            location.reload();
        });
        container.appendChild(sel);
    }

    function init() {
        const lang = localStorage.getItem('preferred_lang') || 'fr';
        currentLang = lang;
        loadLang(lang, function(){
            applyTranslations();
            buildSelector();
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();