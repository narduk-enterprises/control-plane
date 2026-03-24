# Provisioning Pipeline

End-to-end flow from browser form submission to a live deployed app.

**Single supported path:** New fleet apps are created only via the **control
plane** (`POST /api/fleet/provision` or the admin UI), which dispatches
**`narduk-enterprises/control-plane`** `.github/workflows/provision-app.yml`.
The read-only template repo **does not** ship a `provision-app.yml` workflow and
**does not** run `tools/init.ts` (removed). `tools/provision/*.ts` plus
`5-hydrate-repo.ts` perform setup on the runner; the hydrate step writes
`.setup-complete`, `provision.json`, and a draft `SPEC.md` so downstream agents
start from persisted product context instead of guessing scope.

## Pipeline Overview

```mermaid
sequenceDiagram
    actor User as Developer / Browser
    participant UI as provision.vue
    participant Proxy as POST /provision-ui
    participant API as POST /provision
    participant D1 as Fleet D1 Database
    participant GH as GitHub API
    participant GHA as GitHub Actions

    User->>UI: Fill form (name, displayName, description, url)
    UI->>Proxy: POST /api/fleet/provision-ui (session auth)
    Proxy->>API: POST /api/fleet/provision (API key auth)

    Note over API,D1: Phase A — Control Plane (Edge)

    API->>D1: Upsert fleet_apps + allocateFleetNuxtPort()
    API->>D1: Insert provision_jobs (status: pending)
    API->>GH: POST /orgs/{org}/repos (create bare repo)
    API->>D1: Update status → creating_repo
    API->>D1: Update status → dispatching
    API->>GHA: workflow_dispatch provision-app.yml
    API-->>Proxy: 200 { provisionId, nuxtPort }
    Proxy-->>UI: Forward response
    UI->>UI: Start 5s polling via useFleetProvision

    Note over GHA: Phase B — GitHub Actions Runner

    GHA->>API: POST /provision/{id}/status → cloning
    GHA->>GHA: Checkout narduk-nuxt-template
    GHA->>GHA: pnpm export:starter → app-source/
    GHA->>GHA: pnpm install (starter)

    GHA->>API: POST /provision/{id}/status → initializing
    GHA->>API: POST /provision/{id}/log (preflight)
    GHA->>GHA: 0-preflight-check.ts (validate 9 env vars)

    GHA->>API: POST /provision/{id}/log (d1)
    GHA->>GHA: 1-create-d1.ts → Cloudflare D1 database
    GHA->>API: POST /provision/{id}/dispatch-context (merge D1 ids for retries)

    GHA->>API: POST /provision/{id}/log (doppler)
    GHA->>GHA: 2-create-doppler.ts → Doppler project + prd/dev/prd_copilot secrets

    GHA->>API: POST /provision/{id}/log (github)
    GHA->>GHA: 3-set-github-secrets.ts → repo secrets + Copilot repo access
    GHA->>GHA: sync:copilot-secrets → GitHub env copilot

    GHA->>API: POST /provision/{id}/log (analytics)
    GHA->>GHA: 4-create-analytics.ts → GA4 + GSC + IndexNow
    GHA->>API: POST /provision/{id}/dispatch-context (merge GA/GSC/IndexNow for retries)

    GHA->>API: POST /provision/{id}/log (hydrate)
    GHA->>GHA: 5-hydrate-repo.ts → placeholders + provision.json + SPEC.md + wrangler + GSC verify HTML + favicon

    GHA->>GH: git commit + push to new repo
    GHA->>API: POST /provision/{id}/status → deploying
    GHA->>GHA: pnpm build + wrangler deploy

    alt Success
        GHA->>API: POST /provision/{id}/complete (status: complete)
    else Failure
        GHA->>API: POST /provision/{id}/complete (status: failed)
    end

    UI->>UI: Poll detects terminal status, stop polling
```

## Provisioning Steps Detail

