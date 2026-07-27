# Deployment

The production runtime is the bundled vinext/Vite Cloudflare Worker starter.
It produces Cloudflare Worker-compatible ES modules while preserving the App
Router development model. Do not add OpenNext packages or
`@opennextjs/cloudflare` configuration.

There are two supported publishing paths:

- **Sites-managed publishing** for the connected Codex Sites project.
- **Direct Cloudflare Workers publishing** through `wrangler.jsonc` and the
  included GitHub Actions workflow.

Both paths begin with the same locked install and vinext build.

## Prerequisites

- Node.js 22.13.0 or newer.
- npm with the committed `package-lock.json`.
- For direct publishing, a Cloudflare account with Workers AI enabled.
- For CI publishing, `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` GitHub environment secrets.
- Optional: a Turnstile widget and a KV namespace for distributed rate
  limiting.

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

`CHAT_MOCK_MODE=true` is the safe local default. It exercises the request,
retrieval, source, and UI contracts without making Workers AI requests.

Run a production-like local build with:

```bash
npm run build
npm run start
```

Or use the repository's production-style preview shortcut:

```bash
npm run preview
```

## Complete validation

Run these commands before publishing:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run verify:content
npm run verify:links
npm run build
npm run test:e2e
npm run test:a11y
npm run eval:chat
npm run verify
```

`verify:content` is a security boundary, not a cosmetic check. It must fail when
the generated corpus is stale, an excluded name leaks into indexed content, an
unknown repository appears, or required provenance is missing.

## Cloudflare resources

### Workers AI

`wrangler.jsonc` declares:

```jsonc
"ai": {
  "binding": "AI",
  "remote": false
}
```

The application accesses the binding as `env.AI`. Workers AI bindings do not
use a provider API key in application code. Local configuration keeps remote
AI access disabled and defaults to mock mode, so credential-free development
does not require a Cloudflare login. The named production environment switches
mock mode off.

### Optional KV rate limiting

Create a namespace:

```bash
npx wrangler kv namespace create RATE_LIMIT_KV --env production
```

Copy the returned namespace ID into the commented `kv_namespaces` block in
`wrangler.jsonc`, uncomment the block, then refresh binding types:

```bash
npx wrangler types cloudflare-env.d.ts --include-runtime false
```

The binding name must remain `RATE_LIMIT_KV`. Without it, rate limiting is
best-effort per Worker isolate and is not a globally consistent quota.

### Optional Turnstile

Set the public widget key at build time:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
```

Store the secret only in the Worker:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Never prefix the secret with `NEXT_PUBLIC_`. The chat route must validate every
submitted token through Cloudflare Siteverify; rendering a widget without
server verification is not protection. Tokens expire and are single-use, so a
failed or replayed token requires a fresh challenge.

Set a separate server-only salt for rate-limit identifiers:

```bash
npx wrangler secret put IP_HASH_SALT --env production
```

`IP_HASH_SALT` must be high entropy, must not be prefixed with `NEXT_PUBLIC_`,
and must not be reused as an application credential. Credential-free local
development may use the documented non-secret fallback namespace, but
production should configure the secret.

For CI, configure `NEXT_PUBLIC_SITE_URL` and
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` as GitHub production environment variables.
Configure the API token and account ID as secrets.

## Sites-managed publishing

`.openai/hosting.json` is the source of truth for the connected Sites project
ID and any Sites-managed D1 or R2 declarations. Do not copy Worker secrets into
that file. Sites packages the validated vinext output, saves an immutable
version, and deploys that version.

The expected deployment artifact contains:

- `dist/server/index.js`;
- emitted static assets;
- `.openai/hosting.json`;
- generated migration files only when a managed database schema exists.

Build before handing the source to Sites:

```bash
npm ci
npm run verify:content
npm run build
```

Runtime values are configured through the Sites project rather than committed
to source control.

## Direct Wrangler publishing

Authenticate once for local deployments:

```bash
npx wrangler login
npx wrangler whoami
```

Then validate, build, and deploy:

```bash
npm ci
npm run verify:content
npm run build
npx wrangler deploy --env production
```

The package shortcuts keep preview and deployment behavior versioned:

```bash
npm run preview
npm run deploy
```

`wrangler.jsonc` points to `worker/index.ts`, binds `dist/client` as `ASSETS`,
and deploys an ES module Worker. The named production environment changes
`CHAT_MOCK_MODE` from the credential-free local default to live mode.
`npx vinext deploy --env production` is also available as a vinext-managed
build-and-deploy command, but maintainers should use one path consistently so
CI and local releases exercise the same configuration.

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It calls
the repository scripts for formatting, linting, type checking, tests, content
verification, build, and end-to-end validation.

`.github/workflows/deploy.yml` runs only after a successful `CI` workflow on
`main`, or by manual dispatch. It checks out the verified revision, rebuilds
it, and publishes through `cloudflare/wrangler-action`.

Create a protected GitHub environment named `production` and add:

| Kind     | Name                             | Purpose                         |
| -------- | -------------------------------- | ------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`           | Worker deployment authorization |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`          | Target Cloudflare account       |
| Variable | `NEXT_PUBLIC_SITE_URL`           | Canonical production URL        |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Turnstile widget key     |

Use a narrowly scoped deployment token and protect the environment with branch
and reviewer rules appropriate to the repository.

## Rollback

- Sites: redeploy a previously saved site version.
- Direct Workers: use Cloudflare deployment/version rollback, then investigate
  the failing source revision.
- Content-only regression: revert the generated content and its approved source
  change together, rerun every validation gate, and publish a new immutable
  version.

Do not edit `dist/` to patch production. It is derived output and will be
replaced by the next build.

## Operational checks

After deployment, verify:

1. home, project index, representative project detail, research, and privacy
   routes return successfully;
2. static assets and metadata resolve from the production origin;
3. mock mode is disabled in production unless the release intentionally
   advertises a demo response;
4. live chat returns bounded grounded answers with working source links;
5. excluded-project and unsupported-fact probes abstain;
6. Turnstile and rate limiting behave as configured;
7. no secret or internal filesystem path appears in responses or logs.
