# n8n-nodes-skodeflow

An [n8n](https://n8n.io) community node for **[Skode Flow](https://skode.ai)**. Send WhatsApp,
Instagram and Facebook messages, manage contacts, and start workflows on inbox events.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) ·
[Trigger](#trigger) · [Development](#development) · [Publishing](#publishing)

## Installation

Follow the n8n [community node installation](https://docs.n8n.io/integrations/community-nodes/installation/)
guide. In n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-skodeflow`.

## Credentials

This node signs in through **Skode's central identity provider** (`auth.skode.ai`) — the same
account you use for Skode Flow, CRM and Forms. There is no API key to copy.

**One-time, Skode admin:** register an OAuth application for n8n and note the **client ID** and
**client secret**. Add n8n's redirect URL to the application's allowed redirect URIs:

- n8n Cloud: `https://oauth.n8n.cloud/oauth2/callback`
- self-hosted: `https://<your-n8n-host>/rest/oauth2-credential/callback`

**In n8n**, create a *Skode Flow OAuth2 API* credential:

| Field | Value |
| --- | --- |
| Flow API Base URL | your Flow API origin, e.g. `https://flowserver.skode.ai` (no trailing slash) |
| Identity Provider URL | `https://auth.skode.ai` — change only for a self-hosted identity server |
| Client ID | from the OAuth application |
| Client Secret | from the OAuth application |

Authorize (`/o/authorize/`) and token (`/o/token/`) URLs are derived from the identity provider
URL. Click **Connect** and approve.

> **Why two URLs?** Unlike the Skode CRM node, Flow's identity and its API live on different
> hosts: you sign in at `auth.skode.ai` and call `flowserver.skode.ai`. The grant uses **PKCE**,
> which `auth.skode.ai` requires — a plain authorization-code grant is rejected at the token step,
> *after* you have already approved, which looks like an unexplained failure at the end.

This node uses Flow's **partner integration API** (`/api/partner/v1/…`) — a surface shared by
automation platforms, separate from the Zapier one, with its own rate limits and its own
attribution. Your n8n traffic is reported as n8n, not as Zapier.

## Operations

**Message**

- **Send** — `POST /api/partner/v1/messages/send/`. A free-form message on WhatsApp, Instagram or
  Facebook. Outside the 24-hour customer service window this is refused by design; send a template
  instead. A refusal is a successful guard, not a bug.
- **Send Template** — `POST /api/partner/v1/templates/send/`. An approved template, with ordered
  variables for its `{{1}}`, `{{2}}` placeholders. Works outside the service window.

**Contact**

- **Create or Update** — `POST /api/partner/v1/contacts/`. Keyed on phone number: an existing
  contact is updated rather than duplicated.
- **Search** — `GET /api/partner/v1/contacts/search/?phone=…` or `?email=…`. Returns
  `{ found, contact }` — check `found` rather than assuming a list.

## Trigger

**Skode Flow Trigger** starts a workflow on an inbox event: message received, conversation
created, conversation reopened, or SLA breached.

It registers n8n's webhook URL with Flow (`POST /api/partner/v1/hooks/`) when the workflow is
activated and removes it on deactivate — no polling. Flow signs every delivery with a secret
issued at subscription time, so a leaked webhook URL alone is not enough to forge events at it.

## Development

```bash
npm install --ignore-scripts   # see the note below
npm run build
npm run lint                   # the ruleset n8n verification actually runs
```

`--ignore-scripts` is load-bearing, not a speed tweak: `n8n-workflow` pulls in `isolated-vm`, a
native addon that fails to build in a clean CI container.

Lint with `@n8n/node-cli` (`npm run lint`), **not** `eslint-plugin-n8n-nodes-base` directly. The
two rulesets contradict each other on at least one rule — `n8n-nodes-base` wants the string
literal `'main'` for inputs/outputs, while `@n8n/eslint-plugin-community-nodes`, which is what
verification runs, requires `NodeConnectionTypes.Main` and fails the build otherwise.

## Publishing

Verified nodes **must** be published from CI with an npm provenance statement — not from a
laptop. `.github/workflows/publish.yml` does exactly that, triggered by a version tag:

```bash
npm version patch && git push --follow-tags
```

One-time setup: add an npm **Automation** token as the `NPM_TOKEN` repository secret, and make
sure the npm account's 2FA is set to "auth only" so CI can publish.

After publishing, verify with the exact scanner the Creator Portal runs:

```bash
npx @n8n/scan-community-package 'n8n-nodes-skodeflow'
```

It checks provenance, fetches the matching source from GitHub, and analyses the published
tarball. It reads from the npm registry, so it can only run **after** a publish — a local `.tgz`
returns a 404. Submit for verification once it reports all checks passed.

## License

MIT
