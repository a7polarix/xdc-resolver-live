// ==================== HISTORIQUE DES TRANSACTIONS ====================
// Défini immédiatement pour être disponible pour wallet.js
const TX_LOG_KEY = 'fl_tx_log';

function getTxLog() {
    try { return JSON.parse(localStorage.getItem(TX_LOG_KEY) || '[]'); } catch (e) { return []; }
}
function saveTxLog(log) { localStorage.setItem(TX_LOG_KEY, JSON.stringify(log)); }

function addTxEntry(entry) {
    const log = getTxLog();
    log.push({ ...entry, date: Date.now() });
    if (log.length > 100) log.shift();
    saveTxLog(log);
    renderTxLog();
}
function clearTxLog() { localStorage.removeItem(TX_LOG_KEY); renderTxLog(); }

function renderTxLog() {
    const list = document.getElementById('txLogList');
    const count = document.getElementById('txLogCount');
    if (!list || !count) return;
    const log = getTxLog();
    count.textContent = log.length + ' transaction(s)';
    if (log.length === 0) {
        list.innerHTML = '<div style="font-size:0.8rem;text-align:center;padding:1rem;">Aucune transaction</div>';
        return;
    }
    list.innerHTML = log.slice().reverse().map(e => {
        const cls = e.type === 'outgoing' ? 'outgoing' : 'incoming';
        const d = new Date(e.date).toLocaleString();
        const hashLink = `<a href="${getExplorerUrl(e.hash)}" target="_blank" class="tx-hash-link">${e.hash.slice(0, 10)}...${e.hash.slice(-6)} 🔗</a>`;
        const usdcLine = e.usdcValue ? `<div class="tx-detail-line">💰 ≈ ${e.usdcValue} USDC (au moment de la tx)</div>` : '';
        const catLine = (e.catEmetteur || e.catDestinataire) ? `<div class="tx-detail-line">🏷️ ${e.catEmetteur || '?'} → ${e.catDestinataire || '?'}</div>` : '';
        const siretLine = e.siret ? `<div class="tx-detail-line">🏢 SIRET: ${e.siret}</div>` : '';
        const tvaLine = e.tva ? `<div class="tx-detail-line">🧾 TVA: ${e.tva}%</div>` : '';
        return `<div class="tx-log-item ${cls}"><strong>${e.type === 'outgoing' ? '📤 Sortant' : '📥 Entrant'}</strong> ${e.amount} ${e.token}<br><small>${e.from} → ${e.to}</small><br><small class="tx-date">${d}</small><br>🔑 ${hashLink}${catLine}${siretLine}${tvaLine}${usdcLine}</div>`;
    }).join('');
}

// Rendre les fonctions disponibles globalement
window.addTxEntry = addTxEntry;
window.getTxLog = getTxLog;

// ==================== JOURNAL DE BORD & ÉVÉNEMENTS ====================
document.addEventListener('DOMContentLoaded', () => {
    // Journal
    const journalBtn = document.getElementById('journalBtn');
    const journalOverlay = document.getElementById('journalOverlay');
    const closeJournalBtn = document.getElementById('closeJournalBtn');
    const journalNotes = document.getElementById('journalNotes');
    const saveJournalBtn = document.getElementById('saveJournalBtn');

    journalNotes.value = localStorage.getItem('fl_journal_notes') || '';

    async function saveJournalToFile() {
        localStorage.setItem('fl_journal_notes', journalNotes.value);
        const content = journalNotes.value;
        try {
            const handle = await window.showSaveFilePicker({ suggestedName: 'journal_fdl.txt', types: [{ description: 'Fichier texte', accept: { 'text/plain': ['.txt'] } }] });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            alert('Notes sauvegardées avec succès.');
        } catch (e) {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'journal_fdl.txt'; a.click();
            URL.revokeObjectURL(url);
            alert('Notes téléchargées.');
        }
    }

    saveJournalBtn.addEventListener('click', saveJournalToFile);
    journalBtn.addEventListener('click', () => {
        if (journalOverlay.classList.contains('show')) {
            journalOverlay.classList.remove('show');
            journalBtn.style.background = '#1a2b4a';
        } else {
            journalOverlay.classList.add('show');
            journalBtn.style.background = '#38a169';
        }
    });
    closeJournalBtn.addEventListener('click', () => {
        journalOverlay.classList.remove('show');
        journalNotes.value = '';
        localStorage.removeItem('fl_journal_notes');
        journalBtn.style.background = '#1a2b4a';
    });

    // Historique
    document.getElementById('clearTxLogBtn').addEventListener('click', clearTxLog);
    document.getElementById('txHistoryToggle').addEventListener('click', () => {
        const list = document.getElementById('txLogList');
        list.classList.toggle('expanded');
        document.getElementById('txHistoryToggle').textContent = list.classList.contains('expanded') ? '▲ moins' : '▼ plus';
    });
    renderTxLog();

    document.getElementById('sendToJournalBtn').addEventListener('click', () => {
        const log = getTxLog();
        if (log.length === 0) { alert("Aucune transaction à envoyer."); return; }
        let content = "=== HISTORIQUE DES TRANSACTIONS ===\n\n";
        log.forEach(tx => {
            const date = new Date(tx.date).toLocaleString();
            content += `${date} | ${tx.type === 'outgoing' ? 'SORTANT' : 'ENTRANT'} | ${tx.amount} ${tx.token}\n`;
            content += `De: ${tx.from}\nÀ: ${tx.to}\n`;
            content += `Hash: ${tx.hash}\n`;
            content += `Lien (copier/coller dans navigateur): ${getExplorerUrl(tx.hash)}\n`;
            if (tx.usdcValue) content += `Valeur USDC au moment: ${tx.usdcValue} USDC\n`;
            if (tx.catEmetteur) content += `Catégories: ${tx.catEmetteur} → ${tx.catDestinataire}\n`;
            if (tx.siret) content += `SIRET: ${tx.siret}\n`;
            if (tx.tva) content += `TVA: ${tx.tva}%\n`;
            content += "----------------------------------------\n";
        });
        const journalArea = document.getElementById('journalNotes');
        journalArea.value = content + "\n" + journalArea.value;
        alert("Historique copié vers le journal !");
        if (!journalOverlay.classList.contains('show')) {
            journalOverlay.classList.add('show');
            journalBtn.style.background = '#38a169';
        }
    });
});