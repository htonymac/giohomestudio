# BIG PROBLEM ANDIO FIX — Time Bombs + Solutions

**Purpose:** every architectural / scale / cost / security / legal time bomb in Andio with a junior-dev explanation, why it's dangerous, and exactly how to fix it. Write this once, never debug it during incident response.

**Read order if you're new to Andio:**
1. `ANDIO_MUST_READ.md` (index)
2. This file (BIG_PROBLEM_ANDIO_FIX.md) — the strategic risks
3. `update/PROBLEM_AND_FIX.md` — the tactical bugs we've already fixed

---

## How to read this doc

Each section follows this pattern:

```
## N. <Problem name>
**Junior dev explanation:** plain English, no jargon
**Why it's a time bomb:** what makes this dangerous specifically
**What happens if you don't fix it:** the worst-case story
**How to fix it:** concrete steps
**Code pattern:** skeleton you can copy
**Verification:** how to know it's actually fixed
**Prevention rule:** how to never let it come back
```

---

## 1. NO MULTI-TENANCY (no `tenant_id` in DB tables)

**Junior dev explanation:**
Right now Andio's database stores every user's data in the same tables without marking who owns what. It's like a school where every student's homework goes into one big drawer with NO name on it. The teacher hopes she remembers whose is whose. When 2 students are in the drawer, fine. When 200 students share the drawer, one of them will hand back the wrong homework eventually, and parents will sue.

**Why it's a time bomb:**
- `hybrid_saved_states` table has only `localId` (project ID) — no `user_id`, no `org_id`, no `tenant_id`
- Every API route relies on the application code remembering "WHERE localId = X" — a single forgotten WHERE clause leaks all users' projects to the requestor
- AI-generated code commonly forgets these clauses

**What happens if you don't fix it:**
Day 100 after launch: a teacher hits a bug where the project list shows another teacher's "Sex Ed for Year 8" video. Screenshot goes viral. Refunds, lawsuits, AI-tool trust gone. Recovery cost ≫ what fixing it now costs.

