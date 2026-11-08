# PixelPal Gaming Monitor (experimental)

An isolated companion app. Nothing in PixelPal Watch, Purchases, their service workers, local storage, catalogues or routes is changed.

## Repository and hosting findings

The existing root `index.html` (and distinct `Index.html`) are vanilla HTML/JS; ratings live in localStorage. Purchases is an independent IndexedDB PWA. There is no existing authentication, database or API. GitHub Pages serves `main` at `https://thundercato.github.io/pixelpal-watch/` using legacy branch deployment. It cannot run a permanent Discord Gateway client or private API. This directory has its own package/lockfile and no root build changes. The existing homepage is deliberately untouched. Standalone local route: **http://127.0.0.1:4310/**.

```text
Discord Gateway → discord.js collector → authenticated ingestion → Node API + SQLite
                                                              ↑
                                                   private browser dashboard
```

Run one API instance and one collector per monitored user. Collector may run on a separate always-on computer. API owns SQLite exclusively. No Discord token reaches the browser. No message intents or message collection. Guilds + privileged GuildPresences are the only intents. Only one explicitly configured user in one configured guild is processed. Other connected guilds may produce Gateway events, but are filtered and never stored; install the bot only in your private server.

## Launch locally (Node 24+)

```sh
cd apps/gaming-monitor
npm ci
cp .env.example .env
openssl rand -hex 32  # put output in DASHBOARD_TOKEN in .env
openssl rand -hex 32  # put different output in COLLECTOR_TOKEN in .env
chmod 600 .env
npm start
```

Open **http://127.0.0.1:4310/**. Demo Mode works without Discord credentials. Its four labelled simulated games exist only in browser memory, never in SQLite. You can also serve `public/` with a static server for demo only (`python3 -m http.server 4310 --directory public`); private mode needs the Node API on the same origin. To use an iPhone/iPad on your LAN, bind `HOST=0.0.0.0` only behind a trusted HTTPS proxy or VPN. Do not forward the API directly to the public internet.

## Connect your Discord account

1. Create a **private Discord server** and join with the account to monitor.
2. Visit https://discord.com/developers/applications → New Application → Bot. Create/reset a **bot token**. Put it in `.env` as `DISCORD_BOT_TOKEN`; never put a user token here or send tokens in chat.
3. Bot → Privileged Gateway Intents → enable **Presence Intent** (`GUILD_PRESENCES`). Leave Message Content and Server Members disabled. If the application is subject to Discord privileged-intent approval, obtain approval first.
4. OAuth2 → URL Generator → select **bot** scope. Choose **no bot permissions** (no Administrator, message reading or sending needed). Open the generated URL and install in the private server. Ensure the monitored account is also a member.
5. Discord Settings → Advanced → Developer Mode. Right-click/long-press the private server → Copy Server ID → `DISCORD_GUILD_ID`. Copy the monitored account's User ID → `DISCORD_USER_ID`. These are IDs, not names. Only this pair is allowlisted.
6. In Discord Activity Privacy enable sharing detected activities. Appear online. Some games require registering the game in Discord. The bot observes only what Discord actually publishes; invisible/offline accounts and client/privacy settings can suppress activity.
7. Start `npm start`, then in another terminal in this directory run `npm run collector` (both read `.env`). Keep both processes alive. In the dashboard choose **Discord · private**, enter **DASHBOARD_TOKEN**, and Connect.
8. Launch a PC game, switch games, and stop playing. Check status, diagnostics and history. An absent initial presence remains disconnected/unavailable until a genuine event arrives; it is not reported as idle. Bot restart or network gaps may create uncertain sessions.

## Test Meta Quest standalone activity

Real Quest support has **not been verified**. Discord's gaming activity schema does not establish Quest origin. No game-title lookup is used to claim it.

1. Open `/#quest` on the running monitor and connect private mode as above.
2. In the Meta Horizon app/profile settings find connected accounts or Discord linking. Follow the **official Meta Horizon → Discord account connection** and consent flow; enable activity sharing where offered. Exact menus and availability vary by release, region and account. If missing, check Meta's current official help; this app cannot enable that connection.
3. In Discord enable activity sharing and remain online. Close PC games and VR streaming so an ordinary PC activity cannot be mistaken for standalone Quest play.
4. With the Quest idle, click **Capture baseline** on the Quest page.
5. Launch **Walkabout Mini Golf directly on the headset**, without Link/Air Link/SteamVR. Wait 30–60 seconds. Click **Compare with baseline**. Inspect the observed name, application ID and timestamp. Stop the game and confirm removal. Repeat with a second title.
6. A changed activity proves only that Discord published a gaming activity. Record your controlled start/stop observations separately. If no authoritative device/source field is supplied, platform remains **Unknown** and `questVerified` remains false. Absence is not proof of collector failure or universal Quest support. Demo observations never count as real evidence.

## API contract

All five endpoints require `Authorization: Bearer <DASHBOARD_TOKEN>`. There is no cookie auth or CORS access. Responses and static shell use `Cache-Control: no-store`. The shell and demo are public; all real activity and history are private. Tokens remain in browser memory, cleared on reload/lock/mode switch. Use long random secrets, TLS, a private network, and proxy rate limits for hosted access.

