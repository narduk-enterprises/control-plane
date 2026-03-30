# Provisioning Flow

End-to-end pipeline from a provisioning request to a live, deployed app.

Three phases, each running in a different environment:

| Phase                     | Where                                                     | Trigger                                                      |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| **A - Control Plane API** | Cloudflare Worker (edge)                                  | `POST /api/fleet/provision`                                  |
| **B - GitHub Actions**    | `provision-app.yml` on `narduk-enterprises/control-plane` | Dispatched from Phase A                                      |
| **C - Local / Developer** | Developer machine                                         | After clone: `doppler run -- pnpm dev`; ship via `pnpm ship` |

---

## Phase A — Control plane (edge)

The API **only**:

1. Upserts `fleet_apps` and persists the incoming long agent brief
2. Allocates `NUXT_PORT`
3. Inserts `provision_jobs` (`pending` → `creating_repo` → `dispatching` or
   `failed`)
4. Persists the GitHub and Forgejo repo slugs plus `repoPrimary='github'`
5. Creates the **empty** GitHub repo under the target org
   (`POST /orgs/{org}/repos`)
6. Dispatches `provision-app.yml` with `workflow_dispatch` inputs (including
   `provision-id`, `app-short-description`, and `app-description`)

**Not** done on the edge: Cloudflare D1 for the **new app**, Doppler spoke
project, GitHub repo secrets on the **new** repo, Forgejo repo creation, GitHub
→ Forgejo mirroring, GA4/GSC/IndexNow, hydration, or deploy. Those run in Phase
B.

### Repository already exists (HTTP 422)

If the repo name already exists on GitHub, Phase A marks the job **failed** and
returns **409**. No workflow is dispatched (avoiding a duplicate run against an
unknown repo state).

**Recovery:** In the control plane UI, use **Retry** on that job. Retry
**re-dispatches** the workflow only; it does not call `POST /orgs/.../repos`
again. Use this when the repo is empty or acceptable to overwrite with
`git push --force` from the pipeline. Otherwise delete the repo or pick a
different app name and start a new provision.

---

## Full flow (sequence)

```mermaid
sequenceDiagram
    actor Dev as Developer or Agent
    participant CP as Control Plane API
    participant D1 as Fleet Registry D1
    participant GH as GitHub API
    participant FJ as Forgejo API
    participant GHA as GitHub Actions
    participant CF as Cloudflare API
    participant Dopp as Doppler API
    participant App as New App Worker

    Dev->>CP: POST /api/fleet/provision (name, displayName, shortDescription, description, url)
    CP->>CP: assertProvisionApiKey()

    CP->>D1: upsert fleet_apps, allocateFleetNuxtPort()
    CP->>D1: insert provision_jobs (pending)
    CP->>D1: status creating_repo
    CP->>GH: POST /orgs/{org}/repos (bare repo)
    alt repo exists (422)
      CP->>D1: status failed + errorMessage
      CP-->>Dev: 409 — Retry or rename
    else repo created
      CP->>D1: status dispatching
      CP->>GHA: workflow_dispatch provision-app.yml
      CP-->>Dev: 200 + provisionId
    end

    Note over GHA: Phase B — runner (control-plane checkout + template export)

    GHA->>CP: callbacks: status / log (best-effort warnings if unreachable)
    GHA->>GHA: export:starter → app-source, install deps
    GHA->>CF: 1-create-d1.ts (app D1)
    GHA->>Dopp: 2-create-doppler.ts, prd/dev/prd_copilot, tokens
    GHA->>GH: 3-set-github-secrets.ts (new repo)
    GHA->>GH: sync:copilot-secrets (env copilot)
    GHA->>FJ: ensure repo exists, create if missing
    GHA->>FJ: mirror GitHub refs into Forgejo
    GHA->>GHA: 4-create-analytics, hydrate provision.json + SPEC.md, push, build, wrangler deploy
    GHA->>CP: POST .../complete (strict — fails step if CP unreachable)

    App-->>Dev: App live at production URL
```

---

## After provisioning (local dev)

There is no `tools/init.ts` and no `pnpm run setup` for infra. A provisioned
repo already has `.setup-complete`, `doppler.yaml`, and wrangler wired by the
pipeline. It should also already contain `provision.json`, a draft `SPEC.md`,
and a populated GitHub Actions environment `copilot` for GitHub Agentic
Workflows. Clone the new repo, run `pnpm install`,
`doppler setup --project <app> --config dev`, then `doppler run -- pnpm dev`.
See `docs/provisioning-pipeline.md`.

