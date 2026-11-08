// Deliberately conservative. Future adapters may add evidence-backed rules here.
export function classify(activity) {
  const name = activity.name.toLowerCase();
  if (name === 'retroarch') return {platform:'Unknown', category:'Emulator', confidence:'inferred', evidence:'Activity named RetroArch; ROM and device unverified'};
  if (name === 'launchbox' || name === 'big box') return {platform:'Unknown', category:'Launcher', confidence:'inferred', evidence:'Launcher name only; game and device unverified'};
  return {platform:'Unknown', category:'Game', confidence:'unknown', evidence:'Discord presence does not verify store, device, VR or Quest origin'};
}
export function parseActivities(activities, now = Date.now()) {
  return activities.filter(a => a.type === 0 && typeof a.name === 'string' && a.name.trim()).map(a => {
    const applicationId = /^\d{1,24}$/.test(a.applicationId) ? a.applicationId : null;
    const start = Number(a.timestamps?.start);
    const startedAt = Number.isFinite(start) && start > 0 && start <= now ? start : null;
    const image = a.assets?.largeImage;
    const artwork = applicationId && typeof image === 'string' && /^\d+$/.test(image)
      ? `https://cdn.discordapp.com/app-assets/${applicationId}/${image}.png` : null;
    const title = a.name.trim().slice(0,200);
    return {key:`${applicationId || 'name'}:${title}`, title, applicationId, startedAt, artwork,
      source:'Discord Rich Presence', classification:classify({name:title}),
      // Allowlist diagnostic fields. No user/guild IDs, party, secrets, URLs or free text.
      metadata:{name:title, type:0, applicationId, timestamps:{start:startedAt}, assets:artwork ? {largeImage:image}:null}};
  }).filter((a,i,all) => all.findIndex(b=>b.key===a.key)===i);
}