```mermaid
flowchart TD
    START([POST /api/fleet/provision]) --> VALIDATE[Validate body with Zod]
    VALIDATE --> AUTH[assertProvisionApiKey]
    AUTH --> UPSERT["Upsert fleet_apps\nallocateFleetNuxtPort(3200-6199)"]
    UPSERT --> JOB["Insert provision_jobs\nstatus: pending"]
    JOB --> TOKEN{GH token\nconfigured?}
    TOKEN -- no --> FAIL_TOKEN[status: failed\nMissing token]
    TOKEN -- yes --> REPO["Create GitHub repo\nPOST /orgs/{org}/repos"]
    REPO -- "422 exists" --> FAIL_422["status: failed\n409 — Retry skips repo create"]
    REPO -- ok --> DISPATCH
    REPO -- error --> FAIL_REPO["status: failed\nRepo creation error"]
    DISPATCH["Dispatch provision-app.yml\nvia workflow_dispatch"] --> OK["Return 200\nprovisionId + nuxtPort"]
    DISPATCH -- error --> FAIL_DISPATCH["status: failed\nWorkflow dispatch error"]

    style FAIL_TOKEN fill:#922,color:#fff
    style FAIL_422 fill:#922,color:#fff
    style FAIL_REPO fill:#922,color:#fff
    style FAIL_DISPATCH fill:#922,color:#fff
    style OK fill:#1a6b35,color:#fff
```

## GitHub Actions Pipeline Steps

The workflow checks out this repo first so `scripts/provision-cp-callback.sh` is
available. **Status** and **log** calls use that script in `best-effort` mode
(HTTP failures emit `::warning::` in the job log). **Complete** (success or
failure) uses `strict` mode so the step fails if the control plane does not
return 200/201 — avoiding silent “green” runs with a stuck job in D1. Payloads
for `complete` are built with `jq`.

For the `narduk-enterprises/control-plane` repo itself, the workflow should
bootstrap from a single GitHub Actions secret: `DOPPLER_TOKEN`. That token loads
the `control-plane/prd` Doppler config, which then supplies `CONTROL_PLANE_URL`,
`PROVISION_API_KEY`, `CLOUDFLARE_*`, `DOPPLER_API_TOKEN`, GitHub package auth,
and the control-plane GitHub service token for the rest of the run.

```mermaid
flowchart LR
    P["0. Preflight\n9 env vars"] --> D1["1. Create D1\nCloudflare API"]
    D1 --> DOP["2. Doppler\nProject + Secrets\nprd_copilot + read token"]
    DOP --> GHS["3. GitHub Repo Config\nDOPPLER_TOKEN\nGH_PACKAGES_TOKEN\nCopilot repo access"]
    GHS --> COP["3b. Copilot Env Sync\nprd_copilot → env copilot"]
    COP --> ANA["4. Analytics\nGA4 + GSC + IndexNow\n(non-fatal)"]
    ANA --> HYD["5. Hydrate Repo\nPlaceholders\nprovision.json\nSPEC.md\nWrangler\nGSC verify HTML\nFavicons"]
    HYD --> GIT["git commit\n+ push"]
    GIT --> BUILD["pnpm build\nwrangler deploy"]
    BUILD --> CB{Success?}
    CB -- yes --> COMPLETE["POST /complete\nstatus: complete"]
    CB -- no --> FAILED["POST /complete\nstatus: failed"]

    style COMPLETE fill:#1a6b35,color:#fff
    style FAILED fill:#922,color:#fff
```

## Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: Job created
    pending --> creating_repo: Control Plane
    creating_repo --> dispatching: Repo created
    dispatching --> provisioning: Workflow dispatched

    provisioning --> cloning: GHA callback
    cloning --> initializing: GHA callback
    initializing --> deploying: GHA callback

    deploying --> complete: GHA /complete
    deploying --> failed: GHA /complete

    creating_repo --> failed: Error
    dispatching --> failed: Error

    failed --> pending: Retry (admin)

    state complete {
        [*] --> [*]: Terminal
    }
    state failed {
        [*] --> [*]: Terminal (retryable)
    }
