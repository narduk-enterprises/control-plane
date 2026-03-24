# Provisioning Flow

End-to-end pipeline from a provisioning request to a live, deployed app.

Three phases, each running in a different environment:

| Phase | Where | Trigger |
|-------|-------|---------|
| **A - Control Plane API** | Cloudflare Worker (edge) | POST `/api/fleet/provision` |
| **B - GitHub Actions** | `provision-app.yml` runner | Dispatched by Phase A |
| **C - Local / Developer** | Developer machine | `pnpm run setup` or `pnpm ship` |

---

## Full Provisioning Flow (Control Plane -> GitHub Actions)

```mermaid
sequenceDiagram
    actor Dev as Developer or Agent
    participant CP as Control Plane API
    participant D1 as Fleet Registry D1
    participant CF as Cloudflare API
    participant Dopp as Doppler API
    participant GH as GitHub API
    participant Google as Google APIs
    participant GHA as GitHub Actions
    participant App as New App Worker

    Dev->>CP: POST /api/fleet/provision
    CP->>CP: assertProvisionApiKey()

    Note over CP,D1: Step 1 - Fleet Registry
    CP->>D1: upsert fleet_apps
    CP->>D1: allocateFleetNuxtPort()
    CP->>D1: insert provisionJobs (pending)

    Note over CP,GH: Step 2 - GitHub Repo
    CP->>D1: updateStatus: creating_repo
    CP->>GH: POST /orgs/{org}/repos

    Note over CP,CF: Step 3 - Cloudflare D1 Database
    CP->>D1: updateStatus: provisioning_d1
    CP->>CF: createD1Database({name}-db)
    CF-->>CP: d1DatabaseId

    Note over CP,Dopp: Step 4 - Doppler Project + Secrets
    CP->>D1: updateStatus: provisioning_doppler
    CP->>Dopp: createDopplerProject(name)
    CP->>Dopp: syncHubSecrets (hub prd -> spoke prd)
    CP->>Dopp: syncDevConfig (hub prd -> spoke dev)
    CP->>Dopp: createDopplerServiceToken(ci-deploy)
    Dopp-->>CP: dopplerServiceTokenValue

    Note over CP,GH: Step 5 - GitHub Repo Secrets
    CP->>GH: setRepoSecret(DOPPLER_TOKEN)
    CP->>GH: setRepoSecret(GH_PACKAGES_TOKEN)
    CP->>GH: setRepoSecret(CONTROL_PLANE_URL)

    Note over CP,Google: Steps 6-8 - Analytics (non-fatal)
    CP->>D1: updateStatus: provisioning_analytics
    CP->>Google: createGA4Property + createGA4DataStream
    Google-->>CP: gaPropertyId, gaMeasurementId
    CP->>Google: registerGscSite + getGscVerificationToken
    Google-->>CP: gscVerificationFileName, fileContent
    CP->>CP: generateIndexNowKey()
    CP->>Dopp: bulkSetSecrets prd+dev (GA_PROPERTY_ID, GA_MEASUREMENT_ID, INDEXNOW_KEY)
    CP->>D1: update fleet_apps with analytics IDs

    Note over CP,GHA: Step 9 - Dispatch Workflow
    CP->>D1: updateStatus: dispatching
    CP->>GHA: triggerWorkflow(provision-app.yml) with all pre-provisioned IDs
    CP->>D1: updateStatus: provisioning
    CP-->>Dev: 200 OK - provisionId + infrastructure details

    Note over GHA: GitHub Actions: provision-app.yml
    GHA->>CP: status callback: cloning
    GHA->>GH: checkout narduk-nuxt-template
    GHA->>GHA: pnpm install (template workspace)
    GHA->>GHA: pnpm export:starter -> app-source/
    GHA->>GH: git init + remote add origin (new repo)
    GHA->>GHA: pnpm install (generated starter)
    GHA->>Dopp: dopplerhq/secrets-fetch-action (inject env vars)
    GHA->>CP: status callback: initializing

    Note over GHA: init.ts (with pre-provisioned IDs)
    GHA->>GHA: Step 1 - applyStarterPlaceholders (__APP_NAME__ etc.)
    GHA->>GHA: Step 2 - D1 SKIPPED (D1_DATABASE_ID pre-provisioned)
    GHA->>GHA: Step 3 - wrangler.json gets d1DatabaseId + routes
    GHA->>GHA: Step 4 - Doppler SKIPPED (DOPPLER_PRE_PROVISIONED=true)
    GHA->>GHA: Step 5 - GitHub secret SKIPPED (DOPPLER_PRE_PROVISIONED=true)
    GHA->>GHA: Step 5.5 - write doppler.yaml (project=name, config=dev)
    GHA->>GHA: Step 6 - Analytics SKIPPED (GA_PROPERTY_ID pre-provisioned)
    GHA->>GHA: Step 7 - generate-favicons.ts
    GHA->>GHA: Step 8 - .githooks, .setup-complete, .template-version

    GHA->>GHA: Write GSC verification file to apps/web/public/
    GHA->>GH: git commit + push origin main
    GHA->>CP: status callback: deploying
    GHA->>GHA: pnpm build (apps/web)
    GHA->>App: wrangler deploy to Cloudflare edge
    GHA->>Google: gsc-verify.ts (continue-on-error)
    GHA->>CP: POST /provision/{id}/complete (status: complete or failed)

    App-->>Dev: App live at production URL
```

