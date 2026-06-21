// toolbar.js – version finale avec mémorisation checkboxes + auto-sign
document.addEventListener('DOMContentLoaded', () => {
    const toolbarBtns = document.querySelectorAll('.toolbar button[data-action]');
    const rightPanel = document.getElementById('rightPanel');
    let activePanelAction = null;
    const activeMapLayers = { aircraft: false, trains: false, maritime: false, earthquakes: false };

    function setActiveButton(action) {
        toolbarBtns.forEach(b => b.classList.remove('active'));
        if (action) { const btn = document.querySelector(`.toolbar button[data-action="${action}"]`); if (btn) btn.classList.add('active'); }
    }
    function showPanel(html) { rightPanel.innerHTML = html; rightPanel.style.display = 'block'; }
    function hidePanel() { rightPanel.style.display = 'none'; rightPanel.innerHTML = ''; }
    function toggleMapLayer(layerName, enable) {
        if (!mainMapInitialized) initMainMap();
        if (enable) { if (!activeMapLayers[layerName]) { mainMapLayers[layerName].addTo(mainMap); activeMapLayers[layerName] = true; } }
        else { mainMap.removeLayer(mainMapLayers[layerName]); activeMapLayers[layerName] = false; }
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
            data.response.forEach(f => { if (f.lat && f.lng) { const icon = L.divIcon({html:'✈️',className:'aircraft-icon',iconSize:[20,20]}); layers.push(L.marker([f.lat, f.lng], {icon}).bindPopup(`${f.flight_iata||f.flight_number}`)); } });
            mainMapLayers.aircraft.clearLayers(); layers.forEach(l => mainMapLayers.aircraft.addLayer(l));
        } catch(e) {}
    }, 2000);
    function toggleAircraft(enable) {
        toggleMapLayer('aircraft', enable);
        if (enable) { const k = localStorage.getItem('fl_airlabs_key'); if (!k) { alert("Clé AirLabs requise."); return; } if (aircraftInterval) clearInterval(aircraftInterval); aircraftInterval = setInterval(() => debouncedFetchAircraft(k), 15000); debouncedFetchAircraft(k); }
        else { if (aircraftInterval) { clearInterval(aircraftInterval); aircraftInterval = null; } mainMapLayers.aircraft.clearLayers(); }
    }

    // --- Trains ---
    function getTrainKeys() { return JSON.parse(localStorage.getItem('fl_train_keys') || '{}'); }
    function setTrainKeys(keys) { localStorage.setItem('fl_train_keys', JSON.stringify(keys)); }
    function toggleTrains(enable) { activeMapLayers.trains = enable; }
    function toggleMaritime(enable) { activeMapLayers.maritime = enable; }
    function toggleEarthquakes(enable) { activeMapLayers.earthquakes = enable; }

    // --- PQC: Load saved checkbox states ---
    function getPqcChoices() {
        try { return JSON.parse(localStorage.getItem('pqc_choices') || '{}'); }
        catch { return {}; }
    }
    function savePqcChoices(choices) {
        localStorage.setItem('pqc_choices', JSON.stringify(choices));
    }

    // --- FALCON POST-QUANTUM PANEL (checkboxes mémorisées + auto-sign) ---
    function openFalconPanel() {
        const algos = [
            { id: 'falcon', label: 'FALCON-512', icon: '🐦', desc: 'NIST FIPS 206 — Lattice (~650B)', isKem: false },
            { id: 'ml-dsa', label: 'ML-DSA-65', icon: '💎', desc: 'NIST FIPS 204 — Lattice (~3.3KB)', isKem: false },
            { id: 'slh-dsa', label: 'SLH-DSA-128s', icon: '🌲', desc: 'NIST FIPS 205 — Hash-based (~7.8KB)', isKem: false },
            { id: 'ml-kem', label: 'ML-KEM-512', icon: '🔑', desc: 'NIST FIPS 203 — Key encapsulation', isKem: true },
        ];
        const saved = getPqcChoices();
        const checkboxes = algos.map(a => {
            const checked = saved[a.id] !== undefined ? saved[a.id] : (a.id === 'falcon');
            return `<label style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0;cursor:pointer;">
                <input type="checkbox" id="pqc_${a.id.replace('-','')}" ${checked ? 'checked' : ''} style="cursor:pointer;">
                <span style="font-size:1.2rem;">${a.icon}</span>
                <div><b>${a.label}</b><br><small style="color:#888;">${a.desc}</small></div>
            </label>`;
        }).join('');

        showPanel(`<div class="falcon-panel">
            <h3>🔐 Cryptographie Post-Quantique</h3>
            <p>Cochez les algorithmes désirés — ils seront appliqués automatiquement à la prochaine transaction.</p>
            <h4>Algorithmes</h4>
            <div style="margin-bottom:1rem;">${checkboxes}</div>
            <button id="pqcSaveBtn" class="primary" style="width:100%;">💾 Enregistrer les choix</button>
            <div id="pqcOutput" style="font-size:0.7rem;background:rgba(0,0,0,0.1);padding:0.5rem;border-radius:8px;max-height:100px;overflow-y:auto;margin-top:0.5rem;"></div>
        </div>`);

        // Save choices button
        document.getElementById('pqcSaveBtn')?.addEventListener('click', () => {
            const choices = {};
            algos.forEach(a => { choices[a.id] = document.getElementById(`pqc_${a.id.replace('-','')}`).checked; });
            savePqcChoices(choices);
            document.getElementById('pqcOutput').innerHTML = '✅ Choix enregistrés — appliqués automatiquement à la prochaine transaction.';
        });
    }

    // --- PANNEAUX ---
    function openFilesPanel() { /* ... (inchangé) ... */ }
    function openAiPanel() { /* ... (inchangé) ... */ }
    function openRadioPanel() { /* ... (inchangé) ... */ }

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
                hidePanel(); return;
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

    // ===== PQC AUTO-SIGN: Called by wallet3.js during transaction =====
    window.pqcAutoSign = async function(txHash, fromDomain) {
        const choices = getPqcChoices();
        const results = {};
        const algos = [
            { id: 'falcon', variant: 'falcon512', isKem: false },
            { id: 'ml-dsa', variant: 'ml_dsa65', isKem: false },
            { id: 'slh-dsa', variant: 'slh_dsa_sha2_128s', isKem: false },
            { id: 'ml-kem', variant: 'ml_kem512', isKem: true },
        ];
        for (const algo of algos) {
            if (!choices[algo.id]) continue;
            try {
                if (algo.id === 'falcon') {
                    // FALCON: server-side master key
                    const r = await fetch('/api/pqc.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'sign', message: txHash, algorithm: algo.id, variant: algo.variant }) });
                    const d = await r.json();
                    if (d.success) results.falcon = { signature: d.signature, algorithm: d.algorithm, variant: d.variant, standard: d.standard, nistLevel: d.nistLevel, publicKey: d.publicKey };
                } else {
                    // Client-side keys: generate if not stored
                    let stored = localStorage.getItem(`pqc_keys_${algo.id}`);
                    if (!stored) {
                        const genR = await fetch('/api/pqc.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'keys', algorithm: algo.id, variant: algo.variant }) });
                        const genD = await genR.json();
                        if (!genD.success) continue;
                        localStorage.setItem(`pqc_keys_${algo.id}`, JSON.stringify({ publicKey: genD.publicKey, secretKey: genD.secretKey, publicKeyBytes: genD.publicKeyBytes }));
                        stored = localStorage.getItem(`pqc_keys_${algo.id}`);
                    }
                    const keys = JSON.parse(stored);
                    if (algo.isKem) {
                        const encR = await fetch('/api/pqc.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'quantum', operation: 'encapsulate', publicKey: keys.publicKey, algorithm: algo.id }) });
                        const encD = await encR.json();
                        if (encD.success) results[algo.id.replace('-','')] = { ciphertext: encD.ciphertext, sharedSecret: encD.sharedSecret, algorithm: algo.id };
                    } else {
                        const sigR = await fetch('/api/pqc.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'sign', message: txHash, algorithm: algo.id, variant: algo.variant, secretKey: keys.secretKey }) });
                        const sigD = await sigR.json();
                        if (sigD.success) results[algo.id.replace('-','')] = { signature: sigD.signature, algorithm: sigD.algorithm, variant: sigD.variant, standard: sigD.standard, nistLevel: sigD.nistLevel, publicKey: keys.publicKey, signatureBytes: sigD.signatureBytes };
                    }
                }
            } catch(e) { console.warn(`PQC auto-sign ${algo.id} failed:`, e); }
        }
        return results;
    };
});
