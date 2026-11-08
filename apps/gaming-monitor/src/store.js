import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseActivities} from './activity.js';
export class Store {
  constructor(path, clock=Date.now) {
    if (path !== ':memory:') mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path); this.clock=clock;
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL);');
    this.sessions=this.db.prepare('SELECT data FROM sessions').all().map(r=>JSON.parse(r.data));
    this.connection='disconnected'; this.lastUpdate=null; this.activities=[]; this.gap=true;
    for (const s of this.sessions.filter(s=>s.status==='active')) {s.status='uncertain';s.confidence='uncertain';s.endReason='process restart';this.save(s);}
  }
  save(s) {this.db.prepare('INSERT OR REPLACE INTO sessions VALUES (?,?)').run(s.id,JSON.stringify(s));}
  disconnect(reason='connection gap') {
    this.connection='disconnected';this.gap=true;this.activities=[];
    for(const s of this.sessions.filter(s=>s.status==='active')) {s.status='uncertain';s.confidence='uncertain';s.endReason=reason;s.endedAt=null;this.save(s);}
  }
  expire() {if(this.connection==='connected' && this.clock()-this.lastUpdate>90000) this.disconnect('collector heartbeat expired');}
  ingest({connected,activities=[]}) {
    this.expire();
    if(!connected) {this.disconnect();return;}
    const now=this.clock(), parsed=parseActivities(activities,now), active=[];
    this.db.exec('BEGIN');
    try {
      for(const a of parsed) {
        let s=this.sessions.find(s=>s.key===a.key && s.status==='active');
        // Reattach only when Discord supplies the SAME verifiable session start.
        if(!s && a.startedAt) s=this.sessions.findLast(s=>s.key===a.key && s.status==='uncertain' && s.discordStartedAt===a.startedAt);
        if(s && a.startedAt && s.discordStartedAt && a.startedAt!==s.discordStartedAt) {
          s.status='completed';s.endedAt=now;s.endReason='new Discord start timestamp';this.save(s);s=null;
        }
        if(!s) {s={...a,id:randomUUID(),discordStartedAt:a.startedAt,startedAt:a.startedAt||now,endedAt:null,duration:0,confidence:a.startedAt?'observed':'uncertain',status:'active',boundaryUncertain:!a.startedAt||this.gap};this.sessions.push(s);}
        if(s.status==='uncertain') {s.boundaryUncertain=true;s.confidence='uncertain';}
        s.status='active';s.lastObservedAt=now;s.duration=Math.max(0,now-s.startedAt);s.artwork=a.artwork;this.save(s);active.push(s);
      }
      for(const s of this.sessions.filter(s=>s.status==='active'&&!active.includes(s))) {s.status='completed';s.endedAt=now;s.duration=Math.max(0,now-s.startedAt);s.endReason='activity removed';this.save(s);}
      this.db.exec('COMMIT');
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
    this.connection='connected';this.lastUpdate=now;this.activities=active;this.gap=false;
  }
  status() {this.expire();return {mode:'real',state:this.connection==='disconnected'?'disconnected':this.activities.length?'playing':'not-playing',connection:this.connection,lastUpdate:this.lastUpdate,freshness:this.connection==='connected'?'live':this.lastUpdate?'cached':'unavailable',activities:this.connection==='connected'?this.activities:[]};}
  history() {this.expire();return [...this.sessions].sort((a,b)=>b.startedAt-a.startedAt);}
  close(){this.db.close();}
}
