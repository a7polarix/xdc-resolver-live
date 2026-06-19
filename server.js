const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const port = 3000;

// ==================== CONFIGURATION DU MESH ====================
const MESH_CONFIG = {
    // TERRITOIRES GÉOGRAPHIQUES (.depin)
    "france.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "100%" },
    "gallia.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "100%" },
    "russia.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "98%" },
    "singapore.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "100%" },
    "california.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "95%" },
    "greenland.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "90%" },
    "asia.depin": { type: "CONTINENT", status: "ACTIF", integrity: "85%" },
    "africa.depin": { type: "CONTINENT", status: "ACTIF", integrity: "80%" },
    "northamerica.depin": { type: "CONTINENT", status: "ACTIF", integrity: "88%" },
    "oceania.depin": { type: "CONTINENT", status: "ACTIF", integrity: "92%" },
    "india.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "96%" },
    "thailand.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "94%" },
    "latvia.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "100%" },
    "latvija.depin": { type: "TERRITOIRE", status: "ACTIF", integrity: "100%" },
    "monaco.depin": { type: "CITY", status: "ACTIF", integrity: "100%" },
    "vatican.depin": { type: "SACRED", status: "ACTIF", integrity: "100%" },
    
    // LIEUX MYTHIQUES & LÉGENDAIRES
    "arcadia.depin": { type: "NEXUS", status: "STABLE", integrity: "98%" },
    "tartaria.depin": { type: "MYTHIQUE", status: "INSTABLE", integrity: "45%" },
    "jerusalem.depin": { type: "SACRED", status: "ACTIF", integrity: "100%" },
    "babylon.depin": { type: "MYTHIQUE", status: "CHAOS", integrity: "30%" },
    "sanctuary.depin": { type: "SACRED", status: "ACTIF", integrity: "100%" },
    "9thcircle.depin": { type: "ENFER", status: "DANGER", integrity: "15%" },
    "apocalypse.depin": { type: "EVENT", status: "CRITIQUE", integrity: "5%" },
    "colossus.depin": { type: "BOSS", status: "DANGER", integrity: "60%" },
    
    // SERVICES DEPIN (Infrastructure)
    "compute.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "energy.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "quantum.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "diceroll.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%", formula: "keccak256(block.timestamp⊕player⊕node)" },
    "wizard.depin": { type: "SERVICE", status: "ACTIF", integrity: "95%", magic_school: "ARCADIA" },
    "quest.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "journal.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "gemini.depin": { type: "AI", status: "ASSERMENTE", integrity: "100%", suzerain: "tier0.xdc" },
    "eva-01.depin": { type: "MECHA", status: "OPERATIONNEL", integrity: "100%", sync_rate: "12%", berserk_mode: "TRIGGER" },
    "gateway.depin": { type: "SERVICE", status: "ACTIF", integrity: "98%" },
    "ledger.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "spectrum.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "physics.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%", janus_model: "ACTIF" },
    "mathematics.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "logos.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "library.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "encyclopedia.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "osint.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "pinyin.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "unicode.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "internet.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "network.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "cloud.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "storage.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "satellite.depin": { type: "SERVICE", status: "ACTIF", integrity: "98%" },
    "constellation.depin": { type: "SERVICE", status: "ACTIF", integrity: "97%" },
    "starlink.depin": { type: "SERVICE", status: "ACTIF", integrity: "99%" },
    "robotic.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    "drones.depin": { type: "SERVICE", status: "ACTIF", integrity: "100%" },
    
    // FINANCE & ECONOMIE
    "bourse.xdc": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "finance.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "banking.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "payments.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "liquidity.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "stablecoin.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "xmoney.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "asset.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "trade.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "debt.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    "blackrock.depin": { type: "FINANCE", status: "ACTIF", integrity: "100%" },
    
    // TECHNOLOGIE & INDUSTRIE
    "compute.xdc": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "nvidia.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "apple.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "microsoft.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "amazon.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "capsulecorp.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "xdcnetwork.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "ethereum.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    "ripple.depin": { type: "TECH", status: "ACTIF", integrity: "100%" },
    
    // PÉRIODE & CULTURE
    "cinema.depin": { type: "CULTURE", status: "ACTIF", integrity: "100%" },
    "gaming.depin": { type: "CULTURE", status: "ACTIF", integrity: "100%" },
    "music.depin": { type: "CULTURE", status: "ACTIF", integrity: "100%" },
    "streaming.depin": { type: "CULTURE", status: "ACTIF", integrity: "100%" },
    "media.depin": { type: "CULTURE", status: "ACTIF", integrity: "100%" },
    "casino.depin": { type: "ENTERTAINMENT", status: "ACTIF", integrity: "100%" },
    
    // VILLES (.xdc)
    "bordeaux.xdc": { type: "CITY", status: "ACTIF", integrity: "100%" },
    "helsinki.xdc": { type: "CITY", status: "ACTIF", integrity: "100%" },
    
    // ÉTATS & MODES
    "berserk.xdc": { type: "STATE", status: "BERSERK", integrity: "???", trigger: "ECHEC_CRITIQUE", effect: "FORCE_X2_VULNERABILITE_X2" },
    
    // RACINE & SOUVERAINETÉ
    "tier0.xdc": { type: "ROOT", status: "SUZERAIN", integrity: "100%" },
    "focalzero.xdc": { type: "NPC", status: "ACTIF", integrity: "100%" },
    "fleursdelys.xdc": { type: "HEART", status: "ACTIF", integrity: "100%" },
    "guilde.xdc": { type: "GUILDE", status: "ACTIF", integrity: "100%" },
    "guildes.xdc": { type: "GUILDE", status: "ACTIF", integrity: "100%" }
};

