import express from 'express';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Store} from './store.js';
export function createApp({store, dashboardToken, collectorToken}) {
  if(!dashboardToken || dashboardToken.length<32 || !collectorToken || collectorToken.length<32 || dashboardToken===collectorToken) throw new Error('Configure distinct DASHBOARD_TOKEN and COLLECTOR_TOKEN (at least 32 characters each)');
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' https://cdn.discordapp.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});next();});
  const auth=token=>(req,res,next)=>{const value=req.headers.authorization||'';const expected=`Bearer ${token}`;if(Buffer.byteLength(value)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(value),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});next();};
  app.post('/internal/presence',auth(collectorToken),express.json({limit:'32kb'}),(req,res)=>{
    const b=req.body;
    if(!b || typeof b.connected!=='boolean' || !Array.isArray(b.activities) || b.activities.length>20 || b.activities.some(a=>!a||typeof a!=='object'||typeof a.name!=='string')) return res.status(400).json({error:'Invalid presence envelope'});
    store.ingest(b);res.sendStatus(204);
  });
  app.use('/api',auth(dashboardToken));
  app.get('/api/gaming/status',(req,res)=>res.json(store.status()));
  app.get('/api/gaming/sessions',(req,res)=>res.json({sessions:store.history(),freshness:'historical'}));
  app.get('/api/gaming/sources',(req,res)=>res.json({discord:{connection:store.status().connection,capabilities:['playing activities','multiple activities','Discord artwork'],questVerified:false},future:['Steam','LaunchBox','RetroArch','Quest'],demo:{scope:'browser only'}}));
  app.get('/api/gaming/health',(req,res)=>res.json({api:'ok',collector:store.status().connection,lastUpdate:store.lastUpdate}));
  app.get('/api/gaming/diagnostics',(req,res)=>res.json({connection:store.status().connection,lastUpdate:store.lastUpdate,questObservation:'unverified',note:'Activity names cannot establish Quest attribution.',activities:store.activities.map(a=>a.metadata)}));
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.status===413?'Payload too large':'Request failed'}));
  return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const store=new Store(process.env.DB_PATH||'./data/gaming.sqlite');
 const app=createApp({store,dashboardToken:process.env.DASHBOARD_TOKEN,collectorToken:process.env.COLLECTOR_TOKEN});
 const server=app.listen(Number(process.env.PORT||4310),process.env.HOST||'127.0.0.1',()=>console.log('Gaming monitor listening'));
 for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store.disconnect('API shutdown');store.close();process.exit(0);}));
}
