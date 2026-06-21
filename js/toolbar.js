// toolbar.js – version corrigée avec DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const toolbarBtns = document.querySelectorAll('.toolbar button[data-action]');
    const rightPanel = document.getElementById('rightPanel');
    let activePanelAction = null;
    const activeMapLayers = { aircraft: false, trains: false, maritime: false, earthquakes: false };

    function setActiveButton(action) {
        toolbarBtns.forEach(b => b.classList.remove('active'));
        if (action) {
            const btn = document.querySelector(`.toolbar button[data-action="${action}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    function showPanel(html) { rightPanel.innerHTML = html; rightPanel.style.display = 'block'; }
    function hidePanel() { rightPanel.style.display = 'none'; rightPanel.innerHTML = ''; }

    function toggleMapLayer(layerName, enable) {
        if (!mainMapInitialized) initMainMap();
        if (enable) {
            if (!activeMapLayers[layerName]) { mainMapLayers[layerName].addTo(mainMap); activeMapLayers[layerName] = true; }
        } else {
            mainMap.removeLayer(mainMapLayers[layerName]); activeMapLayers[layerName] = false;
        }
    }

    const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };

    // --- Aéronefs ---
    let aircraftInterval = null;
    const debouncedFetchAircraft = debounce(async (apiKey) => {
        try {
            const r = await fetch(`https://airlabs.co/api/v9/flights?api_key=${apiKey}`);
            if (!r.ok) return;
            const data = await r.json();
            if (!data.response) return;
            const layers = [];
            data.response.forEach(f => {
                if (f.lat && f.lng) {
                    const icon = L.divIcon({html:'✈️', className:'aircraft-icon', iconSize:[20,20]});
                    layers.push(L.marker([f.lat, f.lng], {icon}).bindPopup(`${f.flight_iata||f.flight_number}`));
                }
            });
            mainMapLayers.aircraft.clearLayers();
            layers.forEach(l => mainMapLayers.aircraft.addLayer(l));
        } catch(e) {}
    }, 2000);

    function toggleAircraft(enable) {
        toggleMapLayer('aircraft', enable);
        if (enable) {
            const airlabsKey = localStorage.getItem('fl_airlabs_key');
            if (!airlabsKey) { alert("Veuillez d'abord enregistrer une clé AirLabs via le bouton 🛩️."); return; }
            if (aircraftInterval) clearInterval(aircraftInterval);
            aircraftInterval = setInterval(() => debouncedFetchAircraft(airlabsKey), 15000);
            debouncedFetchAircraft(airlabsKey);
        } else {
            if (aircraftInterval) { clearInterval(aircraftInterval); aircraftInterval = null; }
            mainMapLayers.aircraft.clearLayers();
        }
    }

    // --- Trains ---
    function getTrainKeys() { return JSON.parse(localStorage.getItem('fl_train_keys') || '{}'); }
    function setTrainKeys(keys) { localStorage.setItem('fl_train_keys', JSON.stringify(keys)); }
    let trainsInterval = null;
    const debouncedFetchTrains = debounce(async (country, apiKey, apiUrl) => {
        if (!apiUrl) return;
        try {
            const r = await fetch(apiUrl, { headers: { Authorization: apiKey } });
            const json = await r.json();
            const layers = [];
            if (json.vehicle_journeys) {
                json.vehicle_journeys.forEach(vj => {
                    if (vj.vehicle_positions && vj.vehicle_positions.length>0) {
                        const pos = vj.vehicle_positions[0];
                        layers.push(L.marker([pos.lat, pos.lon], {icon: L.divIcon({html:'🚂',className:'train-icon',iconSize:[20,20]})}).bindPopup(vj.name||'Train'));
                    }
                });
            }
            mainMapLayers.trains.clearLayers();
            layers.forEach(l => mainMapLayers.trains.addLayer(l));
        } catch(e) {}
    }, 2000);

    function toggleTrains(enable) {
        if (!window._trainTileLayer) {
            window._trainTileLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { attribution: 'OpenRailwayMap' });
        }
        if (enable) {
            window._trainTileLayer.addTo(mainMap);
            const keys = getTrainKeys();
            const country = localStorage.getItem('fl_active_train_country') || 'fr';
            if (keys[country] && keys[country].key) {
                const apiUrl = keys[country].url || 'https://api.sncf.com/v1/coverage/sncf/vehicle_journeys';
                if (trainsInterval) clearInterval(trainsInterval);
                trainsInterval = setInterval(() => debouncedFetchTrains(country, keys[country].key, apiUrl), 15000);
                debouncedFetchTrains(country, keys[country].key, apiUrl);
            }
            activeMapLayers.trains = true;
        } else {
            if (window._trainTileLayer) mainMap.removeLayer(window._trainTileLayer);
            if (trainsInterval) { clearInterval(trainsInterval); trainsInterval = null; }
            mainMapLayers.trains.clearLayers();
            activeMapLayers.trains = false;
        }
    }

    // --- Maritime ---
    let maritimeWs = null;
    function toggleMaritime(enable) {
        toggleMapLayer('maritime', enable);
        if (enable) {
            const aisKey = localStorage.getItem('fl_ais_key');
            if (!aisKey) { alert("Veuillez d'abord enregistrer une clé AIS via le bouton 🌊."); return; }
            connectAIS(aisKey);
        } else {
            if (maritimeWs) { maritimeWs.close(); maritimeWs = null; }
            mainMapLayers.maritime.clearLayers();
        }
    }
    function connectAIS(key) {
        if (maritimeWs) maritimeWs.close();
        maritimeWs = new WebSocket(`wss://stream.aisstream.io/v0/stream`);
        maritimeWs.onopen = () => maritimeWs.send(JSON.stringify({ Apikey: key, BoundingBoxes: [[[-90,-180],[90,180]]] }));
        maritimeWs.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.MessageType==='PositionReport' && msg.PositionReport) {
                    const lat = msg.PositionReport.Latitude, lon = msg.PositionReport.Longitude, mmsi = msg.MetaData.MMSI;
                    const icon = L.divIcon({html:'🚢',className:'ship-icon',iconSize:[20,20]});
                    const marker = L.marker([lat, lon], {icon}).bindPopup(`MMSI: ${mmsi}`);
                    mainMapLayers.maritime.eachLayer(l => { if (l._mmsi === mmsi) mainMapLayers.maritime.removeLayer(l); });
                    marker._mmsi = mmsi;
                    mainMapLayers.maritime.addLayer(marker);
                }
            } catch(e) {}
        };
        maritimeWs.onclose = () => { maritimeWs = null; };
    }

    // --- Séismes ---
    let earthquakesInterval = null;
    const debouncedFetchEarthquakes = debounce(async () => {
        try {
            const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
            const data = await r.json();
            const layers = [];
            data.features.forEach(f => {
                const [lon, lat] = f.geometry.coordinates;
                const mag = f.properties.mag;
                if (mag >= 5) for(let r=1; r<=3; r++) layers.push(L.circle([lat, lon], {radius: r*50000, color:'red', fillOpacity:0.1}));
                layers.push(L.circleMarker([lat, lon], {radius: Math.max(mag*2,5), fillColor:'orange', color:'red'}).bindPopup(`${f.properties.title}<br>Mag: ${mag}`));
            });
            mainMapLayers.earthquakes.clearLayers();
            layers.forEach(l => mainMapLayers.earthquakes.addLayer(l));
        } catch(e) {}
    }, 5000);

    function toggleEarthquakes(enable) {
        toggleMapLayer('earthquakes', enable);
        if (enable) {
            if (earthquakesInterval) clearInterval(earthquakesInterval);
            earthquakesInterval = setInterval(debouncedFetchEarthquakes, 60000);
            debouncedFetchEarthquakes();
        } else {
            if (earthquakesInterval) { clearInterval(earthquakesInterval); earthquakesInterval = null; }
            mainMapLayers.earthquakes.clearLayers();
        }
    }

    // ===== PANNEAUX =====
    function openFilesPanel() {
        const aisKey = localStorage.getItem('fl_ais_key') || '';
        const airlabsKey = localStorage.getItem('fl_airlabs_key') || '';
        const trainKeys = getTrainKeys();
        const trainListHtml = Object.entries(trainKeys).map(([c, d]) =>
            `<li>${c.toUpperCase()} : ${d.key ? d.key.slice(0,8)+'…' : 'aucune'} (${d.url||'pas d\'URL'})</li>`
        ).join('') || '<li>Aucune clé train enregistrée</li>';
        showPanel(`
            <h3>📁 Configuration des clés API</h3>
            <p>Centralisez ici vos clés pour les services externes utilisés par Fleurs de Lys.</p>
            <div><h4>🌊 Maritime (AIS)</h4><p style="font-size:0.8rem;">Service : <a href="https://aisstream.io" target="_blank">aisstream.io</a> (gratuit)</p>
            <input type="text" id="aisKeyInput" value="${aisKey}" placeholder="Clé AIS"><button id="saveAisKeySmallBtn">💾 Enregistrer</button></div>
            <div><h4>🛩️ Aérien (AirLabs)</h4><p style="font-size:0.8rem;">Service : <a href="https://airlabs.co" target="_blank">airlabs.co</a> (gratuit)</p>
            <input type="text" id="airlabsKeyInput" value="${airlabsKey}" placeholder="Clé AirLabs"><button id="saveAirlabsKeySmallBtn">💾 Enregistrer</button></div>
            <div><h4>🚂 Trains</h4><p style="font-size:0.8rem;">Exemple SNCF : <a href="https://www.digital.sncf.com/startup/api" target="_blank">API SNCF</a></p>
            <select id="trainCountrySelect">${["fr","de","it","es","uk","us","ca","br","ar","af","au","cn","kr","jp","ru"].map(c=>`<option value="${c}">${c.toUpperCase()}</option>`).join('')}</select>
            <input type="text" id="trainApiKey" placeholder="Clé API"><input type="text" id="trainApiUrl" placeholder="URL API">
            <button id="addTrainKeySmallBtn">➕ Ajouter</button><ul style="font-size:0.8rem;">${trainListHtml}</ul>
            <button id="saveTrainKeysSmallBtn">💾 Enregistrer les clés train</button></div>
            <hr><small>Après avoir sauvegardé une clé, utilisez le bouton correspondant pour activer le service.</small>
        `);
        document.getElementById('saveAisKeySmallBtn').addEventListener('click', () => { localStorage.setItem('fl_ais_key', document.getElementById('aisKeyInput').value.trim()); alert('Clé AIS sauvegardée.'); });
        document.getElementById('saveAirlabsKeySmallBtn').addEventListener('click', () => { localStorage.setItem('fl_airlabs_key', document.getElementById('airlabsKeyInput').value.trim()); alert('Clé AirLabs sauvegardée.'); });
        document.getElementById('addTrainKeySmallBtn').addEventListener('click', () => {
            const country = document.getElementById('trainCountrySelect').value;
            const key = document.getElementById('trainApiKey').value.trim();
            const url = document.getElementById('trainApiUrl').value.trim();
            if (!key || !url) { alert('Clé et URL requises.'); return; }
            const keys = getTrainKeys(); keys[country] = { key, url }; setTrainKeys(keys); openFilesPanel();
        });
        document.getElementById('saveTrainKeysSmallBtn').addEventListener('click', () => alert('Clés train sauvegardées.'));
    }

    function openAiPanel() {
        const savedUrl = localStorage.getItem('fl_ai_model_url') || '';
        showPanel(`<h3>🤖 Intelligence Artificielle</h3>
            <p>Connectez un modèle d'IA externe (LLM, API, etc.) en indiquant son URL.<br>Exemple : <code>https://votre-ia.com/api/chat</code></p>
            <input type="text" id="aiModelUrl" value="${savedUrl}" placeholder="https://..." style="width:100%;">
            <button id="saveAiUrlBtn">💾 Enregistrer l'URL</button>
            <button id="loadAiBtn" style="margin-left:0.5rem;">📡 Charger le modèle</button>
            <div id="aiFrameContainer" style="height:250px; margin-top:1rem; border:1px solid #333;"></div>
        `);
        document.getElementById('saveAiUrlBtn').addEventListener('click', () => { localStorage.setItem('fl_ai_model_url', document.getElementById('aiModelUrl').value.trim()); alert('URL sauvegardée.'); });
        document.getElementById('loadAiBtn').addEventListener('click', () => {
            const url = document.getElementById('aiModelUrl').value;
            if (url) document.getElementById('aiFrameContainer').innerHTML = `<iframe src="${url}" width="100%" height="100%" sandbox="allow-scripts allow-same-origin"></iframe>`;
        });
    }

    function openRadioPanel() {
        showPanel(`<h3>📻 Radio (mode secours)</h3><p>Communication bas‑débit via Web Serial ou Compagnon.<br>Aucune clé API nécessaire.</p>
            <select id="radioMethod"><option value="webserial">Web Serial</option><option value="companion">Compagnon</option></select>
            <div id="radioWebSerial"><button id="connectRadioBtn">🔌 Connecter le port série</button><small id="radioSerialStatus"></small></div>
            <div id="radioCompanion" style="display:none;"><small>Compagnon en écoute sur localhost.</small></div>
            <hr><input type="text" id="radioRecipient" placeholder="Destinataire (0x...)"><textarea id="radioMessage" rows="3" placeholder="Message..."></textarea>
            <button id="sendRadioBtn" class="primary">📡 Envoyer</button><div id="radioSendStatus" class="status"></div>
        `);
        document.getElementById('radioMethod').addEventListener('change', function(){
            document.getElementById('radioWebSerial').style.display = this.value==='webserial'?'block':'none';
            document.getElementById('radioCompanion').style.display = this.value==='companion'?'block':'none';
        });
        document.getElementById('connectRadioBtn').addEventListener('click', async ()=>{
            if (!('serial' in navigator)) { document.getElementById('radioSerialStatus').textContent="Non supporté."; return; }
            try { const port = await navigator.serial.requestPort(); await port.open({baudRate:9600}); document.getElementById('radioSerialStatus').textContent="Connecté."; }
            catch(e) { document.getElementById('radioSerialStatus').textContent="Erreur : "+e.message; }
        });
    }

    // ---- FALCON POST-QUANTUM PANEL (checkboxes, user chooses) ----
    function openFalconPanel() {
        const algos = [
            { id: 'falcon', label: 'FALCON-512', icon: '🐦', desc: 'NIST FIPS 206 — Lattice signature (~650B)' },
            { id: 'ml-dsa', label: 'ML-DSA-65', icon: '💎', desc: 'NIST FIPS 204 — Lattice signature (~3.3KB)' },
            { id: 'slh-dsa', label: 'SLH-DSA-128s', icon: '🌲', desc: 'NIST FIPS 205 — Hash-based sig (~7.8KB)' },
            { id: 'ml-kem', label: 'ML-KEM-512', icon: '🔑', desc: 'NIST FIPS 203 — Key encapsulation (KEM)' },
        ];
        const checkboxes = algos.map(a =>
            `<label style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0;cursor:pointer;">
                <input type="checkbox" id="pqc_${a.id.replace('-','')}" ${a.id==='falcon'?'checked':''} style="cursor:pointer;">
                <span style="font-size:1.2rem;">${a.icon}</span>
                <div><b>${a.label}</b><br><small style="color:#888;">${a.desc}</small></div>
            </label>`
        ).join('');

        showPanel(`<div class="falcon-panel">
            <h3>🔐 Cryptographie Post-Quantique</h3>
            <p>Cochez les algorithmes désirés, entrez un message, puis cliquez Signer.</p>
            <h4>Algorithmes</h4>
            <div style="margin-bottom:1rem;">${checkboxes}</div>
            <h4>Message</h4>
            <input type="text" id="pqcMessage" placeholder="Message à signer / optionnel pour KEM..." style="width:100%;padding:0.4rem;border-radius:8px;border:1px solid #cfdde6;margin-bottom:0.5rem;">
            <button id="pqcSignBtn" class="primary" style="width:100%;">✍️ Signer les algorithmes cochés</button>
            <div id="pqcOutput" style="font-size:0.7rem;word-break:break-all;background:rgba(0,0,0,0.1);padding:0.5rem;border-radius:8px;max-height:150px;overflow-y:auto;margin-top:0.5rem;"></div>
        </div>`);

        document.getElementById('pqcSignBtn')?.addEventListener('click', async () => {
            const msg = document.getElementById('pqcMessage').value || 'default';
            const output = document.getElementById('pqcOutput');
            output.textContent = '';

            for (const algo of algos) {
                const checked = document.getElementById(`pqc_${algo.id.replace('-','')}`).checked;
                if (!checked) continue;

                const isKem = algo.id === 'ml-kem';
                output.innerHTML += `<br>⏳ ${algo.label}...`;

                try {
                    // Generate keys if not stored
                    let stored = localStorage.getItem(`pqc_keys_${algo.id}`);
                    if (!stored) {
                        if (algo.id === 'falcon') {
                            // FALCON uses server master key, no client key gen needed
                        } else {
                            const genR = await fetch('/api/pqc.js', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'keys', algorithm: algo.id, variant: algo.id === 'ml-dsa' ? 'ml_dsa65' : algo.id === 'slh-dsa' ? 'slh_dsa_sha2_128s' : 'ml_kem512' })
                            });
                            const genD = await genR.json();
                            if (!genD.success) { output.innerHTML += `<br>❌ ${algo.label}: ${genD.error}`; continue; }
                            localStorage.setItem(`pqc_keys_${algo.id}`, JSON.stringify({
                                publicKey: genD.publicKey,
                                secretKey: genD.secretKey,
                                publicKeyBytes: genD.publicKeyBytes,
                                generatedAt: new Date().toISOString()
                            }));
                        }
                    }

                    if (isKem) {
                        const keys = JSON.parse(localStorage.getItem(`pqc_keys_${algo.id}`));
                        const encR = await fetch('/api/pqc.js', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'quantum', operation: 'encapsulate', publicKey: keys.publicKey, algorithm: algo.id })
                        });
                        const encD = await encR.json();
                        output.innerHTML += encD.success
                            ? `<br>✅ ${algo.label}: CT=${encD.ciphertext.slice(0,40)}... SS=${encD.sharedSecret.slice(0,20)}...`
                            : `<br>❌ ${algo.label}: ${encD.error}`;
                    } else {
                        const body = { action: 'sign', message: msg, algorithm: algo.id };
                        if (algo.id !== 'falcon') {
                            const keys = JSON.parse(localStorage.getItem(`pqc_keys_${algo.id}`));
                            body.secretKey = keys.secretKey;
                        }
                        const sigR = await fetch('/api/pqc.js', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        const sigD = await sigR.json();
                        output.innerHTML += sigD.success
                            ? `<br>✅ ${algo.label}: Sig=${sigD.signature.slice(0,50)}... (${sigD.signatureBytes}B)`
                            : `<br>❌ ${algo.label}: ${sigD.error}`;
                    }
                } catch (e) {
                    output.innerHTML += `<br>❌ ${algo.label}: erreur réseau`;
                }
            }
        });
    }

    // ===== GESTIONNAIRE DE CLICS PRINCIPAL =====
    toolbarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const mapLayersActions = ['earthquakes', 'trains', 'maritime', 'aircraft'];
            if (mapLayersActions.includes(action)) {
                const isCurrentlyActive = btn.classList.contains('active');
                btn.classList.toggle('active');
                if (action === 'earthquakes') toggleEarthquakes(!isCurrentlyActive);
                if (action === 'trains') toggleTrains(!isCurrentlyActive);
                if (action === 'maritime') toggleMaritime(!isCurrentlyActive);
                if (action === 'aircraft') toggleAircraft(!isCurrentlyActive);
                hidePanel();
                return;
            }
            if (btn.classList.contains('active')) { hidePanel(); btn.classList.remove('active'); return; }
            toolbarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switch (action) {
                case 'files': openFilesPanel(); break;
                case 'ai': openAiPanel(); break;
                case 'radio': openRadioPanel(); break;
                case 'falcon': openFalconPanel(); break;
                default: break;
            }
        });
    });
});
