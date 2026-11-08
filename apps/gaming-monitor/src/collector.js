import {Client,GatewayIntentBits,Events} from 'discord.js';
const {DISCORD_BOT_TOKEN,DISCORD_GUILD_ID,DISCORD_USER_ID,COLLECTOR_TOKEN}=process.env;
if(!DISCORD_BOT_TOKEN || !/^\d{17,20}$/.test(DISCORD_GUILD_ID||'') || !/^\d{17,20}$/.test(DISCORD_USER_ID||'') || !COLLECTOR_TOKEN) throw new Error('Configure bot token, guild ID, user ID and collector token in environment');
const endpoint=new URL('/internal/presence',process.env.COLLECTOR_API_URL||'http://127.0.0.1:4310');
if(endpoint.protocol!=='https:' && !['localhost','127.0.0.1','api'].includes(endpoint.hostname)) throw new Error('Remote collector API requires HTTPS');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildPresences]});
let snapshot={connected:false,activities:[]}, queue=Promise.resolve(), deliveryGap=false, pending=false, sending=false;
function publish() {
 pending=true;
 if(sending)return;
 sending=true;
 queue=(async()=>{
  while(pending){
   pending=false;
   const body=JSON.stringify(snapshot);
   const send=async payload=>{const res=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${COLLECTOR_TOKEN}`,'content-type':'application/json'},body:payload,signal:AbortSignal.timeout(5000)});if(!res.ok)throw new Error('ingest rejected');};
   try {if(deliveryGap)await send(JSON.stringify({connected:false,activities:[]}));deliveryGap=false;await send(body);}
   catch {deliveryGap=true;console.error('Collector delivery failed; activity will expire at API');}
  }
  sending=false;
 })();
}
function gap(){deliveryGap=true;snapshot={connected:false,activities:[]};publish();}
function observe(presence){
 if(presence.guild.id!==DISCORD_GUILD_ID || presence.userId!==DISCORD_USER_ID)return;
 snapshot={connected:true,activities:presence.activities.map(a=>({name:a.name,type:a.type,applicationId:a.applicationId,timestamps:{start:a.timestamps?.start?.getTime()},assets:{largeImage:a.assets?.largeImage}}))};publish();
}
function refresh(){
 const guild=client.guilds.cache.get(DISCORD_GUILD_ID);
 if(!guild || !guild.available){gap();return;}
 const presence=guild.presences.cache.get(DISCORD_USER_ID);
 if(presence)observe(presence);else gap(); // Unknown initial presence is never asserted idle.
}
client.on(Events.ClientReady,refresh);
client.on(Events.PresenceUpdate,(_old,p)=>observe(p));
client.on(Events.ShardDisconnect,gap);client.on(Events.ShardReconnecting,gap);client.on(Events.Invalidated,gap);
client.on(Events.ShardResume,refresh);client.on(Events.GuildUnavailable,g=>{if(g.id===DISCORD_GUILD_ID)gap();});
client.on(Events.Error,()=>{console.error('Discord connection error');gap();});
const timer=setInterval(()=>{if(client.isReady())publish();else gap();},30000);
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{clearInterval(timer);gap();await queue;client.destroy();process.exit(0);});
client.login(DISCORD_BOT_TOKEN).catch(()=>{console.error('Discord login failed; verify bot configuration and privileged intent');process.exitCode=1;clearInterval(timer);client.destroy();});
