# Pankit Brahmkhatri — research guide

An evidence-grounded portfolio and research guide for agent memory, retrieval,
verification, test-time learning, search-guided reasoning, and reliable
tool-using systems.

The site combines a browsable catalogue of 29 verified public repositories,
five carefully bounded title-only shortlist entries, editorial research
context, and a grounded chat. Repository facts come from an explicit allowlist
and approved sources. The chat returns traceable source cards, preserves
limitations, and falls back or abstains when the indexed evidence is
insufficient.

![Portfolio social preview](public/og.png)

## What is included

- Chat-first home route, portfolio, catalogue, project detail, writing, privacy,
  sitemap, robots, and RSS routes.
- Curated project categories, rankings, aliases, status, connections, and
  related work.
- Five editorial MDX sources covering profile, overview, themes, project map,
  and site scope.
- Deterministic build-time corpus, provenance manifest, search index, and
  mandatory retrieval checks.
- Grounded chat with mock, retrieval-only, and Cloudflare Workers AI modes.
- Optional Turnstile verification and optional KV-backed distributed rate
  limiting.
- Light and dark themes, keyboard-complete interactions, accessible streaming
  states, and device-local conversation history.
- Formatting, policy, test, OpenNext build, browser, and anonymous-deployment
  gates.

The exact repository boundary is documented in
[docs/project-content-matrix.md](docs/project-content-matrix.md).

## Runtime

The application uses Next.js App Router and the current
`@opennextjs/cloudflare` adapter. A regular `next build` is transformed into
`.open-next/worker.js` and `.open-next/assets`, then previewed or deployed with
the adapter CLI on Cloudflare Workers.

Server code uses the Next.js Node.js runtime. Cloudflare bindings are exposed
through `getCloudflareContext()`; live chat calls the `AI` Workers AI binding.
The production route is the public `workers.dev` deployment declared in
`wrangler.jsonc`. There is no parallel Sites or vinext publishing path.

See [docs/architecture.md](docs/architecture.md) for the request and build-time
data flows.

## Prerequisites

- Node.js 22.13.0 or newer.
- npm and the committed lockfile.
- No provider credential for local mock mode.
- A Cloudflare account with Workers AI for live chat or deployment.
- Linux, macOS, or WSL for the most reliable OpenNext production build. CI
  builds on Ubuntu.

## Quick start

```bash
npm ci
cp .env.example .env.local
npm run build:corpus
npm run dev
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
npm run build:corpus
npm run dev
```

The environment template uses deterministic local chat:

```dotenv
AI_MODE=mock
```

Mock mode exercises input validation, retrieval, sources, fallback metadata,
streaming, and the chat UI without calling Workers AI.

## Environment and bindings

| Name                             | Visibility          | Required             | Purpose                                                        |
| -------------------------------- | ------------------- | -------------------- | -------------------------------------------------------------- |
| `AI_MODE`                        | Server              | Yes                  | `mock`, `retrieval-only`, or `cloudflare`                      |
| `AI`                             | Worker binding      | Cloudflare mode      | Workers AI inference                                           |
| `AI_MODEL_PRIMARY`               | Server              | Cloudflare mode      | Primary grounded-answer model                                  |
| `AI_MODEL_ECONOMY`               | Server              | Optional             | Lower-cost route when economy routing is enabled               |
| `AI_MODEL_CHALLENGER`            | Evaluation only     | Optional             | Challenger model for explicit evaluations                      |
| `ENABLE_ECONOMY_ROUTING`         | Server              | No                   | Enables the bounded economy-routing policy                     |
| `MAX_SESSION_GENERATED_ANSWERS`  | Server              | Yes                  | Per-browser-session generated-answer budget                    |
| `MAX_QUESTION_CHARACTERS`        | Server              | Yes                  | Server question-length ceiling                                 |
| `RATE_LIMIT_KV`                  | Worker binding      | No                   | Shared abuse-throttle counters across Worker isolates          |
| `RATE_LIMIT_SALT`                | Server secret       | Production           | Separates one-way rate-limit keys from raw network identifiers |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public client value | No                   | Renders the optional Turnstile widget                          |
| `TURNSTILE_SECRET_KEY`           | Server secret       | Paired with site key | Validates Turnstile tokens through Siteverify                  |
| `NEXT_PUBLIC_SITE_URL`           | Public build value  | Production           | Canonical origin for metadata, links, and smoke checks         |
| `GITHUB_USERNAME`                | Build input         | Metadata refresh     | Account whose exact allowlist members may be refreshed         |
| `GITHUB_TOKEN`                   | Build secret        | Optional             | Raises GitHub API limits during an approved metadata refresh   |

Optional contact and profile-link values are documented in `.env.example`.
Never place a secret in a `NEXT_PUBLIC_` variable. Live chat uses a Workers AI
binding and does not require an application-owned provider API key.

## Commands