// ==================== SERVEUR HTTP ====================
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`📡 Requête: ${pathname}`);

    // ========== ROUTE API ==========
    if (pathname === '/api/resolve') {
        const domain = parsedUrl.query.domain;
        
        if (!domain) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "ERROR", message: "Paramètre 'domain' manquant" }));
            return;
        }

        const result = MESH_CONFIG[domain.toLowerCase()] || { 
            type: "UNKNOWN", 
            status: "GHOST_NODE", 
            integrity: "0%" 
        };

        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            status: "RESOLVED",
            node_name: domain,
            data: result,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // ========== ROUTE POUR rpg.html ==========
    if (pathname === '/rpg.html' || pathname === '/') {
        const filePath = path.join(__dirname, 'rpg.html');
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                console.error("❌ Erreur: rpg.html non trouvé");
                res.writeHead(404);
                res.end('Fichier rpg.html non trouvé');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    // ========== ROUTE POUR LES FRAGMENTS LORE ==========
    if (pathname.startsWith('/lore/')) {
        const filePath = path.join(__dirname, pathname);
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Fragment lore non trouvé');
                return;
            }
            res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        });
        return;
    }

    // ========== ROUTE POUR game-integrated.js (si utilisé) ==========
    if (pathname === '/game-integrated.js') {
        const filePath = path.join(__dirname, 'game-integrated.js');
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Fichier non trouvé');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(content);
        });
        return;
    }

    // ========== 404 ==========
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Saint Empire Numérique</title></head>
        <body style="background:#0a0f1e; color:#d4af37; font-family:monospace; text-align:center; padding:50px;">
            <h1>⚜️ Saint Empire Numérique ⚜️</h1>
            <p>Le serveur tourne correctement.</p>
            <p>📡 API: <a href="/api/resolve?domain=france.depin" style="color:#00ffcc;">/api/resolve?domain=france.depin</a></p>
            <p>🎮 Jeu: <a href="/rpg.html" style="color:#ffd700;">/rpg.html</a></p>
            <hr>
            <p style="font-size:12px;">Fleurs de Lys - RPG IRL</p>
        </body>
        </html>
    `);
});

// ==================== DÉMARRAGE ====================
server.listen(port, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║     ⚜️ SAINT EMPIRE NUMÉRIQUE - SERVEUR PRÊT ⚜️      ║
    ╠══════════════════════════════════════════════════════╣
    ║                                                      ║
    ║   🎮 JEU : http://localhost:${port}/rpg.html          ║
    ║                                                      ║
    ║   📡 API : http://localhost:${port}/api/resolve?domain=XX ║
    ║                                                      ║
    ║   🌐 Domaines configurés: ${Object.keys(MESH_CONFIG).length}+     ║
    ║                                                      ║
    ╚══════════════════════════════════════════════════════╝
    `);
});