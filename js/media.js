// ==================== MEDIA ENGINE ====================
const mediaIframe=document.getElementById('mediaIframe');
const mediaVideo=document.getElementById('mediaVideo');
const mediaAudio=document.getElementById('mediaAudio');
const mediaFsBtn=document.getElementById('mediaFsBtn');
const urlBar=document.getElementById('urlBar');
const mediaUrlInput=document.getElementById('mediaUrlInput');
const loadMediaUrlBtn=document.getElementById('loadMediaUrlBtn');
const radioControls=document.getElementById('radioControls');
const radioCountry=document.getElementById('radioCountry');
const radioStationList=document.getElementById('radioStationList');
const searchRadioBtn=document.getElementById('searchRadioBtn');
const playRadioBtn=document.getElementById('playRadioBtn');
const stopRadioBtn=document.getElementById('stopRadioBtn');
const localFileRow=document.getElementById('localFileRow');
const localMediaFile=document.getElementById('localMediaFile');
const playLocalBtn=document.getElementById('playLocalBtn');
const stopLocalBtn=document.getElementById('stopLocalBtn');
const timeframeSelector=document.getElementById('timeframeSelector');
let currentInterval = '1';

let currentMediaType='bourse';
function hideAllMedia(){mediaIframe.style.display='none';mediaVideo.style.display='none';mediaAudio.style.display='none';urlBar.style.display='none';radioControls.style.display='none';localFileRow.style.display='none';timeframeSelector.style.display='none';mediaVideo.src='';mediaAudio.src='';mediaAudio.pause();mediaVideo.pause();}
function showMediaType(type){
    hideAllMedia();
    currentMediaType=type;
    const isDark = document.body.classList.contains('theme-dark');
    if(type==='bourse'){
        timeframeSelector.style.display='flex';
        mediaIframe.style.display='block';
        updateBourseIframe();
    }
    else if(type==='x'){
        urlBar.style.display='flex';
        mediaIframe.style.display='none';
        loadMediaUrlBtn.onclick=()=>{
            let url=mediaUrlInput.value.trim();
            if(!url) url='https://x.com';
            window.open(url, '_blank');
        };
        mediaUrlInput.value='https://x.com';
    }
    else if(type==='youtube'){
        urlBar.style.display='flex';
        mediaIframe.style.display='block';
        mediaIframe.src='https://www.youtube.com/embed/dQw4w9WgXcQ';
        loadMediaUrlBtn.onclick=()=>{
            let url=mediaUrlInput.value.trim();
            if(url){
                const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                if (videoId && videoId[1]) {
                    url = `https://www.youtube.com/embed/${videoId[1]}`;
                }
                mediaIframe.src=url;
                mediaIframe.style.display='block';
            }
        };
        mediaUrlInput.value='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    }
    else if(type==='radio'){
        radioControls.style.display='flex';
        mediaAudio.style.display='block';
        loadRadioCountries();
    }
    else if(type==='local'){
        localFileRow.style.display='flex';
        mediaVideo.style.display='none';
        mediaIframe.style.display='none';
    }
}
function updateBourseIframe(){
    const isDark = document.body.classList.contains('theme-dark');
    const symbol = "BINANCE:BTCUSDT";
    const interval = currentInterval || '5';
    mediaIframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(symbol)}&interval=${interval}&hidesidetoolbar=1&hidetoptoolbar=1&symboledit=0&editablewatchlist=0&details=0&studies=[]&theme=${isDark?'dark':'light'}&style=1&timezone=exchange&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=fr`;
}

document.querySelectorAll('.timeframe-selector button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.timeframe-selector button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentInterval = btn.dataset.interval;
        if (currentMediaType === 'bourse') updateBourseIframe();
    });
});

showMediaType('bourse');

document.querySelectorAll('.media-tab-big').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.media-tab-big').forEach(t=>t.classList.remove('active'));tab.classList.add('active');showMediaType(tab.dataset.tab);});});
mediaUrlInput.addEventListener('keydown',(e)=>{if(e.key==='Enter')loadMediaUrlBtn.click();});
async function loadRadioCountries(){try{const r=await fetch('https://de1.api.radio-browser.info/json/countries');const countries=await r.json();radioCountry.innerHTML='<option value="">Monde</option>'+countries.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.iso_3166_1}">${c.name} (${c.stationcount})</option>`).join('');}catch(e){}}
searchRadioBtn.addEventListener('click',async()=>{const country=radioCountry.value;let url='https://de1.api.radio-browser.info/json/stations/search?limit=50&hidebroken=true&order=clickcount&reverse=true';if(country)url+=`&countrycode=${country}`;try{const r=await fetch(url);const stations=await r.json();radioStationList.innerHTML='<option value="">-- Choisir --</option>'+stations.map(s=>`<option value="${s.url_resolved||s.url}">${s.name} (${s.country})</option>`).join('');}catch(e){}});
playRadioBtn.addEventListener('click',()=>{const url=radioStationList.value;if(url){mediaAudio.src=url;mediaAudio.style.display='block';mediaAudio.play().catch(e=>console.log('Radio play error:',e));}});
stopRadioBtn.addEventListener('click',()=>{mediaAudio.pause();mediaAudio.src='';});
localMediaFile.addEventListener('change',()=>{const file=localMediaFile.files[0];if(!file)return;const url=URL.createObjectURL(file);if(file.type.startsWith('video/')){mediaVideo.src=url;mediaVideo.style.display='block';mediaAudio.style.display='none';mediaIframe.style.display='none';}else{mediaAudio.src=url;mediaAudio.style.display='block';mediaVideo.style.display='none';mediaIframe.style.display='none';}});
playLocalBtn.addEventListener('click',()=>{if(mediaVideo.src&&mediaVideo.style.display!=='none')mediaVideo.play();else if(mediaAudio.src&&mediaAudio.style.display!=='none')mediaAudio.play();});
stopLocalBtn.addEventListener('click',()=>{mediaVideo.pause();mediaAudio.pause();});
mediaFsBtn.addEventListener('click', () => {
    const el = document.getElementById('mediaContent');
    if (el.requestFullscreen) {
        el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
    }
});

