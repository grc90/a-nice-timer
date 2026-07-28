# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5177 (strictPort: fails if busy, by design)
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
npm run preview    # serve dist/
```

There is no test runner, linter, or formatter configured. `npm run typecheck` is the only automated check — TypeScript runs with `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedIndexedAccess`, so it catches a lot.

`README.md` is stale on the dev port: it says 5173 in two places, but [vite.config.ts](vite.config.ts) pins **5177** with `strictPort`. The port is fixed (not auto-incremented) because Google OAuth validates the return URL against an exact-match allowlist in Supabase; a silently shifted port breaks login with an unrelated-looking error. Note the second stale mention ([README.md:309](README.md#L309)) is the *setup instruction* for that very allowlist — following it literally allowlists the wrong port and produces exactly the failure the pin exists to prevent. Allowlist `http://localhost:5177`.

Imports use the `@/` alias for `src/` (declared in both `vite.config.ts` and `tsconfig.app.json`).

## Language convention

All code comments, UI copy, and docs are in **Spanish (rioplatense)**. Comments are unusually dense and explain *why* a decision was made, not what the code does. Match that: when changing code with a design rationale in its comment, update the rationale too — several invariants live only in comments.

## Architecture

A React 19 + Zustand + Tailwind v4 SPA. No backend of its own: static files plus Supabase.

### The timer stores an absolute deadline, not a countdown

`timerStore` holds **`endsAt`** (epoch ms) and derives the remaining time as `endsAt - Date.now()`. Exactly one of `endsAt` / `remainingMs` is the source of truth depending on status: running → `endsAt`; paused/idle → `remainingMs` (pausing freezes it and nulls `endsAt`). This is load-bearing for drift-free ticking, throttled-tab survival, reload reconstruction (`reconcileAfterReload`), and shared rooms. Do not introduce a decrementing counter anywhere.