| GET endpoint | Response |
| --- | --- |
| `/api/gaming/status` | `mode`, `state` (`playing`, `not-playing`, `disconnected`), `connection`, `lastUpdate` (epoch ms or null), `freshness` (`live`, `cached`, `unavailable`), `activities` (active session objects; empty when disconnected) |
| `/api/gaming/sessions` | `{sessions: [...], freshness: "historical"}`; newest start first |
| `/api/gaming/sources` | Discord connection, capabilities, `questVerified: false`, future adapters, demo scope |
| `/api/gaming/health` | `{api: "ok", collector, lastUpdate}` |
| `/api/gaming/diagnostics` | Connection, last update, safe current activity metadata, unverified Quest status |

Session fields: `id`, `key`, `title`, `applicationId`, `source`, `classification` (`platform`, `category`, `confidence`, `evidence`), `startedAt`, `discordStartedAt`, `endedAt` (nullable), `lastObservedAt`, `duration` (milliseconds through last observation or observed removal), `status` (`active`, `completed`, `uncertain`), `confidence`, `boundaryUncertain`, `artwork`, safe `metadata`. All timestamps are epoch milliseconds. Classification confidence and session-boundary confidence are separate. Missing start falls back to first observation **with uncertainty**. Removal is an observed boundary, not guaranteed exact exit time. Inferred elapsed durations spanning gaps are marked uncertain and are not verified continuous play time. No total adds concurrent session durations.

Example disconnected status:
```json
{"mode":"real","state":"disconnected","connection":"disconnected","lastUpdate":null,"freshness":"unavailable","activities":[]}
```

```sh
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" http://127.0.0.1:4310/api/gaming/status
```

Collector-only `POST /internal/presence` uses the **different COLLECTOR_TOKEN** and body `{connected: boolean, activities: [...]}`. Activity input is the limited discord.js shape: `name`, numeric `type`, `applicationId`, `timestamps.start` in milliseconds, `assets.largeImage`. Max 32 KiB / 20 activities. Unknown/malformed input returns 400/413; invalid auth returns 401; unknown routes 404. There is **no demo mutation endpoint**. Never send the collector token to the browser.

The collector forwards relevant observations and a 30-second snapshot heartbeat while Gateway is ready. API expires after 90 seconds without delivery. Disconnect immediately hides active presence, preserves last observations and leaves end times null. Reconnect reuses an uncertain session only with the same application/name and Discord start timestamp; absent timestamps cannot prove continuity. API restart marks active rows uncertain. All real device/store classifications default to Unknown; RetroArch/LaunchBox names infer only category, not ROM/game/device. Extend `src/activity.js` or add evidence-bearing source adapters later.

## Deploy on an always-on host

GitHub Pages/serverless functions alone are insufficient. Recommended: Linux VM with Docker Engine + Compose plugin, outbound HTTPS and Discord Gateway WebSocket access, persistent disk. The collector can also run on a Raspberry Pi/desktop using Node 24 and a process supervisor.

```sh
git clone https://github.com/thundercato/pixelpal-watch.git
cd pixelpal-watch
git switch feature/discord-gaming-monitor
cd apps/gaming-monitor
cp .env.example .env
# Set the two random secrets and three Discord settings as described above.
chmod 600 .env
docker compose up -d --build
docker compose logs --tail=50 api collector
```

Compose exposes only `127.0.0.1:4310`. Use an SSH tunnel for private desktop access:
```sh
ssh -L 4310:127.0.0.1:4310 your-user@your-server
```
Then open http://127.0.0.1:4310 locally. For mobile/cloud access, configure a domain's DNS A/AAAA record to the VM, allow 443 (and 80 for certificate issuance), install Caddy on the host and use this Caddyfile with your real domain:
```caddyfile
gaming.example.com {
    reverse_proxy 127.0.0.1:4310
}
```
Reload Caddy; open `https://gaming.example.com`. Keep port 4310 firewalled; prefer VPN-only access or an additional identity-aware proxy. No public deployment is created by this branch. A public shell exposes demo only; tokens are required for data. Avoid publishing any `.env`, DB or backups. Use the cloud host's secret manager or protected environment files.

For a separate collector host: run `npm ci --omit=dev`, configure only bot/user/guild/token variables plus `COLLECTOR_API_URL=https://gaming.example.com`, run `npm run collector` under a restart-capable supervisor. The API host needs only dashboard/collector tokens and DB path. Run exactly one collector. Stop the Compose collector first if relocating it.

SQLite is in the `gaming-data` named volume (local: `data/gaming.sqlite`). Back up with SQLite's backup command or stop the API before copying the full database; restore to the same volume/path with correct permissions. Do not use ephemeral/serverless filesystems or multiple API replicas. `docker compose down` preserves data; do not use `down -v` unless intentionally deleting history. No retention deletion policy is enabled yet.

## Verification

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm audit --omit=dev
```

Tests cover parsing, music exclusion, simultaneous games, repeats/switches/endings, gaps/reconnects, missing timestamps, Unknown/Quest classification, persistence, API/collector credential separation, demo isolation and responsive Chromium layouts (390×844, 820×1180, 1440×1000). Browser screenshots are generated in ignored `test-results/`. Viewport tests are not real iOS Safari device tests. Real authenticated Discord events and standalone Quest observations require user setup and remain untested. Discord CDN artwork is only used when an official numeric asset ID is available; external asset proxies and free-form presence details are omitted for privacy.
