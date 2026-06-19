// toolbar.js – inchangé, mais inclus pour complétude
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
    toggleMapLayer('trains', enable);
    if (enable) {
        if (!window._trainTileLayer) {
            window._trainTileLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {attribution:'OpenRailwayMap'});
        }
        window._trainTileLayer.addTo(mainMap);
        const keys = getTrainKeys();
        const country = localStorage.getItem('fl_active_train_country');
        if (country && keys[country] && keys[country].key) {
            const apiUrl = keys[country].url || 'https://api.sncf.com/v1/coverage/sncf/vehicle_journeys';
            if (trainsInterval) clearInterval(trainsInterval);
            trainsInterval = setInterval(() => debouncedFetchTrains(country, keys[country].key, apiUrl), 15000);
            debouncedFetchTrains(country, keys[country].key, apiUrl);
        } else {
            alert("Aucune clé train active. Ajoutez-en via le bouton 🚂.");
        }
    } else {
        if (window._trainTileLayer) mainMap.removeLayer(window._trainTileLayer);
        if (trainsInterval) { clearInterval(trainsInterval); trainsInterval = null; }
        mainMapLayers.trains.clearLayers();
    }
}

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

// ===== NOUVEAUX PANNEAUX (inchangés) =====
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
    document.getElementById('saveAisKeySmallBtn').addEventListener('click', () => {
        localStorage.setItem('fl_ais_key', document.getElementById('aisKeyInput').value.trim());
        alert('Clé AIS sauvegardée.');
    });
    document.getElementById('saveAirlabsKeySmallBtn').addEventListener('click', () => {
        localStorage.setItem('fl_airlabs_key', document.getElementById('airlabsKeyInput').value.trim());
        alert('Clé AirLabs sauvegardée.');
    });
    document.getElementById('addTrainKeySmallBtn').addEventListener('click', () => {
        const country = document.getElementById('trainCountrySelect').value;
        const key = document.getElementById('trainApiKey').value.trim();
        const url = document.getElementById('trainApiUrl').value.trim();
        if (!key || !url) { alert('Clé et URL requises.'); return; }
        const keys = getTrainKeys();
        keys[country] = { key, url };
        setTrainKeys(keys);
        openFilesPanel();
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
    document.getElementById('saveAiUrlBtn').addEventListener('click', () => {
        localStorage.setItem('fl_ai_model_url', document.getElementById('aiModelUrl').value.trim());
        alert('URL sauvegardée.');
    });
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
        try {
            const port = await navigator.serial.requestPort();
            await port.open({baudRate:9600});
            document.getElementById('radioSerialStatus').textContent="Connecté.";
        } catch(e) { document.getElementById('radioSerialStatus').textContent="Erreur : "+e.message; }
    });
}

function openMaritimePanel() {
    const savedKey = localStorage.getItem('fl_ais_key') || '';
    const isActive = activeMapLayers.maritime;
    showPanel(`<h3>🌊 Trafic maritime</h3>
        <p><b>Service :</b> <a href="https://aisstream.io" target="_blank">aisstream.io</a> (gratuit).<br>1. Créez un compte.<br>2. Copiez votre clé API.<br>3. Collez-la ci-dessous et activez.</p>
        <input type="text" id="aisKeyInput" value="${savedKey}" placeholder="Votre clé AIS" style="width:100%;">
        <button id="saveAisKeyBtn" class="primary">💾 Enregistrer la clé</button>
        <button id="toggleMaritimeBtn" style="margin-left:0.5rem; background:${isActive?'#38a169':'#555'}; color:white;">${isActive ? '✅ Activé' : '▶ Activer'}</button>
        <hr><small>Après sauvegarde, activez pour voir les navires 🚢.</small>
    `);
    document.getElementById('saveAisKeyBtn').addEventListener('click', () => {
        localStorage.setItem('fl_ais_key', document.getElementById('aisKeyInput').value.trim());
        alert('Clé AIS sauvegardée.');
    });
    document.getElementById('toggleMaritimeBtn').addEventListener('click', () => {
        if (!localStorage.getItem('fl_ais_key')) { alert("Veuillez d'abord enregistrer une clé AIS."); return; }
        toggleMaritime(!activeMapLayers.maritime);
        openMaritimePanel();
    });
}

function openEarthquakePanel() {
    const isActive = activeMapLayers.earthquakes;
    showPanel(`<h3>🌋 Séismes</h3><p><b>Source :</b> USGS (temps réel). Aucune clé API nécessaire.</p>
        <button id="toggleEarthquakesBtn" style="background:${isActive?'#38a169':'#555'}; color:white;">${isActive ? '✅ Activé' : '▶ Activer'}</button>
        <hr><small>Cercles orange/rouge sur la carte.</small>
    `);
    document.getElementById('toggleEarthquakesBtn').addEventListener('click', () => {
        toggleEarthquakes(!activeMapLayers.earthquakes);
        openEarthquakePanel();
    });
}