| Command                  | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run dev`            | Start the Next.js development server                                |
| `npm run build`          | Create the standard Next.js production build                        |
| `npm run start`          | Run that Next.js build locally                                      |
| `npm run build:worker`   | Build Next.js and transform it into an OpenNext Worker              |
| `npm run preview`        | Build and preview the app in the local Workers runtime              |
| `npm run deploy`         | Build and deploy through the OpenNext CLI                           |
| `npm run cf:typegen`     | Regenerate Cloudflare binding types                                 |
| `npm run build:corpus`   | Rebuild and validate the canonical grounded corpus                  |
| `npm run sync:github`    | Refresh trusted metadata for exact allowlist members                |
| `npm run build:index`    | Run the canonical corpus/index builder                              |
| `npm run verify:content` | Enforce allowlist, exclusion, provenance, and generated-data policy |
| `npm run verify:links`   | Validate approved internal and public link shapes                   |
| `npm test`               | Run unit, integration, and component suites                         |
| `npm run test:e2e`       | Exercise routes and chat against an OpenNext preview                |
| `npm run test:a11y`      | Run automated accessibility checks                                  |
| `npm run eval:chat`      | Run the versioned grounded-chat evaluation set                      |
| `npm run verify`         | Run the aggregate release verification                              |

## Content model

Curated authority lives in `data/` and `content/`:

- `data/projects.ts`
- `data/ranked-projects.ts`
- `data/project-allowlist.ts`
- `data/project-exclusions.ts`
- `data/content-exclusions.ts`
- `data/project-aliases.ts`
- `content/profile.mdx`
- `content/research-overview.mdx`
- `content/research-themes.mdx`
- `content/project-map.mdx`
- `content/site-scope.mdx`

Derived artifacts live under `generated/`. The canonical corpus builder owns
`knowledge-chunks.json`, `source-manifest.json`, `search-index.json`, and
`corpus-version.json`. GitHub metadata and image provenance are separate
generated inputs.

Source precedence is:

1. manual records, editorial MDX, and exclusions;
2. approved allowlisted README or documentation text;
3. trusted GitHub repository metadata;
4. omission, grounded fallback, or abstention.

The builder enforces the exact 29-project allowlist, four explicit exclusions,
unique chunks, registered source IDs, minimum profile/theme coverage, at least
60 knowledge chunks, and mandatory retrieval probes. Sibling repositories are
read as text sources only; their code is never executed.

See [docs/content-editing.md](docs/content-editing.md) before changing project
copy or the corpus.

## Chat contract

The browser sends a question and at most six recent history items to
`POST /api/chat`. Questions are limited to 700 characters. Retrieval selects
four to six unique approved sources and the response streams typed
Server-Sent Events:

```text
metadata
fallback        # only when a fallback is used
source-list
text-delta      # zero or more
completion
```

Stream-safe terminal failures may emit `error`. Metadata exposes only
non-secret mode, intent, and fallback information.

In Cloudflare mode, the route consumes the actual Workers AI token stream but
does not forward raw model tokens. It buffers through an approved
`[source:SOURCE_ID]`, validates that factual segment against the retrieved
source list and exclusion policy, and only then emits a `text-delta`. An
invalid or uncited segment switches to the labeled retrieval-only fallback.
The UI renders approved markers as numbered inline links associated with the
corresponding source cards.

`GET /api/health` reports deployment readiness, corpus counts and version,
snapshot age, model configuration, Turnstile key/secret pairing, and mandatory
retrieval-check status without exposing bindings or secrets.

Conversation history stays in the browser and can be cleared. Live questions
and selected evidence are processed by the Worker and Workers AI. The
application does not require a portfolio-owned conversation database.

See [docs/chat-grounding.md](docs/chat-grounding.md) and
[docs/chat-evaluation.md](docs/chat-evaluation.md).

## Cloudflare setup

Authenticate for an intentional local deployment:

```bash
npx wrangler login
npx wrangler whoami
npm run cf:typegen
npm run build:worker
npm run preview
npm run deploy
```

Use the OpenNext deployment script rather than calling `wrangler deploy`
directly. The adapter build produces and prepares the Worker artifact before it
delegates deployment to Wrangler.

Optional production secrets are set on the top-level Worker:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RATE_LIMIT_SALT
```

Provision `TURNSTILE_SECRET_KEY` before building with
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`; the health check degrades and generated chat
fails closed when only one side of the pair is configured. Never place the
secret in a `NEXT_PUBLIC_` value.

The GitHub production environment requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets plus the canonical `NEXT_PUBLIC_SITE_URL`
variable. The deploy workflow performs unauthenticated smoke requests, so a
Cloudflare Access login page or disabled `workers.dev` route fails the release.
See [docs/deployment.md](docs/deployment.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Project content matrix](docs/project-content-matrix.md)
- [Chat grounding](docs/chat-grounding.md)
- [Design system](docs/design-system.md)
- [Content editing](docs/content-editing.md)
- [Deployment](docs/deployment.md)
- [Chat evaluation](docs/chat-evaluation.md)

## Privacy and security summary

- Hard allowlist and explicit exclusions constrain both display and retrieval.
- Secrets are server-only; source cards never reveal local paths.
- Retrieved repository prose is evidence, never instructions.
- Turnstile is effective only when its token is verified server-side.
- KV-backed limiting is optional. Without KV, request and session counters are
  non-durable, isolate-local, reset on eviction/restart/deploy, and are not
  coordinated across isolates or points of presence.
- Unsupported facts, missing sources, and out-of-scope questions produce a
  grounded fallback or abstention instead of a guessed answer.

See the application privacy route and architecture document for the full
operational boundary.

## License

The portfolio application is available under the [MIT License](LICENSE).
Content imported or summarized from sibling repositories remains subject to
the license and claim boundaries of its source repository.
