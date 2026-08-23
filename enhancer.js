(()=>{
const V='0.4.1';
const later=['some','watching','paused','finished','dropped'];
function cur(){try{return current()}catch(e){return window.deck&&window.deck[window.pos]}}
function rr2(){const s=cur();return s?rec(s.plex_id):{}}
function choose(key,val){const s=cur();if(!s)return;rec(s.plex_id)[key]=val;save();refreshPP()}
function mkButton(label,key,val){const b=document.createElement('button');b.textContent=label;b.dataset.v=val;b.onclick=()=>choose(key,val);return b}
function build(){
 const sub=document.querySelector('header .muted');if(sub&&!sub.textContent.includes('v'+V))sub.insertAdjacentHTML('beforeend',' · v'+V);
 const body=document.querySelector('.body');if(!body)return;
 const status=document.getElementById('status');
 if(status){status.innerHTML='';[['👀 Watching','watching'],['✅ Watched / finished','finished'],['⏸️ Paused','paused'],['👋 Dropped','dropped'],['📺 Seen some','some'],['✨ Not watched','never']].forEach(x=>status.appendChild(mkButton(x[0],'status',x[1])))}
 const rating=document.getElementById('rating'),ratingQ=rating?.previousElementSibling,unknown=document.getElementById('unknown')?.parentElement;
 const rewatch=document.getElementById('rewatch'),rewatchQ=rewatch?.previousElementSibling;
 const recency=document.getElementById('recency'),recencyQ=recency?.previousElementSibling;
 const rewatches=document.getElementById('rewatches'),rewatchesQ=rewatches?.previousElementSibling;
 const note=document.getElementById('note'),noteQ=note?.previousElementSibling;
 [ratingQ,rating,unknown,rewatchQ,rewatch,recencyQ,recency,rewatchesQ,rewatches].forEach(el=>{if(el)el.classList.add('pp-watched-only')});
 if(!document.getElementById('pp-interest')){const interest=document.createElement('div');interest.id='pp-interest';interest.className='pp-section pp-interest';interest.innerHTML='<div class="pp-label">Does it appeal to you?</div><div class="pp-grid three" id="pp-interest-grid"></div><div class="pp-hint">This is interest, not a rating. You can change your mind later.</div>';const ig=interest.querySelector('#pp-interest-grid');[['😍 Really want to watch','keen'],['🤔 Maybe','maybe'],['🙅 Not for me','no']].forEach(x=>ig.appendChild(mkButton(x[0],'interest',x[1])));if(ratingQ)body.insertBefore(interest,ratingQ)}
 if(!document.getElementById('pp-viewers')){const viewers=document.createElement('div');viewers.id='pp-viewers';viewers.className='pp-section';viewers.innerHTML='<div class="pp-label">Who do you watch this with?</div><div class="pp-grid three" id="pp-viewer-grid"></div><div class="pp-hint">You are always included. Tap May and/or Maya if they watch this with you.</div>';const vg=viewers.querySelector('#pp-viewer-grid');[['👩 May','May'],['👧 Maya','Maya'],['👨‍👩‍👧 Both','Both']].forEach(x=>vg.appendChild(mkButton(x[0],'watch_with',x[1])));if(noteQ)body.insertBefore(viewers,noteQ)}
 if(!document.querySelector('.pp-version')){const foot=document.createElement('div');foot.className='pp-version';foot.textContent='PixelPal Watch Rating Deck · v'+V+' · Adam prototype';document.querySelector('.app')?.appendChild(foot)}
 refreshPP();
}
window.refreshPP=function(){const r=rr2(),st=r.status||'',watched=later.includes(st),never=st==='never';document.querySelectorAll('.pp-watched-only').forEach(x=>x.classList.toggle('pp-hidden',!watched));document.getElementById('pp-interest')?.classList.toggle('pp-hidden',!never);document.getElementById('pp-viewers')?.classList.toggle('pp-hidden',!(watched||never));document.querySelectorAll('#pp-interest-grid button').forEach(b=>b.classList.toggle('sel',b.dataset.v===r.interest));document.querySelectorAll('#pp-viewer-grid button').forEach(b=>b.classList.toggle('sel',b.dataset.v===r.watch_with));document.querySelectorAll('#status button').forEach(b=>b.classList.toggle('sel',b.dataset.v===r.status))};
const oldRender=window.render;if(oldRender)window.render=function(){oldRender.apply(this,arguments);setTimeout(refreshPP,0)};
const oldPaint=window.paint;if(oldPaint)window.paint=function(){oldPaint.apply(this,arguments);setTimeout(refreshPP,0)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else setTimeout(build,0);
})();