function openTrainPanel() {
    const keys = getTrainKeys();
    const isActive = activeMapLayers.trains;
    const listHtml = Object.entries(keys).map(([c, d]) =>
        `<li>${c.toUpperCase()} : ${d.key ? d.key.slice(0,8)+'…' : 'aucune'} (${d.url||'pas d\'URL'})</li>`
    ).join('') || '<li>Aucune clé enregistrée</li>';
    showPanel(`<h3>🚂 Trafic ferroviaire</h3><p>API SNCF (France) ou autres.<br>1. Obtenez une clé sur <a href="https://www.digital.sncf.com/startup/api" target="_blank">SNCF API</a>.<br>2. Entrez clé + URL.<br>3. Ajoutez, puis activez.</p>
        <select id="trainCountrySelect">${["fr","de","it","es","uk","us","ca","br","ar","af","au","cn","kr","jp","ru"].map(c=>`<option value="${c}">${c.toUpperCase()}</option>`).join('')}</select>
        <input type="text" id="trainApiKey" placeholder="Clé API"><input type="text" id="trainApiUrl" placeholder="URL API">
        <button id="addTrainKeyBtn">➕ Ajouter</button><ul>${listHtml}</ul>
        <button id="saveTrainKeysBtn" class="primary">💾 Enregistrer</button>
        <button id="toggleTrainsBtn" style="background:${isActive?'#38a169':'#555'}; color:white; margin-left:0.5rem;">${isActive ? '✅ Activé' : '▶ Activer'}</button>
        <hr><small>Après ajout, activez pour voir les trains 🚂.</small>
    `);
    document.getElementById('addTrainKeyBtn').addEventListener('click', () => {
        const country = document.getElementById('trainCountrySelect').value;
        const key = document.getElementById('trainApiKey').value.trim();
        const url = document.getElementById('trainApiUrl').value.trim();
        if (!key || !url) { alert('Clé et URL requises.'); return; }
        const keys = getTrainKeys();
        keys[country] = { key, url };
        setTrainKeys(keys);
        openTrainPanel();
    });
    document.getElementById('saveTrainKeysBtn').addEventListener('click', () => alert('Clés train sauvegardées.'));
    document.getElementById('toggleTrainsBtn').addEventListener('click', () => {
        const keys = getTrainKeys();
        if (Object.keys(keys).length === 0) { alert('Ajoutez au moins une clé train.'); return; }
        toggleTrains(!activeMapLayers.trains);
        openTrainPanel();
    });
}

function openAircraftPanel() {
    const savedKey = localStorage.getItem('fl_airlabs_key') || '';
    const isActive = activeMapLayers.aircraft;
    showPanel(`<h3>🛩️ Trafic aérien</h3>
        <p><b>Service :</b> <a href="https://airlabs.co" target="_blank">airlabs.co</a> (gratuit, 1000 req/jour).<br>1. Créez un compte.<br>2. Copiez votre clé API.<br>3. Collez-la et activez.</p>
        <input type="text" id="airlabsKeyInput" value="${savedKey}" placeholder="Votre clé AirLabs" style="width:100%;">
        <button id="saveAirlabsKeyBtn" class="primary">💾 Enregistrer la clé</button>
        <button id="toggleAircraftBtn" style="margin-left:0.5rem; background:${isActive?'#38a169':'#555'}; color:white;">${isActive ? '✅ Activé' : '▶ Activer'}</button>
        <hr><small>Après sauvegarde, activez pour voir les avions ✈️.</small>
    `);
    document.getElementById('saveAirlabsKeyBtn').addEventListener('click', () => {
        localStorage.setItem('fl_airlabs_key', document.getElementById('airlabsKeyInput').value.trim());
        alert('Clé AirLabs sauvegardée.');
    });
    document.getElementById('toggleAircraftBtn').addEventListener('click', () => {
        if (!localStorage.getItem('fl_airlabs_key')) { alert("Veuillez d'abord enregistrer une clé AirLabs."); return; }
        toggleAircraft(!activeMapLayers.aircraft);
        openAircraftPanel();
    });
}

// Gestionnaire de clics (toggle on/off) – inchangé
toolbarBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (btn.classList.contains('active')) {
            hidePanel();
            btn.classList.remove('active');
            return;
        }
        toolbarBtns.forEach(b => b.classList.remove('active'));
        hidePanel();
        btn.classList.add('active');
        if (action === 'files')       { openFilesPanel(); return; }
        if (action === 'ai')          { openAiPanel(); return; }
        if (action === 'radio')       { openRadioPanel(); return; }
        if (action === 'maritime')    { openMaritimePanel(); return; }
        if (action === 'earthquakes') { openEarthquakePanel(); return; }
        if (action === 'trains')      { openTrainPanel(); return; }
        if (action === 'aircraft')    { openAircraftPanel(); return; }
    });
});