Consequence encoded in [timerStore.ts:15](src/store/timerStore.ts#L15): if a phase expires with more than `LIVE_OVERSHOOT_MS` (30 s) of overshoot, the Pomodoro deliberately does **not** auto-chain — it marks the session `interrupted` instead, because chaining would log focus time nobody worked.

`interrupted` is set from three places, all applying that same "was anyone actually there?" test: `tick()` on a stale expiry, and `reconcileAfterReload` both for a session that expired while the tab was closed and for a pause older than 10 minutes measured against `lastInteractionAt` (which is why `lastInteractionAt` is persisted — without it a long pause silently resumes as if the user never left).

### Two clocks

`useTimerEngine` ticks the store every 200 ms (enough for `mm:ss`) and resyncs on `visibilitychange` / `focus` / `pageshow`. Animated skins use `useSmoothClock`, a `requestAnimationFrame` loop over `endsAt` with local state, so 60 fps animation never re-renders the app.

### Stores (Zustand + `persist`)

`timerStore` (`ant:timer`, partialized), `settingsStore` (`ant:settings`), `presetsStore` (`ant:presets`), `audioStore` (`ant:audio`), `statsStore` (`ant:stats`), `roomStore` (`ant:room`), `authStore` (Supabase-managed), `uiStore` (not persisted).

Split by write frequency — runtime changes 5×/s and must not rewrite presets on every tick. `lastEvent` is excluded from `timerStore` persistence on purpose: rehydrating it would fire a stale alarm on app open.

### Event flow for phase completion

`timerStore.tick()` sets `lastEvent` (with a monotonic `id` serial). `useTimerEngine` watches it, guards against re-handling via `handledEventId`, then records stats **first and unconditionally** before alarm/notification — the history must not depend on the user having sound enabled. Manual stop/reset also emits an event (`partialFocusEvent`) when ≥1 min of focus elapsed.

### Stats: two storage layers, local day keys

**The unit of record is the focus block, not the session** — a four-cycle Pomodoro leaves four rows. Every entry is atomic; there is no "in progress" row to update later, so an abandoned session keeps whatever was actually worked.

Two layers, and the split is deliberate: raw `records` are pruned at `MAX_RECORDS` (2000, ~6 months of detail) while the `daily` rollup (~40 bytes/day) is **never** pruned. Chart and streak stay exact forever; the only thing time erodes is the per-preset breakdown of six months ago. Don't "simplify" by deriving the rollup from records — that silently caps history at 2000 blocks.

Day keys come from `dayKey()` in [src/utils/time.ts](src/utils/time.ts), built from local date parts. **Never `toISOString()`** for a day bucket: a 22 h session belongs to that day for the user, and UTC would split late nights across two days.

`computeStreak` counts from *yesterday* when today has no focus yet — breaking a streak at 00:01 for not having started is the classic bug here. `activeToday` is what distinguishes "alive but not yet extended" from "already extended".

### Keyboard shortcuts and the Esc stack

`SHORTCUTS` in [src/hooks/useKeyboardShortcuts.ts](src/hooks/useKeyboardShortcuts.ts) is the single source of truth: it carries `keys` (matched `event.key` values), `display` (glyphs for the help panel), `label`, and `group`. `ShortcutsHelp` renders from it, so adding a shortcut is one array entry plus a handler — never hardcode a key in a component.

Handlers are held in a ref so the listener registers **once**; binding them directly would remount the listener 5×/s as the timer ticks. Shortcuts yield to text fields (`isTypingTarget`), timer shortcuts are suppressed while a modal is open, and `Esc` unwinds exactly one layer per press: modal → audio panel → focus mode.

### Singleton hooks mount once, at the root

[src/App.tsx](src/App.tsx) is where `useTheme`, `useTimerEngine`, `useDocumentTitle`, `useAmbientSync`, `useAuthListener`, `useCloudSync`, `useWakeLock`, and `useKeyboardShortcuts` are mounted — each exactly once. They are app-wide engines, not reusable component behavior; a second mount means two tick loops or two debounced pushers. `useAuthListener` is the one that starts the Supabase session listener, so nothing auth-related works if it is dropped. `useWakeLock(keepAwake && status === 'running')` keeps the screen alive during a session (mobile blanks at ~30 s); the API is absent in Firefox and old Safari and fails silently on purpose.

The three clock/room hooks are deliberately *not* in that list: `useSmoothClock` is per-skin (in `TimerStage`), `useRoomHost` lives in `ShareDialog` so the host channel only exists while sharing is on, and `useRemoteClock` is mounted by `RoomViewer` in the guest tree. Hoisting any of them to the root would open a channel or an rAF loop for users who never asked for one.

### Skins

`SkinProps` in [src/skins/types.ts](src/skins/types.ts) gives skins `{ progress, remainingMs, totalMs, phase, status, reducedMotion }` and **no store access**. Structural guarantee: a skin cannot mutate a running session. This is also what lets the read-only room viewer render the host's skin from computed props.

Adding a skin: component satisfying `SkinProps` + id in `SkinId` + entry in [src/skins/registry.ts](src/skins/registry.ts). Nothing else changes.

### Theming

All color is semantic CSS variables in [src/themes/theme.css](src/themes/theme.css) under `[data-palette="X"][data-theme="Y"]` selectors, bridged to Tailwind via `@theme inline` in [src/index.css](src/index.css) (`bg-surface`, `text-ink`, `border-line`, `text-accent`, …). **No component contains a literal color for UI chrome.** Values are oklch so hue rotation preserves perceived lightness across palettes.

There are exactly two families of deliberate exception, and they are not cleanup targets: the Google mark in `AuthPanel` (brand colors are prescribed, not themed) and the representational skins — `MoonSkin`'s sky/moon and `HourglassSkin`'s glass highlights depict physical objects whose color is the content, not the theme. A palette-driven moon would just be a colored disc.

Adding a palette: a block in `theme.css`, an entry in `palettes.ts`, the id in `PaletteId`. An inline script in `index.html` applies the saved theme before first paint — it has to stay inline (an external file would load too late and the wrong-theme flash comes back), and it has to stay comment-free: Vite does not minify `index.html`, so anything written there ships verbatim in the served HTML.

### index.html

Deliberately comment-free, for the reason above. Two things there are easy to "clean up" by mistake:

- `<link rel="icon" href="/favicon.svg">` — the file already existed in `public/` and the notification icon uses it, but without this `<link>` the browser never requested it for the tab.
- `data-theme` / `data-palette` on `<html>` — defaults for a first visit, before the inline script has anything in `ant:settings` to read.

### Aurora background

Pure CSS in `index.css`, mounted once by `AuroraBackground`. It must run 90 minutes without heating the machine, so: **only `transform` and `opacity` are animated**, no `filter: blur()`, `contain: layout paint style`. Cycle durations are coprime (19/23/29/31/37 s) so the combined pattern never visibly loops. `.aurora__band` is explicitly excluded from the global `prefers-reduced-motion` reset — its motion is an app setting, not a system inheritance (see the comment at [index.css:96](src/index.css#L96)). With motion off, a hand-authored static composition applies; don't remove it, the bands stack unattractively at rest position.

### Audio

One shared `AudioContext` ([src/audio/context.ts](src/audio/context.ts)) for alarms and ambient — browsers cap contexts per page and the user-gesture unlock applies to the whole context. `unlockAudio()` is called on start clicks. Alarms are synthesized (no assets to go missing); ambient are real field recordings in `public/ambient/` (attributions in `ATTRIBUTION.md`) except white noise, which stays synthesized.

The `.m4a` files are build output, not hand-edited assets. `tools/build-ambient.sh` downloads the Wikimedia originals (not in the repo), trims, loudness-matches, seam-hides the loop via `tools/loopify.mjs`, and encodes to AAC; it needs `ffmpeg` and `node` on PATH. It **prints the `loopStart`/`loopEnd` values that `src/audio/ambient.ts` hardcodes**, so regenerating audio without copying those numbers over gives you an audible click at every loop point. Both scripts carry long comments defending numbers that look arbitrary (the 0.6 sample ceiling, constant-power crossfade curves, the guard regions that absorb AAC decoder padding) — read them before retuning. Ambient channels are **unmounted** at zero volume rather than left silent; decoded `AudioBuffer`s are cached.

`useAmbientSync` is the only bridge between the declarative store (a mix is an object of volumes) and the imperative engine — it uses one `subscribe` rather than an effect per channel. No component may call `ambientEngine` directly; that is how the UI and the actual sound stay in agreement. YouTube uses the IFrame API loaded on demand, mounted into a hand-created node outside the React tree (YouTube *replaces* the element it receives, which would break React's unmount).

### Routing and the guest room view

[src/main.tsx](src/main.tsx) does the routing — a query-param check, no router library. `roomIdFromUrl()` picks between `<App>` and `<RoomViewer>`, both lazy. Keeping this choice outside `App` is what makes the viewer read-only *by construction*: the spectator tree never mounts the timer engine, cloud sync, or audio. If you add a shared component, check it doesn't drag `ant:*` storage or the audio engine into the RoomViewer chunk.

### Cloud sync (Supabase)

**localStorage is the running app's source of truth; Supabase is a mirror.** Guest mode is a real feature, not a degraded state — the app never waits on the network.

Conflict resolution is per-entity ([src/sync/syncEngine.ts](src/sync/syncEngine.ts)):

| Entity | Rule |
|---|---|
| Presets, audio favorites | last-write-wins by `updatedAt`; deletes travel as tombstones |
| Focus records | append-only ⇒ union by id, conflict impossible |
| Daily totals | not synced — recomputed server-side by the `daily_focus_totals` SQL function |
| Settings and goals | remote wins if it exists; otherwise local is uploaded (guest migration) |

`runFullSync` pulls before pushing — that order matters, pushing first would overwrite remote before comparing. `useCloudSync` subscribes to each syncable store and debounces uploads (2.5 s) via `schedulePush`, plus a final push on tab hide.

**Pulling writes into stores that `useCloudSync` is subscribed to, so every pull can echo back as a push.** That is why `applySettingsPayload` does one partial `setState` instead of calling fourteen setters — fourteen notifications would schedule fourteen pushes. Any new pull path must write in one batch.

Two horizons that look like an inconsistency but aren't: raw `focus_records` are pulled and pushed for the last **180 days** only, while `daily_focus_totals` is asked for **400** (`HISTORY_DAYS`). The rollup is cheap and carries the long history; the per-record detail is not, and nothing in the UI reads records older than six months. Also, `applyRemoteTotals` **replaces** each day rather than adding to it — the server already sums every record, so accumulating would double the day's focus on every sync.

Deletes write `deleted_at`, never remove rows. `updated_at` is set by a server trigger, not the client, because a skewed browser clock would decide LWW conflicts wrong.

The SDK is dynamically imported in [src/lib/supabase.ts](src/lib/supabase.ts) and the promise is cached — guest mode must never pull `@supabase/supabase-js` into the entry chunk. Use `isCloudConfigured` (a plain env check) for "is cloud available", and `await getSupabase()` only where the client is actually needed.

### Shared rooms (body doubling)

Host publishes only on structural transitions (phase, status, `endsAt`, duration, skin) — never per second. Guests receive absolute `endsAt` and run their own clock, so a dead channel doesn't freeze the display. Three mechanisms, each covering a different gap: Realtime broadcast (instant updates), a table snapshot read on join (late arrivals), and 25 s polling (silently dropped WebSockets).

Privacy is enforced in the schema: `rooms` is **not** readable by `anon`. Reads go through `get_shared_room`, a `security definer` function returning hand-enumerated columns and never the owner's `user_id` — RLS cannot filter by column. The room id *is* the invite token (uuid v4). Invite links are built from `window.location.origin`, so a link generated on localhost only works on that machine — expected, not a bug.

## Supabase setup

`.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (both public by design — RLS is what protects data; never put the service_role key here). Without them the app runs in permanent guest mode. Run [supabase/schema.sql](supabase/schema.sql) whole in the SQL Editor; it is idempotent. Vite inlines these at build time, so they must exist in the deploy environment (Vercel dashboard), not just locally.

The `revoke execute` lines near the bottom of the schema need **both** the `public` and the `anon` revoke, and dropping either is a silent regression. Postgres grants EXECUTE to `PUBLIC` on every new function, *and* Supabase's `alter default privileges` on schema `public` grants it to `anon` directly — revoking only `PUBLIC` leaves the direct grant standing and the function stays callable without an account (verified against the live project: it still returned 200). Because `create or replace` preserves the replaced function's privileges, re-running the file does not clean this up on its own; `anon` has to be named.

Under *Authentication → URL Configuration*: **Site URL** is the production domain, and **Redirect URLs** must list `https://your-domain/**` **without removing** the localhost entry — dropping it breaks dev login. Google Cloud needs no changes when you deploy: the redirect URI registered there points at Supabase's callback, not at your domain, and Supabase redirects onward.

## Deploying

Static SPA + Supabase. [vercel.json](vercel.json) has SPA rewrite, cache headers, and security headers. HTTPS is required, not optional — notifications, Wake Lock, and clipboard all silently break over plain HTTP (localhost is exempt).

`public/ambient/*.m4a` get their own cache rule and **cannot be `immutable`**: files in `public/` are unhashed, so a content change would keep serving stale audio forever. They use one week of hard cache plus a month of stale-while-revalidate. If you regenerate them, rename them or wait out the week. (`vercel.json` can't hold comments, which is why this lives in README/CLAUDE.)
