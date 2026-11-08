const $=id=>document.getElementById(id), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode='demo',token='',status, sessions=[],diagnostics={},baseline=null,generation=0;
const boot=Date.now(), day=new Date();day.setHours(0,0,0,0);
const demoGames=[['Metro Exodus','Steam · Windows PC',0],['Minecraft','Non-Steam · Windows PC',1],['Sonic the Hedgehog','RetroArch · Emulated',2],['Walkabout Mini Golf','Meta Quest standalone',3]];
const demoSessions=demoGames.map(([title,platform],i)=>({id:`demo-${i}`,title,source:'Simulated activity',classification:{platform,confidence:'demo'},startedAt:i===0?boot-2235000:day.getTime()-(i===3?86400000:0)+3600000*(i+7),lastObservedAt:boot,endedAt:i===0?null:day.getTime()-(i===3?86400000:0)+3600000*(i+7)+1800000,duration:i===0?2235000:1800000,status:i===0?'active':'completed',confidence:'demo',boundaryUncertain:false}));
const duration=ms=>{const s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,'0')).join(':');};
const time=n=>n?new Date(n).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Unknown';
function row(s){return `<div class="row"><div><strong>${escape(s.title)}</strong><small>${escape(s.classification.platform)} · ${mode==='demo'?'Simulated':escape(s.status)}${s.boundaryUncertain?' · uncertain boundary':''}</small></div><div class="right">${duration(s.status==='active'&&status?.state==='playing'?Date.now()-s.startedAt:s.duration)}<br><small>${time(s.startedAt)} → ${s.endedAt?time(s.endedAt):s.status==='active'?'ongoing':'unknown end'}</small></div></div>`;}
function render(){
 const live=status?.state==='playing', names={playing:'🎮 Currently Playing','not-playing':'💤 Not Playing',disconnected:'⚠️ Discord Disconnected',waiting:'⏳ Waiting for Activity'};
 $('connection').textContent=mode==='demo'?'Simulated':status?.connection||'Waiting';
 $('notice').textContent=mode==='demo'?'DEMO MODE · Simulated activity. No Discord connection.':status?.error||'PRIVATE MODE · Discord observations only. Quest attribution unverified.';
 $('desk').textContent=mode==='demo'?'Demo is running in this browser. No sessions are sent to the API.':`Discord: ${status?.connection||'waiting'}. Last successful update: ${status?.lastUpdate?new Date(status.lastUpdate).toLocaleString():'none'}.`;
 $('current').innerHTML=live?status.activities.map(s=>`<article class="hero"><div class="art">${s.artwork?`<img src="${escape(s.artwork)}" alt="${escape(s.title)} artwork">`:'✚'}</div><div><div class="live">${names.playing} · ${mode==='demo'?'SIMULATED':'LIVE'}</div><h3>${escape(s.title)}</h3><span class="badge">${escape(s.classification.platform)}</span> <span class="muted">${escape(s.classification.confidence)}</span><div class="details"><div><small>Session duration</small><strong>${duration(Date.now()-s.startedAt)}</strong></div><div><small>Started</small><strong>${time(s.startedAt)}${s.boundaryUncertain?' · uncertain':''}</strong></div><div><small>Source</small><strong>${escape(s.source)}</strong></div><div><small>Last update</small><strong>${time(status.lastUpdate)}</strong></div></div></div></article>`).join(''):`<article class="hero"><div class="art">${status?.state==='not-playing'?'☾':'✚'}</div><div><div class="live">${escape(names[status?.state]||names.waiting)}</div><h3>${status?.state==='not-playing'?'Taking a breather.':'Your next session awaits.'}</h3><p class="muted">${status?.state==='disconnected'?'Current activity is unavailable. Previous sessions remain in history.':'Connect the private integration to receive gaming activity.'}</p><span class="badge">${escape(status?.freshness||'unavailable')}</span></div></article>`;
 $('recent').innerHTML=sessions.slice(0,4).map(row).join('')||'<p>No sessions recorded.</p>';
 const start=day.getTime(),end=new Date(day);end.setDate(end.getDate()+1);
 const today=sessions.filter(s=>s.startedAt<+end && (s.endedAt||s.lastObservedAt)>=start);
 $('timeline').innerHTML=today.map(s=>{const left=Math.max(start,s.startedAt),right=Math.min(+end,s.endedAt||(s.status==='active'&&live?Date.now():s.lastObservedAt));return `<div class="track" title="${escape(s.title)}${s.boundaryUncertain?' (uncertain)':''}"><div class="bar" data-left="${100*(left-start)/(end-start)}" data-width="${Math.max(0,100*(right-left)/(end-start))}"></div></div>`;}).join('')||'<p class="muted">No activity today.</p>';
 document.querySelectorAll('.bar').forEach(bar=>{bar.style.left=bar.dataset.left+'%';bar.style.width=bar.dataset.width+'%';});
 const period=$('period').value,from=new Date(day),until=new Date(day);until.setDate(until.getDate()+1);
 if(period==='yesterday'){from.setDate(from.getDate()-1);until.setTime(+day);}else if(period==='week')from.setDate(from.getDate()-6);
 $('history-list').innerHTML=sessions.filter(s=>s.startedAt<+until&&(s.endedAt||s.lastObservedAt)>=+from).map(row).join('')||'<p>No sessions in this period.</p>';
 $('diagnostic-data').textContent=JSON.stringify(diagnostics,null,2);
 $('quest-data').textContent=JSON.stringify({mode,platformAttribution:'Unknown',questVerified:false,activities:diagnostics.activities||[]},null,2);
}
async function refresh(){
 const version=generation;
 if(mode==='demo'){status={state:'playing',connection:'simulated',lastUpdate:Date.now(),activities:[demoSessions[0]],freshness:'simulated'};sessions=demoSessions;diagnostics={mode:'demo',activities:demoGames.map(([name])=>({name,type:0,simulated:true})),questVerified:false};render();return;}
 if(!token){status={state:'waiting',connection:'unconfigured'};sessions=[];diagnostics={};render();return;}
 try{
 const results=await Promise.all(['status','sessions','diagnostics'].map(async path=>{const r=await fetch(`/api/gaming/${path}`,{headers:{authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(r.status===401?'Access denied. Check your dashboard token.':'API unavailable.');return r.json();}));
 if(version!==generation)return;[status,{sessions},diagnostics]=results;render();
 }catch(e){if(version!==generation)return;status={state:'disconnected',connection:'unavailable',freshness:'cached',error:e.message};diagnostics={error:e.message};render();}
}
$('mode').onchange=()=>{mode=$('mode').value;generation++;baseline=null;$('comparison').textContent='No baseline captured.';token='';$('token').value='';$('auth').hidden=mode!=='real';status=null;sessions=[];refresh();};
$('auth').onsubmit=e=>{e.preventDefault();token=$('token').value;$('token').value='';generation++;refresh();};
$('lock').onclick=()=>{token='';generation++;refresh();};
$('period').onchange=render;
$('baseline').onclick=()=>{const current=JSON.stringify(diagnostics.activities||[]);if(baseline===null){baseline=current;$('comparison').textContent='Baseline captured. Start a standalone Quest game, then compare.';$('baseline').textContent='Compare with baseline';}else{$('comparison').textContent=(baseline===current?'No change in observed gaming metadata.':'Gaming metadata changed. Device origin remains Unknown; this does not verify Quest support.')+(mode==='demo'?' Demo data only.':'');}};
function route(){const page=['dashboard','history','quest','diagnostics'].includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';for(const id of ['dashboard','history','quest','diagnostics'])$(id).hidden=id!==page;document.querySelectorAll('nav a').forEach(a=>a.toggleAttribute('aria-current',a.hash===`#${page}`));}window.onhashchange=route;route();refresh();setInterval(refresh,15000);setInterval(()=>{if(status)render();},1000);
