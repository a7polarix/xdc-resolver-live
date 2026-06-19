// ==================== INIT APP (wallet + transactions) ====================
window.addEventListener('load',()=>{if(typeof ethers!=='undefined')initApp();else alert("ethers non chargé");});
async function initApp(){
    let provider=null,signer=null,userAddress=null;
    const els={
        connectBtn:document.getElementById('connectBtn'),
        disconnectBtn:document.getElementById('disconnectBtn'),
        sendBtn:document.getElementById('sendBtn'),
        accountInfo:document.getElementById('accountInfo'),
        balanceInfo:document.getElementById('balanceInfo'),
        txStatus:document.getElementById('txStatus'),
        donateStatus:document.getElementById('donateStatus'),
        invoiceContainer:document.getElementById('invoiceContainer'),
        manualInvoice:document.getElementById('manualInvoice'),
        fromDomain:document.getElementById('fromDomain'),
        toDomain:document.getElementById('toDomain'),
        amount:document.getElementById('amount'),
        token:document.getElementById('token'),
        quickDonateBtn:document.getElementById('quickDonateBtn'),
        donateAmount:document.getElementById('donateAmount'),
        invoiceHash:document.getElementById('invoiceHash'),
        verifyHashBtn:document.getElementById('verifyHashBtn'),
        invoiceFrom:document.getElementById('invoiceFrom'),
        invoiceTo:document.getElementById('invoiceTo'),
        invoiceAmount:document.getElementById('invoiceAmount'),
        invoiceSymbol:document.getElementById('invoiceSymbol'),
        generateInvoiceBtn:document.getElementById('generateInvoiceBtn'),
        sendDomainBtn:document.getElementById('sendDomainBtn'),
        sendDomainName:document.getElementById('sendDomainName'),
        sendDomainTo:document.getElementById('sendDomainTo'),
        sendDomainStatus:document.getElementById('sendDomainStatus')
    };

    function setDisconnected(){
        els.accountInfo.innerText="wallet : non connecté";
        els.balanceInfo.innerText="solde : --";
        els.sendBtn.disabled=true; els.sendBtn.classList.remove('ready');
        els.sendDomainBtn.disabled=true; els.sendDomainBtn.classList.remove('ready');
        els.connectBtn.classList.remove('ready');
        els.connectBtn.style.display='inline-block';
        els.disconnectBtn.style.display='none';
        userAddress=null; signer=null; provider=null;
        document.getElementById('signEipBtn').disabled=true;
    }
    setDisconnected();

    function updateSendBtnState(){
        if(signer&&els.toDomain.value.trim()&&!isNaN(parseFloat(els.amount.value))&&parseFloat(els.amount.value)>0){
            els.sendBtn.disabled=false; els.sendBtn.classList.add('ready');
        }else{ els.sendBtn.disabled=true; els.sendBtn.classList.remove('ready'); }
    }
    els.toDomain.addEventListener('input',updateSendBtnState); els.amount.addEventListener('input',updateSendBtnState);

    function updateSendDomainBtnState(){
        const name = els.sendDomainName.value.trim(), to = els.sendDomainTo.value.trim(), isXdc = currentNetwork === 'xdc';
        if(signer && name && to && isXdc){
            els.sendDomainBtn.disabled = false; els.sendDomainBtn.classList.add('ready');
        } else { els.sendDomainBtn.disabled = true; els.sendDomainBtn.classList.remove('ready'); }
    }
    els.sendDomainName.addEventListener('input', updateSendDomainBtnState);
    els.sendDomainTo.addEventListener('input', updateSendDomainBtnState);
    document.getElementById('networkSelect').addEventListener('change', updateSendDomainBtnState);

    function truncate(a){return a?`${a.slice(0,6)}...${a.slice(-4)}`:'';}

    async function getDomainCategory(domain){
        if(!domain||domain.startsWith('0x'))return null;
        const catPerso=document.getElementById('categoriePersoField').value.trim(); if(catPerso)return catPerso;
        if(LOCAL_CATEGORIES[domain.toLowerCase()])return LOCAL_CATEGORIES[domain.toLowerCase()];
        try {
            const parts = domain.split('.'); if(parts.length>=2 && parts.slice(-2).join('.').toLowerCase()==='⚜️⚜️⚜️.xdc'){
                const p = new ethers.JsonRpcProvider(getRpcUrl());
                const c = new ethers.Contract(NETWORKS.xdc.contractAddr, ["function getDomainInfo(string name) view returns (tuple(address owner, address resolver, uint256 expiry))"], p);
                const info = await c.getDomainInfo(domain.toLowerCase().trim());
                if(info.owner !== ethers.ZeroAddress) return "Lore & Mythes";
            }
        } catch(e){}
        return "invité";
    }

    async function fetchWithTimeout(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    async function resolveDomain(domain){
        if(domain.startsWith('0x')&&domain.length===42)return domain;
        if(currentNetwork!=='xdc'&&domain.endsWith('.eth')){
            try{
                const r=await fetchWithTimeout(`https://fleurs-resolver-final.vercel.app/api/resolve?domain=${encodeURIComponent(domain)}`, 10000);
                if(r.ok){const d=await r.json();if(d.result)return d.result;}
            }catch(e){}
        }
        if(currentNetwork==='xdc'){
            try{
                const r=await fetchWithTimeout(`https://fleurs-resolver-final.vercel.app/api/resolve?domain=${encodeURIComponent(domain)}`, 10000);
                if(r.ok){const d=await r.json();if(d.result)return d.result;}
            }catch(e){}
            try{const p=new ethers.JsonRpcProvider(getRpcUrl());const c=new ethers.Contract(NETWORKS.xdc.contractAddr,["function getAddress(string) view returns (address)"],p);const a=await c.getAddress(domain.toLowerCase().trim());if(a&&a!=="0x0000000000000000000000000000000000000000")return a;}catch(e){}
        }
        throw new Error("Domaine non résolu");
    }

    async function getUsdcPriceAtTime() {
        try {
            const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd');
            const d = await r.json();
            return d['usd-coin']?.usd || 1;
        } catch(e) { return 1; }
    }

    async function fetchTxDetails(h){
        if(!provider)provider=new ethers.JsonRpcProvider(getRpcUrl());
        const tx=await provider.getTransaction(h);if(!tx)throw new Error("Transaction introuvable");
        let from=tx.from,to=tx.to,amount,symbol=getTokenList()[0].value,nonce=tx.nonce;
        if(tx.value&&tx.value!==0n){amount=parseFloat(ethers.formatEther(tx.value));}
        else{
            const rc=await provider.getTransactionReceipt(h);if(!rc?.logs)throw new Error("Logs non trouvés");
            const top="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";let found=false;
            for(const log of rc.logs){if(log.topics[0]===top){from="0x"+log.topics[1].slice(26);to="0x"+log.topics[2].slice(26);amount=Number(ethers.formatUnits(ethers.toBigInt(log.data),18));found=true;break;}}
            if(!found)throw new Error("Aucun transfert détecté");
        }
        const block=await provider.getBlock(tx.blockNumber);const ts=new Date(block.timestamp*1000).toISOString();
        const short=h.slice(2,10);const inv=`FDL-${new Date().getFullYear()}-${short}${nonce}`;
        const usdcPrice = await getUsdcPriceAtTime();
        const usdcValue = (amount * usdcPrice).toFixed(4);
        return{amount,symbol,from,to,invoiceNumber:inv,timestampUTC:ts,usdcValue};
    }

    async function qrDataURL(data,size=150){const u=`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;const b=await(await fetch(u)).blob();return new Promise(r=>{const rd=new FileReader();rd.onloadend=()=>r(rd.result);rd.readAsDataURL(b);});}

    function getConfigFields(){return{siret:document.getElementById('siretField').value.trim(),tva:parseFloat(document.getElementById('tvaField').value)||0,adresse_siege:document.getElementById('adresseSiegeField').value.trim(),objet_prestation:document.getElementById('objetPrestationField').value.trim(),fiatCurrency:document.getElementById('fiatCurrencyField').value.trim()||'USD',categorie_personnalisee:document.getElementById('categoriePersoField').value.trim(),regime_tva:document.getElementById('regimeTvaField').value,mention_tva:document.getElementById('mentionTvaField').value.trim()};}

    async function buildInvoiceData(h,amt,from,to,sym,inv,ts,catFrom,catTo,amtStr,usdcValue){
        const cfg=getConfigFields();const price=currentOraclePrice;
        const effTva=cfg.regime_tva==='auto_entreprise'?0:cfg.tva;let ttc=null,rate=null;
        if(price&&!isNaN(amt)){rate=price;ttc=amt*price*(1+effTva/100);}
        const mention=cfg.regime_tva==='auto_entreprise'?(cfg.mention_tva||"TVA non applicable, art. 293B du CGI"):cfg.mention_tva;
        const f={numero:inv,emetteur:from,categorie_emetteur:catFrom||"invité",destinataire:to,categorie_destinataire:catTo||"invité",montant:amtStr||`${amt} ${sym}`,devise:sym,date:ts,hash:h,lien:getExplorerUrl(h),valeur_usdc_moment:usdcValue?`${usdcValue} USDC`:null};
        if(cfg.siret)f.siret=cfg.siret;if(cfg.adresse_siege)f.adresse_siege=cfg.adresse_siege;if(cfg.objet_prestation)f.objet_prestation=cfg.objet_prestation;
        if(effTva>0)f.tva_appliquee=`${effTva}%`;else if(cfg.regime_tva==='auto_entreprise')f.tva_appliquee="0% (auto-entreprise)";
        if(mention)f.mention_tva=mention;if(ttc!==null)f.montant_ttc_fiat=`${ttc.toFixed(4)} ${cfg.fiatCurrency}`;if(rate!==null)f.taux_change_utilise=`${rate.toFixed(8)} ${cfg.fiatCurrency}/${getTokenList()[0].value}`;
        return f;
    }

    function buildClientData(f){const c={...f};delete c.categorie_emetteur;delete c.categorie_destinataire;delete c.siret;delete c.adresse_siege;delete c.objet_prestation;delete c.tva_appliquee;delete c.mention_tva;delete c.montant_ttc_fiat;delete c.taux_change_utilise;return c;}

    async function displayInvoice(h,amt,from,to,sym,inv,ts,catFrom=null,catTo=null,amtStr=null,usdcValue=null){
        const full=await buildInvoiceData(h,amt,from,to,sym,inv,ts,catFrom,catTo,amtStr,usdcValue);
        const client=buildClientData(full);
        const qrD={hash:h,from,to,amount:amtStr||`${amt} ${sym}`,date:ts,explorer:getExplorerUrl(h),usdc:usdcValue};
        const qrURL=await qrDataURL(JSON.stringify(qrD));
        const fullStr=JSON.stringify({facture:full},null,2);
        const clientStr=JSON.stringify({facture:client},null,2);
        els.invoiceContainer.innerHTML=`<pre style="white-space:pre-wrap;">${fullStr}</pre><div class="qr-code-img"><img src="${qrURL}" alt="QR"></div>`;
        els.invoiceContainer.style.display='block';
        document.getElementById('copyJsonBtn').style.display='inline-block';document.getElementById('copyHashBtn').style.display='inline-block';
        document.getElementById('saveClientBtn').style.display='inline-block';document.getElementById('saveComptaBtn').style.display='inline-block';document.getElementById('saveBothBtn').style.display='inline-block';
        document.getElementById('copyJsonBtn').onclick=()=>{navigator.clipboard.writeText(fullStr);alert(t('json_copied'));};
        document.getElementById('copyHashBtn').onclick=()=>{navigator.clipboard.writeText(h);alert(t('hash_copied'));};
        document.getElementById('saveClientBtn').onclick=()=>downloadInvoice(clientStr,inv,qrURL,'client');
        document.getElementById('saveComptaBtn').onclick=()=>downloadInvoice(fullStr,inv,qrURL,'comptable');
        document.getElementById('saveBothBtn').onclick=()=>{downloadInvoice(clientStr,inv,qrURL,'client');setTimeout(()=>downloadInvoice(fullStr,inv,qrURL,'comptable'),500);};
        detectAndShowMainLocation();
    }

    function downloadInvoice(jsonStr,inv,qrURL,suffix){
        const isDark = document.body.classList.contains('theme-dark');const bg=isDark?'#111':'white';const color=isDark?'#ccc':'#1e2a3a';
        const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reçu ${inv}</title><style>body{font-family:monospace;padding:20px;background:${bg};color:${color}}pre{white-space:pre-wrap}.qr-code-img{text-align:center;margin:20px 0}.qr-code-img img{width:180px;height:180px;border:1px solid #555;padding:5px;background:white}</style></head><body><pre style="white-space:pre-wrap;">${jsonStr}</pre><div class="qr-code-img"><img src="${qrURL}"></div><div class="hash-link">🔗 <a href="${getExplorerUrl(inv.split('-').pop())}" style="color:#6ba3d6;">${t('view_on_explorer')}</a></div></body></html>`;
        const blob=new Blob([html],{type:"text/html"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`recu_${inv}_${suffix}.html`;a.click();URL.revokeObjectURL(a.href);alert(t('receipt_downloaded'));
    }

    async function refreshBalance(){
        if(!signer || !userAddress) return;
        try {
            const balance = await provider.getBalance(userAddress);
            const sym = getTokenList()[0].value;
            els.balanceInfo.innerText = `💰 ${ethers.formatEther(balance)} ${sym}`;
        } catch(e) {}
    }

    async function donate(amt){
        if(!signer)return alert("Connectez wallet.");if(isNaN(amt)||amt<=0)return;
        els.donateStatus.innerHTML="⏳ Envoi...";
        try{
            const target=currentNetwork==='xdc'?await resolveDomain("fleursdelys.xdc"):userAddress;
            const fromDisp=els.fromDomain.value||truncate(userAddress);
            const tx=await signer.sendTransaction({to:target,value:ethers.parseEther(amt.toString()),gasLimit:50000});
            els.donateStatus.innerHTML=`📡 Tx: ${tx.hash.slice(0,10)}...`;await tx.wait();
            const tok=getTokenList()[0].value;
            els.donateStatus.innerHTML=`✅ Don de ${amt} ${tok} effectué !`;
            await refreshBalance();
            const d=await fetchTxDetails(tx.hash);
            addTxEntry({type:'outgoing',from:fromDisp,to:target,amount:amt,token:tok,hash:tx.hash,usdcValue:d.usdcValue,siret:document.getElementById('siretField').value.trim(),tva:document.getElementById('tvaField').value,catEmetteur:await getDomainCategory(fromDisp),catDestinataire:"Trésorerie"});
            await displayInvoice(tx.hash,amt,fromDisp,target,tok,d.invoiceNumber,d.timestampUTC,await getDomainCategory(fromDisp),"Trésorerie",null,d.usdcValue);
        }catch(e){els.donateStatus.innerHTML=`❌ ${e.message}`;}
    }

    async function connectWallet(){
        if(!window.ethereum){alert("Installez MetaMask ou XDCPay.");return;}
        try{
            provider=new ethers.BrowserProvider(window.ethereum);await provider.send("eth_requestAccounts",[]);
            signer=await provider.getSigner();userAddress=await signer.getAddress();
            window._signer=signer;
            els.accountInfo.innerHTML=`✅ ${truncate(userAddress)}`;
            await refreshBalance();
            els.connectBtn.classList.add('ready');
            els.connectBtn.style.display='none';
            els.disconnectBtn.style.display='inline-block';
            updateSendBtnState();
            updateSendDomainBtnState();
            document.getElementById('signEipBtn').disabled=false;
            window.ethereum.on('accountsChanged',()=>location.reload());
        }catch(e){alert("Erreur : "+e.message);setDisconnected();}
    }

    function disconnectWallet(){
        setDisconnected();
        window._signer = null;
        els.accountInfo.innerText="wallet : non connecté";
        els.balanceInfo.innerText="solde : --";
        els.sendBtn.disabled=true; els.sendBtn.classList.remove('ready');
        els.sendDomainBtn.disabled=true; els.sendDomainBtn.classList.remove('ready');
        document.getElementById('signEipBtn').disabled=true;
    }

    els.connectBtn.onclick=connectWallet;
    els.disconnectBtn.onclick=disconnectWallet;
    els.quickDonateBtn.onclick=()=>{const a=parseFloat(els.donateAmount.value);if(!isNaN(a)&&a>0)donate(a);else alert("Montant invalide");};

    els.sendBtn.onclick=async()=>{
        const to=els.toDomain.value.trim(),amt=parseFloat(els.amount.value),tok=els.token.value,from=els.fromDomain.value.trim();
        if(!to||isNaN(amt)||amt<=0)return alert("Remplissez les champs.");if(!signer)return alert("Connectez wallet.");
        els.txStatus.innerHTML="🔍 Vérification du domaine émetteur...";
        try{
            if(from&&!from.startsWith('0x')){
                const resolvedFromAddress = await resolveDomain(from);
                if(resolvedFromAddress.toLowerCase()!==userAddress.toLowerCase()){
                    els.txStatus.innerHTML="❌ Le domaine émetteur ne correspond pas à votre wallet connecté.";
                    return;
                }
            }
            const target=to.startsWith('0x')&&to.length===42?to:await resolveDomain(to);
            els.txStatus.innerHTML=`⏳ Envoi de ${amt} ${tok}...`;let tx;
            const tokenAddr=getTokenAddress(tok);
            if(!tokenAddr){tx=await signer.sendTransaction({to:target,value:ethers.parseEther(amt.toString()),gasLimit:50000});}
            else{const c=new ethers.Contract(tokenAddr,["function transfer(address,uint256) returns (bool)"],signer);tx=await c.transfer(target,ethers.parseUnits(amt.toString(),getTokenDecimals(tok)));}
            els.txStatus.innerHTML+=`<br>📡 Tx: ${tx.hash.slice(0,10)}...`;await tx.wait();els.txStatus.innerHTML+=`<br>✅ Succès !`;
            await refreshBalance();
            const fromDisp=from||truncate(userAddress);const d=await fetchTxDetails(tx.hash);
            const fromCat=await getDomainCategory(fromDisp),toCat=await getDomainCategory(to);
            addTxEntry({type:'outgoing',from:fromDisp,to:to,amount:amt,token:tok,hash:tx.hash,usdcValue:d.usdcValue,siret:document.getElementById('siretField').value.trim(),tva:document.getElementById('tvaField').value,catEmetteur:fromCat,catDestinataire:toCat});
            await displayInvoice(tx.hash,amt,fromDisp,to,tok,d.invoiceNumber,d.timestampUTC,fromCat,toCat,null,d.usdcValue);
            els.amount.value = '';
        }catch(e){els.txStatus.innerHTML+=`<br>❌ ${e.message}`;}
    };

    els.sendDomainBtn.onclick=async()=>{
        const domainName=els.sendDomainName.value.trim();let toAddr=els.sendDomainTo.value.trim();
        if(!domainName||!toAddr)return alert("Remplissez le nom du domaine et l'adresse destinataire.");
        if(!signer)return alert("Connectez wallet.");
        if(currentNetwork!=='xdc')return alert("L'envoi de domaine n'est disponible que sur XDC Network.");
        els.sendDomainStatus.innerHTML="🔍 Résolution du destinataire...";
        try{
            if(!toAddr.startsWith('0x')){
                els.sendDomainStatus.innerHTML="🔍 Résolution du domaine destinataire...";
                toAddr = await resolveDomain(toAddr);
                els.sendDomainStatus.innerHTML=`✅ Destinataire résolu : ${toAddr.slice(0,6)}...${toAddr.slice(-4)}`;
            }
            if(!toAddr.startsWith('0x')||toAddr.length!==42)return alert("Adresse destinataire invalide.");
            const provider2=new ethers.JsonRpcProvider(getRpcUrl());
            const contractAddr=NETWORKS.xdc.contractAddr;
            const contract=new ethers.Contract(contractAddr,[
                "function getTokenId(string name) view returns (uint256)",
                "function ownerOf(uint256 tokenId) view returns (address)",
                "function transferFrom(address from, address to, uint256 tokenId)"
            ],signer);
            const tokenId=await contract.getTokenId(domainName.toLowerCase().trim());
            const owner=await contract.ownerOf(tokenId);
            if(owner.toLowerCase()!==userAddress.toLowerCase()){els.sendDomainStatus.innerHTML="❌ Ce domaine ne vous appartient pas.";return;}
            els.sendDomainStatus.innerHTML="⏳ Transfert du domaine...";
            const tx=await contract.transferFrom(userAddress,toAddr,tokenId,{gasLimit:150000});
            els.sendDomainStatus.innerHTML=`📡 Tx: ${tx.hash.slice(0,10)}...`;
            await tx.wait();
            els.sendDomainStatus.innerHTML=`✅ Domaine ${domainName} envoyé à ${els.sendDomainTo.value} !`;
            const usdcPrice = await getUsdcPriceAtTime();
            addTxEntry({type:'outgoing',from:domainName,to:els.sendDomainTo.value,amount:'1',token:'NFT',hash:tx.hash,usdcValue:(1*usdcPrice).toFixed(4),siret:document.getElementById('siretField').value.trim(),tva:document.getElementById('tvaField').value,catEmetteur:await getDomainCategory(domainName),catDestinataire:await getDomainCategory(els.sendDomainTo.value)});
            detectAndShowMainLocation();
            els.sendDomainName.value = '';
            els.sendDomainTo.value = '';
        }catch(e){els.sendDomainStatus.innerHTML=`❌ ${e.message}`;}
    };

    els.verifyHashBtn.onclick=async()=>{const h=els.invoiceHash.value.trim();if(!h?.startsWith('0x')||h.length<66)return alert("Hash invalide.");els.manualInvoice.style.display='none';try{if(!provider)provider=new ethers.JsonRpcProvider(getRpcUrl());const{amount,symbol,from,to,invoiceNumber,timestampUTC,usdcValue}=await fetchTxDetails(h);els.invoiceAmount.value=amount;els.invoiceSymbol.value=symbol;els.invoiceSymbol.disabled=true;els.invoiceFrom.value=from;els.invoiceTo.value=to;alert(`✅ Vérifié : ${amount} ${symbol} (≈${usdcValue} USDC au moment de la tx)`);window._pendingManual={hash:h,amount,symbol,from,to,invoiceNumber,timestampUTC,usdcValue};}catch(e){alert("Erreur : "+e.message);}};
    els.generateInvoiceBtn.onclick=async()=>{const p=window._pendingManual;if(!p)return alert("Vérifiez d'abord un hash.");const fromCat=await getDomainCategory(p.from),toCat=await getDomainCategory(p.to);await displayInvoice(p.hash,p.amount,p.from,p.to,p.symbol,p.invoiceNumber,p.timestampUTC,fromCat,toCat,`${p.amount} ${p.symbol}`,p.usdcValue);};

    // ==================== EIP-712 ====================
    function inferType(value) {
        if (typeof value === 'string') {
            if (/^0x[a-fA-F0-9]{40}$/.test(value)) return 'address';
            if (/^0x[a-fA-F0-9]{64}$/.test(value)) return 'bytes32';
            return 'string';
        }
        if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) return 'uint256';
        if (typeof value === 'boolean') return 'bool';
        return 'string';
    }

    document.getElementById('signEipBtn').onclick = async () => {
        if (!signer) return alert("Connectez le wallet");
        try {
            const domainRaw = JSON.parse(document.getElementById('eipDomain').value);
            const messageRaw = JSON.parse(document.getElementById('eipMessage').value);
            const domainTypes = Object.keys(domainRaw).map(key => ({ name: key, type: inferType(domainRaw[key]) }));
            const messageTypes = [], messageValues = {};
            for (const [key, val] of Object.entries(messageRaw)) {
                if (val && typeof val === 'object' && val.type && val.value !== undefined) {
                    messageTypes.push({ name: key, type: val.type });
                    messageValues[key] = val.value;
                } else {
                    const inferredType = inferType(val);
                    messageTypes.push({ name: key, type: inferredType });
                    messageValues[key] = val;
                }
            }
            const typedData = {
                types: { EIP712Domain: domainTypes, Message: messageTypes },
                domain: domainRaw,
                primaryType: 'Message',
                message: messageValues
            };
            const signature = await signer.signTypedData(typedData.domain, typedData.types, typedData.message);
            document.getElementById('eipResult').innerText = `Signature: ${signature}`;
        } catch(e) {
            document.getElementById('eipResult').innerText = `Erreur: ${e.message}`;
        }
    };

    document.getElementById('resetConfigBtn').addEventListener('click', () => {
        if(confirm("Réinitialiser toute la configuration locale (clés API, paramètres, historique) ?")) {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('fl_'));
            keys.forEach(k => localStorage.removeItem(k));
            location.reload();
        }
    });

    setTimeout(async()=>{if(getNetwork().oracleDefault)await testOracle(getNetwork().oracleDefault);updateTTCEstimate();},1000);
}