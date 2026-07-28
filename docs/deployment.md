# Deployment

The only supported production runtime is a public Cloudflare Worker built with
OpenNext. The same `@opennextjs/cloudflare` adapter powers local production
preview, CI, and deployment. There is no Sites-managed or vinext publishing
path.

## Prerequisites

- Node.js 22.13.0 or newer.
- npm with the committed `package-lock.json`.
- A Cloudflare account with Workers and Workers AI enabled.
- For CI publishing, `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` GitHub environment secrets.
- Optional: a Turnstile widget and a KV namespace for distributed rate
  limiting.

Authoritative runtime references:

- [OpenNext for Cloudflare: Get started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext for Cloudflare: CLI](https://opennext.js.org/cloudflare/cli)
- [Cloudflare: Deploy a Next.js app](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env.local
```

`AI_MODE=mock` is the safe local default. It exercises request validation,
retrieval, source validation, Server-Sent Event streaming, and the UI without a
Workers AI request.

Use OpenNext for a production-shaped local run:

```bash
npm run preview
```

The preview command builds `.open-next/` and starts the generated Worker through
Wrangler. On Windows, use WSL if the OpenNext toolchain encounters
platform-specific process or symlink behavior.

## Runtime configuration

`open-next.config.ts` defines the Cloudflare adapter. `wrangler.jsonc` points at
the generated `.open-next/worker.js`, serves `.open-next/assets`, declares the
Workers AI binding as `AI`, and enables the compatibility flags required by
OpenNext.

Both `.open-next/` and `.next/` are derived output. Never edit or deploy them by
hand.

### Public variables

| Name                             | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | Canonical public origin used for metadata and deployment smoke |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional public Turnstile widget key                           |

### Server variables

| Name                            | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `AI_MODE`                       | `cloudflare`, `mock`, or `retrieval-only`                                |
| `AI_MODEL_PRIMARY`              | Primary Workers AI model                                                 |
| `AI_MODEL_ECONOMY`              | Optional economy model                                                   |
| `AI_MODEL_CHALLENGER`           | Evaluation-only challenger model                                         |
| `ENABLE_ECONOMY_ROUTING`        | Explicit opt-in for the economy route                                    |
| `MAX_SESSION_GENERATED_ANSWERS` | Bounded session answer allowance                                         |
| `MAX_QUESTION_CHARACTERS`       | Server-side question limit; production is configured to `700` characters |
| `TURNSTILE_SECRET_KEY`          | Server-only Turnstile verification secret                                |

The committed Worker configuration uses GLM 4.7 Flash as the primary model,
keeps Granite economy routing disabled by default, and reserves Qwen as an
evaluation challenger. Do not send normal visitor traffic to the challenger.

## Complete validation

Run these commands before publishing:

```bash
npm ci
npm run build:corpus
npm run format:check
npm run lint
npm run typecheck
npm test
npm run verify:content
npm run verify:links
npm run build:worker
npm run test:e2e
npm run test:a11y
npm run eval:chat
```

Chromium is the required CI browser because it is the verified Workers-runtime
gate on the supported runner. Run the unscoped `npm run test:e2e` command for
the extended Firefox and WebKit matrix where those engines complete reliably;
do not treat a stalled or unavailable engine as a passing result.
The one-pixel artifact detector runs in CI on Linux. The full-page screenshot
comparison is intentionally tied to its committed Windows baseline so
platform-specific font rasterization does not create a false release failure.

After `build:corpus`, the committed `generated/` directory must have no
unexpected diff. The corpus gate is a security boundary: it rejects stale
artifacts, unknown or excluded sources, duplicate evidence, broken internal
links, missing profile/theme coverage, and mandatory retrieval regressions.

## Cloudflare resources

### Workers AI

The application accesses the binding as `env.AI`. Workers AI bindings do not
use a provider API key in application code. Local configuration defaults to
mock mode, so credential-free development does not require a Cloudflare login.

### Optional KV rate limiting

Create a namespace and bind it as `RATE_LIMIT_KV`:

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
npm run cf:typegen
```

The binding name must remain `RATE_LIMIT_KV`. Without it, request and session
counters are non-durable and local to one Worker isolate. They reset on
eviction, restart, or deploy and are not coordinated across isolates or points
of presence.

### Optional Turnstile

Set the public widget key at build time:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
```

Store the secret only in the Worker:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Provision the secret before exposing the public site key. The application
requires the key and secret as a pair: `/api/health` becomes degraded and
generated chat fails closed if only one is present.

Never prefix the secret with `NEXT_PUBLIC_`. The chat route must validate every
submitted token through Cloudflare Siteverify; rendering a widget without
server verification is not protection. Tokens expire and are single-use, so a
failed or replayed token requires a fresh challenge.

Set a separate server-only salt for rate-limit identifiers:

```bash
npx wrangler secret put RATE_LIMIT_SALT
```

`RATE_LIMIT_SALT` must be high entropy, must not be prefixed with `NEXT_PUBLIC_`,
and must not be reused as an application credential. Credential-free local
development may use the documented non-secret fallback namespace, but
production should configure the secret.

For CI, configure `NEXT_PUBLIC_SITE_URL` and
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` as GitHub production environment variables.
Configure the API token and account ID as secrets.

## Deployment

Authenticate once for local deployments:

```bash
npx wrangler login
npx wrangler whoami
```

Then validate, build, and deploy:

```bash
npm ci
npm run deploy
```

`npm run deploy` builds with OpenNext and deploys the generated Worker while
retaining separately configured Cloudflare variables and secrets. Do not
replace it with a second ad hoc Wrangler or framework deployment path.

The Worker is intended to be reachable directly on its public `workers.dev`
origin. Ensure `workers_dev` remains enabled and Cloudflare Access does not
intercept the public visitor routes. See
[Workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It
installs the locked tree and Playwright browsers, rebuilds the corpus, rejects
an uncommitted generated diff, verifies content and links, builds the OpenNext
Worker, and runs browser tests against the Worker preview runtime.

`.github/workflows/deploy.yml` runs only after a successful `CI` workflow on
`main`, or by manual dispatch. It checks out the verified revision and invokes
`npm run deploy` with the protected environment credentials. When the public
Turnstile key is nonempty, a preflight lists only the configured Worker secret
names and refuses to build unless `TURNSTILE_SECRET_KEY` is already present.
The deployment job remains skipped until `NEXT_PUBLIC_SITE_URL` is configured,
so a newly created repository cannot publish to an unintended account.

Create a protected GitHub environment named `production` and add:

| Kind     | Name                             | Purpose                         |
| -------- | -------------------------------- | ------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`           | Worker deployment authorization |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`          | Target Cloudflare account       |
| Secret   | `TURNSTILE_SECRET_KEY`           | Pre-provisioned Worker secret   |
| Variable | `NEXT_PUBLIC_SITE_URL`           | Canonical production URL        |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Turnstile widget key     |

Use a narrowly scoped deployment token and protect the environment with branch
and reviewer rules appropriate to the repository.

## Anonymous production smoke

Deployment is complete only after the workflow checks the public origin without
an authenticated browser session. It requests `/`, `/portfolio`, and
`/api/health`.

The health response must report `status: "ok"`, `chatConfigured: true`,
`turnstilePairingOk: true`, `aiMode: "cloudflare"`, 34 indexed project records
(29 verified and 5 pending), at least 60 knowledge chunks, a profile source, a
corpus version, a non-stale snapshot, and passing mandatory retrieval checks.
The deployment workflow then submits a non-canonical production question and
verifies the SSE metadata, Workers AI response mode, source list, text deltas,
single completion event, and absence of a fallback event.
Finally, confirm manually that every displayed source opens, an out-of-scope
question abstains, and no Cloudflare Access
login page appears.

## Rollback

Use the Cloudflare Workers deployment/version rollback controls to restore the
last healthy version, then repair and publish a new immutable deployment.
Content regressions should revert the manual source and corresponding generated
artifacts together.

Never patch `.open-next/`, `.next/`, or the deployed bundle directly.

## Troubleshooting

- **OpenNext output is missing:** run `npm run build:worker`, not `next build`
  alone.
- **Preview has no AI binding:** use mock/retrieval-only mode locally or provide
  an explicit Wrangler remote-binding setup.
- **Health says chat is unconfigured:** check `AI_MODE`, the `AI` binding, and
  the configured primary model.
- **Smoke receives HTML instead of JSON:** check the public URL, redirects, and
  whether Cloudflare Access is intercepting `/api/health`.
- **Corpus diff appears in CI:** run `npm run build:corpus`, inspect the complete
  generated diff, and commit it with the authority change.