---

## Ship Flow (`pnpm ship`)

```mermaid
flowchart LR
    A([pnpm ship web]) --> B["Step 1\ndoppler run -- pnpm build"]
    B -- fail --> BAIL1([Abort: broken build])
    B -- ok --> C["Step 2\ngit add + commit + fetch\ngit push"]
    C -- diverged --> BAIL2([Abort: remote ahead])
    C -- ok --> D{db:migrate script?}
    D -- yes --> E["Step 3\ndb:migrate --remote\nD1 migrations on prod"]
    D -- no --> F
    E --> F["Step 4\ndoppler run -- pnpm deploy\nwrangler deploy to edge"]
    F -- fail --> BAIL3([Abort])
    F -- ok --> G["Step 5\nPUT /api/fleet/apps/{name}\nFleet Registry sync"]
    G --> DONE([Shipped])

    style BAIL1 fill:#922,color:#fff
    style BAIL2 fill:#922,color:#fff
    style BAIL3 fill:#922,color:#fff
    style DONE fill:#1a6b35,color:#fff
```

---

## Secret Flow

```mermaid
graph TB
    HUB["Hub Project\nnarduk-nuxt-template / prd\nCLOUDFLARE_API_TOKEN\nCLOUDFLARE_ACCOUNT_ID\nCONTROL_PLANE_API_KEY\nPOSTHOG / GA / GSC / APPLE / CSP"]

    PRD["Spoke Project\napp-name / prd\ncross-project refs to hub\nAPP_NAME, SITE_URL\nCRON_SECRET, NUXT_SESSION_PASSWORD\nPACKAGE_REGISTRY_PROVIDER\nFLEET_FORGEJO_BASE_URL\nFLEET_FORGEJO_OWNER\nFORGEJO_TOKEN\nGA_PROPERTY_ID, GA_MEASUREMENT_ID\nINDEXNOW_KEY"]
    COP["Spoke Project\napp-name / prd_copilot\nminimal agent-only secrets\nPACKAGE_REGISTRY_PROVIDER\nFLEET_FORGEJO_BASE_URL\nFLEET_FORGEJO_OWNER\nGITHUB_TOKEN_PACKAGES_READ\nFORGEJO_TOKEN\nNODE_AUTH_TOKEN\noptional CLOUDFLARE_*"]

    DEV["Spoke Project\napp-name / dev\ncross-project refs to hub\nSITE_URL = localhost:PORT\nNUXT_PORT = random allocated\nCRON_SECRET, NUXT_SESSION_PASSWORD\nPACKAGE_REGISTRY_PROVIDER\nFLEET_FORGEJO_BASE_URL\nFLEET_FORGEJO_OWNER\nFORGEJO_TOKEN"]

    GHSEC["GitHub Repo Secrets\norg/app-name\nDOPPLER_TOKEN (ci-deploy token)\nGH_PACKAGES_TOKEN\nFORGEJO_TOKEN\nCONTROL_PLANE_URL"]
    GHENV["GitHub Actions env\norg/app-name / copilot\nPACKAGE_REGISTRY_PROVIDER\nFLEET_FORGEJO_BASE_URL\nFLEET_FORGEJO_OWNER\nGH_TOKEN_PACKAGES_READ\nFORGEJO_TOKEN\nNODE_AUTH_TOKEN\noptional CLOUDFLARE_*"]

    HUB -->|syncHubSecrets| PRD
    HUB -->|syncDevConfig| DEV
    PRD -->|ci-deploy service token| GHSEC
    COP -->|sync:copilot-secrets| GHENV
```

## Operator Runbook

Operators should start with the local [operator runbook](./operator-runbook.md),
then use the template runbook at
[docs/agents/operations.md](https://github.com/narduk-enterprises/narduk-nuxt-template/blob/main/docs/agents/operations.md)
for the downstream repo behavior, especially:

- the provision payload `shortDescription` + long `description`
- the GitHub Actions environment `copilot`
- `pnpm run sync:copilot-secrets`

For long-term drift control in the control plane, use the scheduled/manual
workflow
[`.github/workflows/sync-copilot-secrets.yml`](../.github/workflows/sync-copilot-secrets.yml).