**How to fix it:**
1. Add migration: `ALTER TABLE hybrid_saved_states ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'henry'`
2. Backfill all existing rows with `tenant_id = 'henry'`
3. Add `tenant_id` to every other user-data table (`assemblies`, `characters`, `audio_plans`, anything user-created)
4. Update all read/write API routes to filter by tenant_id
5. Add Row-Level Security (RLS) policy in Postgres (see Problem #2)
6. Tenant ID is set from the JWT / session cookie on every request

**Code pattern:**

```sql
-- migration
ALTER TABLE hybrid_saved_states ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'henry';
ALTER TABLE hybrid_saved_states ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX idx_hybrid_saved_states_tenant ON hybrid_saved_states(tenant_id);
```

```ts
// every API route gets a getTenantId(req) helper
function getTenantId(req: NextRequest): string {
  const cookie = req.cookies.get("andio_tenant");
  if (!cookie?.value) throw new Error("no tenant — unauthenticated");
  return cookie.value;
}

// every query filters
const rows = await prisma.$queryRaw`
  SELECT data FROM hybrid_saved_states
  WHERE tenant_id = ${getTenantId(req)} AND "localId" = ${localId}
`;
```

**Verification:** Manually create 2 test accounts. Project list of A must never show project of B.

**Prevention rule:** Every new table user data goes into MUST have `tenant_id NOT NULL`. Code reviewer must check this for every PR adding a table.

---

## 2. NO ROW-LEVEL SECURITY (RLS) in Postgres

**Junior dev explanation:**
The application code is currently the ONLY thing protecting one user's data from another user. If a bug accidentally writes `WHERE 1=1` (or just forgets the `WHERE tenant_id=…` line), every row in the table comes back. Postgres lets you turn on a feature called Row-Level Security where the database itself enforces "you can only see your own rows" — even if the app code forgets. RLS is like a second guard at the door. App code is the first guard. If the first guard falls asleep, the second guard still works.

**Why it's a time bomb:**
- App code is one missed condition away from leaking
- AI tools generate forgotten WHERE clauses commonly
- Without RLS, a single bad commit = data breach

**What happens if you don't fix it:**
Same as #1: data leak. RLS makes it impossible even on a code mistake.

**How to fix it:**
1. After adding `tenant_id` to tables (#1), enable RLS:
   ```sql
   ALTER TABLE hybrid_saved_states ENABLE ROW LEVEL SECURITY;
   ALTER TABLE hybrid_saved_states FORCE ROW LEVEL SECURITY;
   ```
2. Create policies that check `tenant_id` against the session setting:
   ```sql
   CREATE POLICY tenant_isolation_select ON hybrid_saved_states
     FOR SELECT
     USING (tenant_id = current_setting('app.tenant_id', true));

   CREATE POLICY tenant_isolation_modify ON hybrid_saved_states
     FOR ALL
     USING (tenant_id = current_setting('app.tenant_id', true))
     WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
   ```
3. Wrap every DB request in a transaction that sets the tenant:
   ```ts
   await prisma.$transaction(async (tx) => {
     await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
     // your queries
   });
   ```

**Verification:** Try a query without setting `app.tenant_id` — must return zero rows. Try setting wrong tenant — must return zero rows.

**Prevention rule:** Every new user-data table MUST have RLS enabled the same migration that creates it.

---

## 3. FILES OVER 4,000 LINES (Turbopack chunk bomb)

**Junior dev explanation:**
Andio's children-planner is 8,359 lines in one file. Next.js 16 uses Turbopack to compile your code into "chunks" the browser downloads. When a file is too big, Turbopack sometimes refuses to serve one of those chunks (404). We hit this bug already and had to switch from `next start` (production build) to `next dev` (development build) as a temporary workaround. Dev build is slower, single-process, and cannot handle real traffic. So those big files are blocking us from ever running real production.

**Why it's a time bomb:**
- `next dev` won't survive 100 concurrent users — single process compile-on-demand
- Splitting later is harder (state hooks intertwined)
- Each new feature added to children-planner makes the bomb bigger

**What happens if you don't fix it:**
You post Andio's launch video. 3,000 teachers click. Server gets 3,000 chunk-recompile requests. CPU pins at 100%. Browser tabs show "Loading…" then white screen. Twitter laughs. You take it offline. Refund + rebuild trust = months.

**How to fix it:**
Refactor each >4K file into smaller modules. Target ≤1,500 lines each.
- `children-planner/page.tsx` (8,359) → split into:
  - `page.tsx` (main shell, ~500 lines)
  - `components/StoryTab.tsx`
  - `components/SceneBoard.tsx`
  - `components/AssemblyTab.tsx`
  - `components/CharacterPanel.tsx`
  - `components/PacingEngine.tsx`
  - `hooks/useChildrenProject.ts`
  - `hooks/useAssembleMovie.ts`
  - `hooks/useImageGen.ts`
- Move state to a Zustand store or React Context so children share without prop-drilling
- Test by running `next build` — must succeed and the chunk error must not return

**Code pattern:**

```ts
// hooks/useChildrenProject.ts
import { create } from "zustand";
export const useChildrenProject = create<State>((set) => ({
  projectTitle: "",
  childScenes: [],
  // ...
  setProjectTitle: (v) => set({ projectTitle: v }),
  // ...
}));
```

**Verification:** `npm run build` (Turbopack) succeeds; `npm run start` runs without 404 on any chunk URL when the page loads.

**Prevention rule:** Hard CI gate — fail PR if any TSX file exceeds 1,500 lines.

---

## 4. SINGLE LINUX VPS, NO QUEUE LAYER

**Junior dev explanation:**
Right now Andio is one Linux box (Contabo, 8 CPU / 23GB RAM) doing EVERYTHING: web server, narration generation, image generation, video assembly, database. When 5 teachers click "Assemble" at the same moment, 5 ffmpeg processes spawn and fight for the same CPU + RAM. None of them finish in reasonable time. When 20 hit it: server falls over.

A "queue" is a waiting line. Job comes in, gets added to the queue, a worker picks the next job when it has capacity. Even if 100 jobs come at once, the worker processes them at a sustainable pace. No crash.

**Why it's a time bomb:**
- 3-5 concurrent assemblies = safe today. Henry's launch target = 20+
- One bad job (we already hit 70-segment beat-flood) DoS'd the whole platform
- No horizontal scaling — can't add servers because there's no queue dispatcher

**What happens if you don't fix it:**
Demo day: presenter assembles a video live. 20 audience members try Andio. Server pegs. Presenter's video never renders. Demo dies. Launch postponed.

**How to fix it:**
1. **Install Redis** (one node, $5/mo on Upstash free tier covers it)
2. **Install BullMQ** (`npm i bullmq`)
3. **Refactor `/api/video/assemble-async`**: instead of spawning a detached worker, push the job to a BullMQ queue
4. **Run worker processes separately** (one or two dedicated VPSes / boxes — Contabo's $5/mo small instances work)
5. Worker pulls jobs from Redis, processes them, writes status back

**Code pattern:**

```ts
// lib/queue.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
const connection = new IORedis(process.env.REDIS_URL!);
export const assembleQueue = new Queue("assemble", { connection });

// in /api/video/assemble-async route
await assembleQueue.add("assemble", { jobId, body }, {
  attempts: 3, backoff: { type: "exponential", delay: 5000 },
});

// in worker/assemble-worker.mjs (runs on dedicated machine)
new Worker("assemble", async (job) => {
  // do the actual ffmpeg work, write status file
}, { connection, concurrency: 2 });
```

**Verification:** Submit 50 simultaneous assemble jobs from a test script. Queue absorbs them, worker processes them at 2-at-a-time. Web server stays responsive.

**Prevention rule:** Any long-running task (>5s) must go through the queue, not inline in an API route.

---

## 5. LLM COST RUNAWAY (no semantic cache, no model routing)

**Junior dev explanation:**
Every Andio story uses the LLM (GPT-4o-mini today) for: story expansion, character building, scene planning, narration plan, De-vocabularize, etc. Each call = ~3000 tokens. One story = ~7 LLM calls. 1000 teachers × 5 stories per day × 7 calls = **35,000 LLM calls per day**.

Without caching, every call costs money even when teacher #2 asks the same question teacher #1 asked yesterday. Without routing, every call uses the expensive model even for trivial tasks like rewriting "the cat is happy" for a 5-year-old.

Fix: cache by *meaning* (semantic), and route by *complexity* (use cheap model when adequate).

**Why it's a time bomb:**
- Without cache: $1.2K/month at GPT-4o-mini, $15K/month at GPT-4o for 1K teachers
- Without routing: same simple task hits same expensive model every time
- One viral spike (TikTok influencer mentions Andio) = $5K+ overnight surprise bill

**What happens if you don't fix it:**
You wake up to a $5K OpenAI bill. Refund request denied (OpenAI doesn't refund usage). Margin negative. Have to either: shut down free tier, raise prices fast, eat the loss. Trust hit either way.

**How to fix it:**

### 5a. Semantic cache
- Hash the *intent* of each query with an embedding (cheap — $0.0001/1K tokens)
- Store in Upstash Vector or pgvector
- Before hitting GPT-4o, check if a semantically similar query (>0.95 cosine similarity) was answered in last 24h
- Hit rate: 40-60% on typical apps = 40-60% fewer API calls

```ts
// lib/llm-cache.ts
import OpenAI from "openai";
import { upstashVector } from "@upstash/vector";
const v = upstashVector({ url: process.env.UPSTASH_VECTOR_URL!, token: process.env.UPSTASH_VECTOR_TOKEN! });

export async function llmWithCache(prompt: string, opts: LLMOpts) {
  const emb = await getEmbedding(prompt);
  const hits = await v.query({ vector: emb, topK: 1, includeMetadata: true });
  if (hits[0]?.score > 0.95 && hits[0].metadata.cachedAt > Date.now() - 86400000) {
    return hits[0].metadata.response as string;
  }
  const result = await openai.chat.completions.create({ ...opts, messages: [{ role: "user", content: prompt }] });
  await v.upsert({ id: hash(prompt), vector: emb, metadata: { response: result.choices[0].message.content, cachedAt: Date.now() } });
  return result.choices[0].message.content;
}
```

### 5b. Model routing
Classifier picks cheapest adequate model:
- ≤200 token simple prompts (De-vocabularize, character one-liner, format fix) → **Haiku 4.5** ($0.001/1K vs Opus $0.005/1K = 5× cheaper)
- 200-2000 token analysis / scene planning → **GPT-4o-mini**
- >2000 tokens complex story plan with characters + arcs → **Opus 4.7** / GPT-4o
- Estimated saving: 70% on bills

```ts
function routeModel(prompt: string): "haiku" | "gpt-4o-mini" | "opus" {
  const tokens = countTokens(prompt);
  const isCreative = /story|character|plot|scene description/i.test(prompt);
  if (tokens < 200) return "haiku";
  if (tokens < 2000 && !isCreative) return "gpt-4o-mini";
  return "opus";
}
```

### 5c. Hard budget cap
- Set daily / monthly budget envelope in `lib/llm.ts`
- Track spend in Redis (`HINCRBYFLOAT budget:today $cost`)
- When budget hit, return graceful error: "Daily AI quota reached, try again tomorrow"
- NEVER let runaway exceed budget — better to disappoint than bankrupt

**Verification:** Hit cache twice on identical prompts — second one returns in <50ms. Hit budget cap with mock spend — next call returns 429.

**Prevention rule:** Every external API call (LLM, image gen, TTS) must go through a cached + routed + budget-capped wrapper. No raw `openai.chat.completions.create()` direct calls.

---

## 6. API RATE LIMIT APOCALYPSE (Henry's specific concern)

**Junior dev explanation:**
"You built and it works perfectly in development. Deployed to production, and everything crashes. You just scored the API rate limit surprise." (Henry's quote)

Every external API has limits. FAL allows X requests/second. OpenAI allows Y/minute. ElevenLabs Z/minute. In dev you made 10 calls/min — no problem. Launch day: real users → 500 calls/min → API returns `429 Too Many Requests` → your code that assumes success crashes → users see errors.

Worse: you might blow through your monthly API budget in 6 hours of viral traffic. **AI-generated code almost never handles rate limits properly** — the code says `const result = await fetch(api)` and trusts it. When `429` returns, parse breaks.

**Why it's a time bomb:**
- Andio hits 4+ external APIs: FAL (images), OpenAI/Anthropic (LLM), Piper (local — safe), FAL Kokoro (TTS), Cloudflare Tunnel
- One spike = 429 wall = cascading failure across the platform
- Cost blow-out is faster than you can react

**What happens if you don't fix it:**
1. Henry posts the test video on Twitter
2. 500 people try Andio in the next hour
3. FAL returns 429 to half of them → image gen fails
4. OpenAI returns 429 on story expand → planners crash
5. Henry's FAL account hits monthly cap → automatic suspend
6. Andio is offline until next billing cycle
7. The 500 first impressions are all of a broken product

**How to fix it (8-part defense):**

### 6a. Exponential backoff with jitter on every external call
Don't retry immediately on 429. Wait, retry, wait longer, retry, give up.

```ts
async function callWithBackoff<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const is429 = e?.status === 429 || e?.message?.includes("429");
      const is5xx = e?.status >= 500;
      if (!is429 && !is5xx) throw e;
      const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 1000;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }
  }
  throw new Error("max retries exceeded");
}
```

### 6b. Per-API circuit breaker
After N 429s in a row, STOP hitting that API for a cooldown period. Don't keep retrying — you're making it worse and burning your retry budget.

```ts
// lib/circuit-breaker.ts
const breakers = new Map<string, { failures: number; openUntil: number }>();
export function withBreaker(api: string, fn: () => Promise<any>) {
  const b = breakers.get(api) || { failures: 0, openUntil: 0 };
  if (Date.now() < b.openUntil) {
    throw new Error(`${api} circuit open — try again in ${Math.ceil((b.openUntil - Date.now())/1000)}s`);
  }
  try {
    const r = await fn();
    b.failures = 0;
    breakers.set(api, b);
    return r;
  } catch (e) {
    b.failures++;
    if (b.failures >= 5) {
      b.openUntil = Date.now() + 60_000;
      b.failures = 0;
    }
    breakers.set(api, b);
    throw e;
  }
}
```

### 6c. Per-USER rate limit (so one viral user can't drain everyone's quota)
Track requests per user, deny when exceeded.

```ts
// middleware approach using Redis
const userKey = `rate:${tenantId}:${api}`;
const count = await redis.incr(userKey);
if (count === 1) await redis.expire(userKey, 60);
if (count > 30) {
  return NextResponse.json({ error: "Rate limit exceeded. Try again in 1 minute." }, { status: 429 });
}
```

### 6d. Daily spend cap (HARDEST stop)
- Each API call estimates its cost
- Add to today's spend in Redis
- When daily budget hit, REJECT new calls until next day
- Better to deny one user than bankrupt everyone

```ts
const todayKey = `spend:${tenantId}:${new Date().toISOString().slice(0,10)}`;
const spent = parseFloat(await redis.get(todayKey) || "0");
const DAILY_CAP = 5.00; // $5 / tenant / day during free tier
if (spent + estimatedCost > DAILY_CAP) {
  throw new Error("Daily AI quota reached for your account.");
}
await redis.incrbyfloat(todayKey, estimatedCost);
await redis.expire(todayKey, 86400);
```

### 6e. Request deduplication (same prompt within N seconds = one call)
If two users send the same image gen request seconds apart, only one call goes out — the other gets the cached result.

```ts
const inFlight = new Map<string, Promise<any>>();
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key)!;
  const p = fn().finally(() => setTimeout(() => inFlight.delete(key), 5000));
  inFlight.set(key, p);
  return p;
}
```

### 6f. Graceful degradation
When primary API quota is hit, fall back to a cheaper / slower alternative:
- FAL FLUX Schnell → Pruna → "Image queue full, try again in 2 min"
- OpenAI → Anthropic → Ollama (local)
- ElevenLabs → Piper (local — always available)

### 6g. Batch requests where possible
- Multiple image requests at once → use FAL batch endpoint (1 call instead of 10)
- Multiple LLM completions → use Anthropic's batch API (50% cheaper)

### 6h. Real-time cost dashboard
- `/dashboard/cost-monitor` showing live spend per tenant + global
- Alert when within 20% of any daily cap (so you can react before hit)
- Log every external API call with cost, latency, status

**Verification:**
- Send 100 requests/sec to your own API endpoint → middleware throttles to per-user limit
- Set daily cap to $0.10 → make calls until denied
- Disconnect FAL → image gen falls back to Pruna or fails cleanly with user message

**Prevention rule:**
NO raw `fetch(externalApi)` in the codebase. ALL external API calls must use a `callExternalApi(name, fn, options)` wrapper that has backoff + breaker + budget + dedupe baked in.

---

## 7. LEGAL TIME BOMB (no ToS / Privacy / DMCA / AI Policy)

**Junior dev explanation:**
The moment Andio has a user that isn't Henry, the legal world starts ticking. Posting AI-generated kids' content without legal documents in place exposes you to: child-data privacy laws (COPPA/GDPR), copyright (auto-generated images may look like Disney IP), defamation, and government AI regulations.

These docs are 80% template, 20% your specifics. You can have all 6 ready in 1-2 days with a lawyer template + a willingness to read.

**Why it's a time bomb:**
- COPPA fines: $50K **per violation** in US. One under-13 user with no consent = $50K.
- EU AI Act effective: undisclosed AI-generated content for educational use = €15M or 3% global revenue fine
- DMCA: must respond to takedown within 48 hours or you become liable for the content
- No ToS = no enforcement against any abusive user

**What happens if you don't fix it:**
A child uploads "Bryan kicks teacher" → AI generates a violent image → parent screenshots → reports to FTC → COPPA investigation → fine.

**How to fix it (6 documents you need):**

1. **Terms of Service** — what users can/can't do, your liability ceiling, dispute resolution
2. **Privacy Policy** — what data you collect, how long, who you share with, GDPR/CCPA rights
3. **AI Content Policy** — explicit disclosure that content is AI-generated, training data note, what is and isn't allowed
4. **DMCA / Takedown Policy** — designated agent email, takedown procedure, counter-notification process
5. **Acceptable Use Policy** — banned content (violence, sexual, hateful), enforcement
6. **COPPA Notice + Parental Consent Flow** — only required if any user can be <13. If yes, you need a parent verifies email step.

**Code pattern:** Termly.io / iubenda.com auto-generate these for $10/mo. Pay it. Don't lawyer up for v1.

**Verification:** Each doc linked from your footer + signup page. Acceptance checkbox on signup logged with timestamp + version hash.

**Prevention rule:** No new feature ships without legal-impact review. New feature touches user data? Update Privacy Policy. New feature lets users publish content? Update AUP.

---

## 8. NO CDN FOR VIDEO OUTPUT — every viewer downloads from your VPS

**Junior dev explanation:**
When a teacher finishes a video, the MP4 file sits on your Linux server. When they share it with 30 students, each student's browser downloads the FULL 100MB file from your server. 30 × 100MB = 3GB out of your VPS bandwidth in 5 minutes. Your VPS has limited bandwidth (Contabo ~32TB/month). One viral video = bandwidth cap = server suspended.

A CDN (Cloudflare R2 + CF CDN) puts your file on 200+ edge servers worldwide. Students download from the nearest one, not from your VPS.

**Why it's a time bomb:**
- VPS bandwidth cap = service degradation when most needed
- VPS disk fills with old videos (66-102MB each)
- No geographic optimization

**What happens if you don't fix it:**
Henry's launch video → 500 people click → 50GB out → Contabo throttles you → next 1000 visitors see slow loads → reputation damage.

**How to fix it:**
1. Sign up for Cloudflare R2 (free tier covers 10GB)
2. Upload assembled videos there on render-complete
3. Return CDN URL instead of `/api/media/...`
4. Old videos stay accessible; new ones go to R2

```ts
// in worker after successful assembly
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_KEY!, secretAccessKey: process.env.R2_SECRET! },
});
await r2.send(new PutObjectCommand({
  Bucket: "andio-videos",
  Key: `${tenantId}/${jobId}.mp4`,
  Body: fs.createReadStream(localPath),
}));
const cdnUrl = `https://videos.andio.com/${tenantId}/${jobId}.mp4`;
```

**Verification:** Render video. Open the URL in incognito from 3 different IPs (use VPN). Should hit edge cache after first request.

**Prevention rule:** No user-facing assets served from VPS disk. Everything CDN-backed.

---

## 9. NO COST MONITORING / NO BUDGET ALERTS

**Junior dev explanation:**
You don't know what you're spending until the bill comes. By then it's too late. You need a real-time dashboard showing today's spend + alerts when approaching caps.

**Fix:**
Create `/dashboard/cost-monitor` (admin only). Track every external API call's cost. Sum daily + monthly. Alert via Telegram when 50% / 75% / 90% / 100% of cap hit. Pause new requests at 100%.

**Code skeleton:**

```ts
// lib/cost-tracker.ts
import { redis } from "@/lib/redis";

const COSTS = {
  "fal_flux_schnell": 0.003,
  "fal_flux_pro": 0.04,
  "openai_gpt_4o_mini": 0.000015 * 3000, // per 3K-token average
  "openai_gpt_4o": 0.0025 * 3000,
  "claude_haiku": 0.001 * 3000,
  "anthropic_opus": 0.005 * 3000,
} as const;

export async function trackCost(api: keyof typeof COSTS, tenantId: string) {
  const cost = COSTS[api];
  const today = new Date().toISOString().slice(0, 10);
  await redis.incrbyfloat(`spend:total:${today}`, cost);
  await redis.incrbyfloat(`spend:tenant:${tenantId}:${today}`, cost);
  // monthly
  const month = today.slice(0, 7);
  await redis.incrbyfloat(`spend:total:${month}`, cost);
}
```

---

## 10. NO AUDIT LOG

**Junior dev explanation:**
When something goes wrong (user complains "my project was deleted!" or a security incident), you need to know WHO did WHAT WHEN. Without logs, the answer is "we don't know" — which is the worst possible answer in front of a judge or angry customer.

**Fix:**
- Append-only `audit_log` table
- Every state-changing operation writes one row
- Include `tenant_id`, `actor`, `action`, `target_id`, `timestamp`, `before` (JSON), `after` (JSON)
- Never delete rows from this table
- Index on `tenant_id + timestamp` for fast per-tenant queries

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);
```

---

## 11. SHARED ACCESS CODE — single point of compromise

**Junior dev explanation:**
Today everyone uses `andio-preview-2026`. If any teacher screenshots it, the world has admin access to Andio. There's no way to revoke just one user. There's no way to know who did what.

**Fix:**
- Switch to per-user accounts (email + password OR Google OAuth)
- Each user gets a session token derived from their user_id
- Cookies carry user_id, not the shared code
- Audit log (#10) tracks who did what
- Revoke = delete user, no global rotation needed

**Quick interim:** allow per-user invite codes. Each invite is single-use. Track which invite was used by whom.

---

## 12. NO GEOGRAPHIC ROUTING / READ REPLICAS

**Junior dev explanation:**
Andio's only server is in Europe (Contabo Germany). A US user waits 130ms for every API call. An Asian user waits 250ms. Database queries cross the ocean. The fix is read replicas in each region + geographic routing.

This is a "Phase 2" thing — don't do it before Problem #1-7. But know it exists.

**Fix (later):**
- Read-replica Postgres in US + EU + Asia
- Cloudflare Workers or Vercel Edge route reads to nearest replica
- Writes still go to primary (replicated to others within seconds)
- 100ms latency drops to 10ms for users near their replica

---

## 13. AI / EMBEDDING CACHE for repeated story expansions

**Junior dev explanation:**
Teachers will create similar stories: "story about counting apples", "story about counting oranges". The LLM expansion + character build steps will be very similar. Caching the embeddings of these prompts and reusing answers when similarity > 95% saves 40-60% of LLM calls.

**Fix:** Already covered in Problem #5a (semantic cache).

---

## 14. STORYBOARD / IMAGE CACHE

**Junior dev explanation:**
Image gen is the second-biggest cost driver. If multiple teachers ask for "happy red apple, children's book illustration", we should serve the same generated image. Hash the prompt + style + seed; cache by hash; serve from cache when same params requested.

**Fix:** Image cache table:

```sql
CREATE TABLE image_cache (
  prompt_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  hits INT DEFAULT 0
);
```

Before calling FAL, check this table. If hit, return URL + increment hits.

---

## 15. NO COMPONENT-LEVEL TESTS

**Junior dev explanation:**
Today every change to children-planner is "click around and hope." We've shipped 70+ commits to a 8K-line file without unit tests. Eventually something will silently break and we won't notice until a user complains.

**Fix (gradual):**
- Add Playwright tests for the critical flows: new project → generate scenes → assemble → output
- Add unit tests for `pickPiperVoice`, `extractSceneAction`, slot-builder logic
- Run on every PR

---

## 16. NO STAGING ENVIRONMENT

**Junior dev explanation:**
Every change goes straight to production. We tag stable points but if a change breaks something, users see it before we do.

**Fix:**
- Spin up second Contabo VPS (~$5/mo)
- Auto-deploy `main` branch to staging
- Manual promote staging → production after manual smoke test

---

## EXECUTION PLAN (ordered by impact ÷ effort)

| Order | Action | File ref | Effort | Why first |
|---|---|---|---|---|
| 1 | Write the 6 legal docs (Termly template) | Problem #7 | 1-2 days | Lawsuit time bomb is fastest to fire |
| 2 | Add `tenant_id` to every user-data table | Problem #1 | 1-2 days | Irreversible if skipped; required for multi-user |
| 3 | Enable RLS + per-row policies | Problem #2 | 1 day | Defense in depth for #1 |
| 4 | Rate-limit + circuit-breaker + budget cap wrappers | Problem #6 | 2 days | Stops cost runaway before it starts |
| 5 | Semantic cache + model routing for LLM | Problem #5 | 2 days | Cuts bill 70% |
| 6 | Split `children-planner.tsx` into modules | Problem #3 | 2-3 days | Unblocks production build |
| 7 | Redis + BullMQ queue + worker isolation | Problem #4 | 3-5 days | Required for >10 concurrent users |
| 8 | R2 + CDN for assembled videos | Problem #8 | 1-2 days | Bandwidth relief |
| 9 | Cost monitoring dashboard | Problem #9 | 1 day | Visibility |
| 10 | Audit log table + middleware | Problem #10 | 1 day | Legal defense |
| 11 | Per-user accounts | Problem #11 | 3-5 days | After #2 RLS lands |
| 12 | Image cache | Problem #14 | 1 day | More cost savings |
| 13 | Test suite (gradual) | Problem #15 | ongoing | Quality |
| 14 | Staging environment | Problem #16 | 1 day | Velocity |
| 15 | Read replicas + geo routing | Problem #12 | 1 week | Phase 2 — only after first 1K users |

**Phase 1 = items 1-5.** Must land before any public Andio post.
**Phase 2 = items 6-10.** Must land before 100 concurrent users.
**Phase 3 = items 11-15.** Before 1K paying users.

---

## Junior-dev triggers (when to read which section)

| When you're about to… | Read Problem # |
|---|---|
| Add a new database table | #1, #2, #10 |
| Add a new external API call (OpenAI, FAL, etc.) | #5, #6, #9 |
| Add a new TSX file | #3 |
| Add a long-running task | #4 |
| Add a user-facing asset | #8 |
| Launch publicly | #7 |
| Refactor children-planner | #3 |

---

**Maintenance:** When a Time Bomb is fixed, mark it `✅ FIXED <commit-hash>` at the top of its section and move it to an "Already Defused" appendix at the bottom. Don't delete it — future devs need the history.

**Linked back from:** `ANDIO_MUST_READ.md` §2 (tough recurring bugs)
