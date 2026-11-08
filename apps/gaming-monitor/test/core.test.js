import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {parseActivities} from '../src/activity.js';
import {createApp} from '../src/server.js';
const game=(name='Metro Exodus',start=1000)=>({name,type:0,applicationId:'123456789012345678',timestamps:{start}});
function fixture(){let now=10000;const store=new Store(':memory:',()=>now);return {store,tick:n=>now+=n,send:activities=>store.ingest({connected:true,activities})};}
test('parser ignores music, streaming, custom and competing activities; safe diagnostic allowlist',()=>{
 const parsed=parseActivities([game(),{name:'Spotify',type:2},{name:'stream',type:1},{name:'status',type:4},{...game('RetroArch'),details:'private ROM',secrets:{join:'secret'},party:{id:'private'}}],10000);
 assert.equal(parsed.length,2);assert.equal(parsed[1].classification.platform,'Unknown');assert.equal(parsed[1].classification.category,'Emulator');assert.ok(!JSON.stringify(parsed).includes('private'));
});
test('Quest title and ordinary game remain unknown; missing, future and invalid timestamps',()=>{
 for(const name of ['Walkabout Mini Golf','Minecraft','SteamVR'])assert.equal(parseActivities([game(name)],10000)[0].classification.platform,'Unknown');
 for(const start of [null,-1,'bad',999999])assert.equal(parseActivities([game('Game',start)],10000)[0].startedAt,null);
});
test('multiple activities, repeats, switch and removal maintain independent sessions',()=>{
 const f=fixture();f.send([game(),game('Minecraft')]);f.tick(1000);f.send([game(),game('Minecraft')]);assert.equal(f.store.history().length,2);
 f.tick(1000);f.send([game('Minecraft'),game('Other')]);assert.equal(f.store.history().find(s=>s.title==='Metro Exodus').status,'completed');assert.equal(f.store.status().activities.length,2);
 f.send([]);assert.equal(f.store.status().state,'not-playing');assert.ok(f.store.history().every(s=>s.status==='completed'));f.store.close();
});
test('disconnect hides stale activity; same timestamp reconnect reuses uncertain session',()=>{
 const f=fixture();f.send([game()]);const id=f.store.history()[0].id;f.store.disconnect();assert.equal(f.store.status().activities.length,0);assert.equal(f.store.history()[0].endedAt,null);
 f.tick(1000);f.send([game()]);assert.equal(f.store.history().length,1);assert.equal(f.store.history()[0].id,id);assert.equal(f.store.history()[0].confidence,'uncertain');f.store.close();
});
test('missing start never invents a seamless reconnect; expiry and changed start',()=>{
 const f=fixture();f.send([game('A',null)]);assert.equal(f.store.history()[0].confidence,'uncertain');f.store.disconnect();f.send([game('A',null)]);assert.equal(f.store.history().length,2);
 f.tick(90001);assert.equal(f.store.status().state,'disconnected');assert.equal(f.store.history().filter(s=>s.status==='active').length,0);
 f.send([game('B',1000)]);f.send([game('B',2000)]);assert.equal(f.store.history().filter(s=>s.title==='B').length,2);f.store.close();
});
test('persistent history survives restart without reporting active sessions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gaming-test-')),path=join(dir,'db.sqlite');let s=new Store(path,()=>10000);s.ingest({connected:true,activities:[game()]});s.close();s=new Store(path,()=>11000);assert.equal(s.history().length,1);assert.equal(s.history()[0].status,'uncertain');assert.equal(s.status().state,'disconnected');s.ingest({connected:true,activities:[game()]});assert.equal(s.history().length,1);s.close();rmSync(dir,{recursive:true});
});
test('API authenticates every private endpoint, separates collector credentials and has no demo mutation API',async t=>{
 const f=fixture(),dashboardToken='d'.repeat(64),collectorToken='c'.repeat(64),app=createApp({store:f.store,dashboardToken,collectorToken});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();f.store.close();});const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['status','sessions','sources','health','diagnostics']){
 assert.equal((await fetch(`${base}/api/gaming/${path}`)).status,401);
 assert.equal((await fetch(`${base}/api/gaming/${path}`,{headers:{authorization:`Bearer ${collectorToken}`}})).status,401);
 assert.equal((await fetch(`${base}/api/gaming/${path}`,{headers:{authorization:`Bearer ${dashboardToken}`}})).status,200);
 }
 const post=token=>fetch(`${base}/internal/presence`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({connected:true,activities:[game()]})});
 assert.equal((await post(dashboardToken)).status,401);assert.equal((await post(collectorToken)).status,204);
 assert.equal((await fetch(`${base}/api/gaming/demo`,{method:'POST',headers:{authorization:`Bearer ${dashboardToken}`}})).status,404);
 assert.equal(f.store.history().length,1);
 const malformed=await fetch(`${base}/internal/presence`,{method:'POST',headers:{authorization:`Bearer ${collectorToken}`,'content-type':'application/json'},body:'{"connected":true,"activities":[null]}'});assert.equal(malformed.status,400);
});