```

## Secret Flow

```mermaid
graph TB
    HUB["Hub Project\nnarduk-nuxt-template / prd\nCLOUDFLARE_API_TOKEN\nCLOUDFLARE_ACCOUNT_ID\nPOSTHOG / GA / GSC keys"]

    PRD["Spoke PRD\napp-name / prd\nAPP_NAME, SITE_URL\nCRON_SECRET\nNUXT_SESSION_PASSWORD\nGA_PROPERTY_ID\nGA_MEASUREMENT_ID\nINDEXNOW_KEY"]
    COP["Spoke Copilot\napp-name / prd_copilot\nminimal agent-only keys\nGITHUB_TOKEN_PACKAGES_READ\nNODE_AUTH_TOKEN\noptional CLOUDFLARE_*"]

    DEV["Spoke DEV\napp-name / dev\nSITE_URL = localhost:PORT\nNUXT_PORT = allocated\nCRON_SECRET\nNUXT_SESSION_PASSWORD"]

    GHSEC["GitHub Repo Secrets\norg/app-name\nDOPPLER_TOKEN\nGH_PACKAGES_TOKEN\nCONTROL_PLANE_URL"]
    GHENV["GitHub Environment\norg/app-name / copilot\nGH_TOKEN_PACKAGES_READ\nNODE_AUTH_TOKEN\noptional CLOUDFLARE_*"]

    HUB -->|"syncHubSecrets()"| PRD
    HUB -->|"syncDevConfig()"| DEV
    DOP["Control-plane runner"] -->|"bulkSetSecrets()"| COP
    PRD -->|"createDopplerServiceToken()"| GHSEC
    COP -->|"sync:copilot-secrets"| GHENV
```

## Copilot Environment

Freshly provisioned app repos should have a GitHub Actions environment named
`copilot`. GitHub Agentic Workflows such as downstream
`.github/workflows/provisioned-app-build.md` read their install/build secrets
from that environment, not from chat.

The provisioning runner now:

1. Seeds Doppler `prd_copilot` with the minimal agent secret set.
2. Mints a read-only `prd_copilot` service token for the sync step.
3. Runs
   `pnpm run sync:copilot-secrets -- <app> --doppler-config=prd_copilot --github-repo=<owner>/<repo>`
   to create/update the GitHub environment `copilot`.

For ongoing drift control, use
[`sync-copilot-secrets.yml`](../.github/workflows/sync-copilot-secrets.yml) from
this repo. It supports manual dry runs in staging and a scheduled nightly resync
across active fleet apps. Keep credentials least-privilege:

- Doppler: read-only token scoped to `<app>/prd_copilot`
- GitHub: token allowed to set Actions environment secrets on the target repo

Operators should use the local [operator runbook](./operator-runbook.md) for the
control-plane workflow and hand downstream maintainers the template runbook at
[template docs/agents/operations.md](https://github.com/narduk-enterprises/narduk-nuxt-template/blob/main/docs/agents/operations.md),
especially the sections on provisioning, the `copilot` environment, and
`sync:copilot-secrets`.

## Callback API Routes

```mermaid
flowchart LR
    GHA[GitHub Actions] -->|"Bearer PROVISION_API_KEY"| STATUS["POST /provision/{id}/status\nUpdate status field"]
    GHA -->|"Bearer PROVISION_API_KEY"| LOG["POST /provision/{id}/log\nInsert structured log"]
    GHA -->|"Bearer PROVISION_API_KEY"| COMPLETE["POST /provision/{id}/complete\nSet final status + metadata"]

    ADMIN[Admin Browser] -->|"Session auth"| RETRY["POST /provision/{id}/retry\nRe-dispatch workflow"]
    ADMIN -->|"Session auth"| JOBS["GET /provision-ui/jobs\nList jobs with logs"]
    ADMIN -->|"Session auth"| PROV["POST /provision-ui\nProxy to provision API"]
```