// ==================== CHAT & MAIL ====================
const chatModeBtn = document.getElementById('chatModeBtn');
const mailModeBtn = document.getElementById('mailModeBtn');
const chatUrlInput = document.getElementById('chatUrlInput');
const mailToInput = document.getElementById('mailToInput');
const mailSubjectInput = document.getElementById('mailSubjectInput');
const sendMailBtn = document.getElementById('sendMailBtn');
const loadChatUrlBtn = document.getElementById('loadChatUrlBtn');
const chatContainer = document.getElementById('chatContainer');
const mailForm = document.getElementById('mailForm');
const chatIframe = document.getElementById('chatIframe');

function setCommMode(mode) {
    if (mode === 'chat') {
        chatModeBtn.classList.add('active'); mailModeBtn.classList.remove('active');
        chatUrlInput.style.display = 'block'; loadChatUrlBtn.style.display = 'block';
        mailToInput.style.display = 'none'; mailSubjectInput.style.display = 'none'; sendMailBtn.style.display = 'none';
        chatContainer.style.display = 'block'; mailForm.style.display = 'none';
    } else {
        mailModeBtn.classList.add('active'); chatModeBtn.classList.remove('active');
        chatUrlInput.style.display = 'none'; loadChatUrlBtn.style.display = 'none';
        mailToInput.style.display = 'block'; mailSubjectInput.style.display = 'block'; sendMailBtn.style.display = 'block';
        chatContainer.style.display = 'none'; mailForm.style.display = 'block';
    }
}

chatModeBtn.addEventListener('click', () => setCommMode('chat'));
mailModeBtn.addEventListener('click', () => setCommMode('mail'));

// ==================== CRYPTOGRAPHIE ====================
async function encryptMessage(publicKeyHex, plaintext) {
    const publicKey = await crypto.subtle.importKey('raw', hexToBuffer(publicKeyHex), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ephemeralKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const sharedSecret = await crypto.subtle.deriveKey({ name: 'ECDH', public: publicKey }, ephemeralKey.privateKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedSecret, encoded);
    const exportedPublic = await crypto.subtle.exportKey('raw', ephemeralKey.publicKey);
    return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)), ephemeralPublicKey: Array.from(new Uint8Array(exportedPublic)) };
}

function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
}

sendMailBtn.addEventListener('click', async () => {
    const toEmail = mailToInput.value.trim();
    const subject = mailSubjectInput.value.trim();
    const body = document.getElementById('mailMessage').value.trim();
    if (!toEmail) return alert('Veuillez entrer une adresse email.');
    const walletAddress = prompt("Adresse wallet du destinataire pour chiffrement (laisser vide pour non chiffré) :");
    let mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (walletAddress && walletAddress.startsWith('0x')) {
        try {
            const publicKey = prompt("Veuillez coller la clé publique du destinataire (hex) :");
            if (publicKey) {
                const encrypted = await encryptMessage(publicKey, body);
                const encryptedHex = JSON.stringify(encrypted);
                alert("Message chiffré. Ajoutez manuellement ce contenu dans le corps du mail : " + encryptedHex);
            }
        } catch(e) { alert("Erreur lors du chiffrement : " + e.message); }
    } else { window.location.href = mailto; }
});

loadChatUrlBtn.addEventListener('click', () => { const url = chatUrlInput.value.trim(); if (url) chatIframe.src = url; });
chatUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadChatUrlBtn.click(); });
setCommMode('chat');