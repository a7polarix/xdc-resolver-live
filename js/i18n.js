// js/i18n.js – Traduction automatique par IP
(function() {
    'use strict';

    // 1. Dictionnaire des traductions (français par défaut)
    const translations = {
        fr: {
            // Header & Toolbar
            'app.title': '⚜️ Fleurs de Lys – Saint Empire Numérique',
            'btn.connect': '🔌 connecter',
            'btn.disconnect': '🔌 déconnecter',
            'wallet.status': 'wallet : non connecté',
            'balance': 'solde : --',
            'tooltip.files': '📁 Configurer les clés API (AIS, AirLabs, Trains…)',
            'tooltip.ai': '🤖 Lier votre IA (URL du modèle)',
            'tooltip.radio': '📻 Radio (mode secours – Web Serial / Compagnon)',
            'tooltip.maritime': '🌊 Trafic maritime – clé API aisstream.io',
            'tooltip.trains': '🚂 Trafic ferroviaire – clé API SNCF',
            'tooltip.aircraft': '🛩️ Trafic aérien – clé AirLabs.co',
            'network.badge': 'XDC',
            // Middle sections
            'section.transaction': '✎ Transaction',
            'label.from': 'depuis',
            'label.to': 'vers',
            'label.amount': 'montant',
            'label.currency': 'devise',
            'btn.send': '📤 envoyer',
            'section.senddomain': '📦 Envoyer un domaine',
            'label.domain': 'domaine à envoyer',
            'label.recipient': 'destinataire (adresse 0x)',
            'btn.senddomain': '📤 envoyer le domaine',
            'section.invoice': '🧾 Dernière validation',
            'section.hash': '🔍 Générer un reçu depuis un hash',
            'label.hash': 'hash de transaction (0x...)',
            'btn.verify': 'vérifier le hash',
            'btn.generate': 'générer le reçu',
            'section.config': '⚙️ Configuration (optionnelle)',
            // Right panel
            'history.title': '📋 Historique',
            'history.empty': 'Aucune transaction',
            'media.markets': '📈 MARCHÉS',
            'media.x': '𝕏 RS',
            'media.youtube': '▶️ VIDÉO',
            'media.radio': '📻 RADIO',
            'media.local': '💻 LOCAL',
            'chat.title': '💬 Communication',
        },
        en: {
            'app.title': '⚜️ Fleurs de Lys – Holy Digital Empire',
            'btn.connect': '🔌 connect',
            'btn.disconnect': '🔌 disconnect',
            'wallet.status': 'wallet : not connected',
            'balance': 'balance : --',
            'tooltip.files': '📁 Configure API keys (AIS, AirLabs, Trains…)',
            'tooltip.ai': '🤖 Link your AI (Model URL)',
            'tooltip.radio': '📻 Radio (fallback – Web Serial / Companion)',
            'tooltip.maritime': '🌊 Maritime traffic – aisstream.io API key',
            'tooltip.trains': '🚂 Railway traffic – SNCF API key',
            'tooltip.aircraft': '🛩️ Air traffic – AirLabs.co API key',
            'network.badge': 'XDC',
            'section.transaction': '✎ Transaction',
            'label.from': 'from',
            'label.to': 'to',
            'label.amount': 'amount',
            'label.currency': 'currency',
            'btn.send': '📤 send',
            'section.senddomain': '📦 Send a domain',
            'label.domain': 'domain to send',
            'label.recipient': 'recipient (address 0x)',
            'btn.senddomain': '📤 send domain',
            'section.invoice': '🧾 Last validation',
            'section.hash': '🔍 Generate receipt from hash',
            'label.hash': 'transaction hash (0x...)',
            'btn.verify': 'verify hash',
            'btn.generate': 'generate receipt',
            'section.config': '⚙️ Configuration (optional)',
            'history.title': '📋 History',
            'history.empty': 'No transactions',
            'media.markets': '📈 MARKETS',
            'media.x': '𝕏 SOCIAL',
            'media.youtube': '▶️ VIDEO',
            'media.radio': '📻 RADIO',
            'media.local': '💻 LOCAL',
            'chat.title': '💬 Communication',
        },
        es: {
            'app.title': '⚜️ Fleurs de Lys – Imperio Digital Santo',
            'btn.connect': '🔌 conectar',
            'btn.disconnect': '🔌 desconectar',
            'wallet.status': 'cartera : no conectada',
            'balance': 'saldo : --',
            'tooltip.files': '📁 Configurar claves API (AIS, AirLabs, Trenes…)',
            'tooltip.ai': '🤖 Vincular tu IA (URL del modelo)',
            'tooltip.radio': '📻 Radio (modo de respaldo – Web Serial / Companion)',
            'tooltip.maritime': '🌊 Tráfico marítimo – clave API aisstream.io',
            'tooltip.trains': '🚂 Tráfico ferroviario – clave API SNCF',
            'tooltip.aircraft': '🛩️ Tráfico aéreo – clave AirLabs.co',
            'network.badge': 'XDC',
            'section.transaction': '✎ Transacción',
            'label.from': 'desde',
            'label.to': 'hacia',
            'label.amount': 'cantidad',
            'label.currency': 'moneda',
            'btn.send': '📤 enviar',
            'section.senddomain': '📦 Enviar un dominio',
            'label.domain': 'dominio a enviar',
            'label.recipient': 'destinatario (dirección 0x)',
            'btn.senddomain': '📤 enviar dominio',
            'section.invoice': '🧾 Última validación',
            'section.hash': '🔍 Generar recibo desde hash',
            'label.hash': 'hash de transacción (0x...)',
            'btn.verify': 'verificar hash',
            'btn.generate': 'generar recibo',
            'section.config': '⚙️ Configuración (opcional)',
            'history.title': '📋 Historial',
            'history.empty': 'Sin transacciones',
            'media.markets': '📈 MERCADOS',
            'media.x': '𝕏 RS',
            'media.youtube': '▶️ VIDEO',
            'media.radio': '📻 RADIO',
            'media.local': '💻 LOCAL',
            'chat.title': '💬 Comunicación',
        },
        de: {
            'app.title': '⚜️ Fleurs de Lys – Heiliges Digitales Imperium',
            'btn.connect': '🔌 verbinden',
            'btn.disconnect': '🔌 trennen',
            'wallet.status': 'Wallet : nicht verbunden',
            'balance': 'Guthaben : --',
            'tooltip.files': '📁 API-Schlüssel konfigurieren (AIS, AirLabs, Züge…)',
            'tooltip.ai': '🤖 KI verbinden (Modell-URL)',
            'tooltip.radio': '📻 Radio (Notfallmodus – Web Serial / Companion)',
            'tooltip.maritime': '🌊 Schiffsverkehr – aisstream.io API-Schlüssel',
            'tooltip.trains': '🚂 Bahnverkehr – SNCF API-Schlüssel',
            'tooltip.aircraft': '🛩️ Flugverkehr – AirLabs.co API-Schlüssel',
            'network.badge': 'XDC',
            'section.transaction': '✎ Transaktion',
            'label.from': 'von',
            'label.to': 'nach',
            'label.amount': 'Betrag',
            'label.currency': 'Währung',
            'btn.send': '📤 senden',
            'section.senddomain': '📦 Domain senden',
            'label.domain': 'zu sendende Domain',
            'label.recipient': 'Empfänger (Adresse 0x)',
            'btn.senddomain': '📤 Domain senden',
            'section.invoice': '🧾 Letzte Validierung',
            'section.hash': '🔍 Beleg aus Hash generieren',
            'label.hash': 'Transaktions-Hash (0x...)',
            'btn.verify': 'Hash prüfen',
            'btn.generate': 'Beleg generieren',
            'section.config': '⚙️ Konfiguration (optional)',
            'history.title': '📋 Verlauf',
            'history.empty': 'Keine Transaktionen',
            'media.markets': '📈 MÄRKTE',
            'media.x': '𝕏 SOCIAL',
            'media.youtube': '▶️ VIDEO',
            'media.radio': '📻 RADIO',
            'media.local': '💻 LOKAL',
            'chat.title': '💬 Kommunikation',
        }
    };

    // 2. Mapping pays → langue (ISO 3166-1 alpha-2)
    const countryToLang = {
        'FR': 'fr', 'BE': 'fr', 'CH': 'fr', 'CA': 'fr',
        'US': 'en', 'GB': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en',
        'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es',
        'DE': 'de', 'AT': 'de', 'LU': 'de'
    };

    // 3. Récupération de l'IP et détection
    function detectLanguage() {
        return fetch('https://ip-api.com/json/')
            .then(res => res.json())
            .then(data => {
                const country = data.countryCode;
                return countryToLang[country] || 'fr';
            })
            .catch(() => 'fr'); // Fallback français si erreur réseau
    }

    // 4. Fonction de traduction du DOM
    function applyTranslations(lang) {
        const dict = translations[lang] || translations.fr;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = dict[key];
            if (value !== undefined) {
                // Si l'élément a un placeholder, on traduit le placeholder
                if (el.hasAttribute('placeholder')) {
                    el.setAttribute('placeholder', value);
                } else {
                    el.textContent = value;
                }
            }
        });
        // Traduire aussi les titres des tooltips
        document.querySelectorAll('[data-i18n-tip]').forEach(el => {
            const key = el.getAttribute('data-i18n-tip');
            const value = dict[key];
            if (value !== undefined) {
                el.setAttribute('title', value);
            }
        });
        // Traduire le badge réseau
        const badge = document.getElementById('networkBadge');
        if (badge) {
            const val = dict['network.badge'];
            if (val) badge.textContent = val;
        }
    }

    // 5. Init
    detectLanguage().then(lang => {
        console.log(`Langue détectée : ${lang}`);
        applyTranslations(lang);
    });

})();