---

## Local Developer Setup (`pnpm run setup`)

```mermaid
flowchart TD
    A([pnpm run setup\n--name --display --url]) --> G{Remote points\nto template?}
    G -- yes --> FATAL[FATAL: push-to-template guard]
    G -- no --> S1

    S1["Step 1/8\napplyStarterPlaceholders()\nReplace __APP_NAME__ in 7 files"] --> S2

    S2["Step 2/8\nwrangler d1 create {name}-db\nor use D1_DATABASE_ID env"] --> S3

    S3["Step 3/8\nLink D1 -> wrangler.json\nfor each app in apps/ except example-*"] --> S4

    S4{Doppler CLI\navailable?}
    S4 -- no --> S4D([Defer: Doppler + GitHub steps])
    S4 -- yes --> S4A["Step 4/8\ndoppler projects create {name}\nsyncHubSecrets into prd\nsyncDevConfig into dev"]

    S4A --> S5{hasGitRemote?}
    S5 -- no --> S5D([Defer: DOPPLER_TOKEN secret])
    S5 -- yes --> S5A["Step 5/8\ndoppler tokens create ci-deploy\ngh secret set DOPPLER_TOKEN"]

    S5D --> S55
    S5A --> S55
    S4D --> S55

    S55["Step 5.5/8\nWrite doppler.yaml\ndoppler setup --config dev"] --> S6

    S6["Step 6/8\nAnalytics delegated to control plane\nReport GA_PROPERTY_ID if pre-provisioned"] --> S7

    S7["Step 7/8\nGenerate favicon assets\ntools/generate-favicons.ts"] --> S8

    S8["Step 8/8\ngit config core.hooksPath .githooks\nWrite .setup-complete + .template-version"] --> DONE

    DONE([Setup complete])

    style FATAL fill:#922,color:#fff
    style DONE fill:#1a6b35,color:#fff
```

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

    PRD["Spoke Project\napp-name / prd\ncross-project refs to hub\nAPP_NAME, SITE_URL\nCRON_SECRET, NUXT_SESSION_PASSWORD\nGA_PROPERTY_ID, GA_MEASUREMENT_ID\nINDEXNOW_KEY"]

    DEV["Spoke Project\napp-name / dev\ncross-project refs to hub\nSITE_URL = localhost:PORT\nNUXT_PORT = random allocated\nCRON_SECRET, NUXT_SESSION_PASSWORD"]

    GHSEC["GitHub Repo Secrets\norg/app-name\nDOPPLER_TOKEN (ci-deploy token)\nGH_PACKAGES_TOKEN\nCONTROL_PLANE_URL"]

    HUB -->|syncHubSecrets| PRD
    HUB -->|syncDevConfig| DEV
    PRD -->|ci-deploy service token| GHSEC
```
