# Operator Runbook

This runbook covers the control-plane side of provisioning downstream app repos
for GitHub Agentic Workflows.

## Provision Contract

Provision requests must include:

- `name`
- `displayName`
- `url`

Provision requests may also include:

- `shortDescription`
- `description`

Use the fields this way:

- `shortDescription`: short human-facing summary for GitHub repo metadata and
  starter app/site description
- `description`: long agent brief or product spec seed for provisioning context

The control plane persists that context into the generated repo so agents have
canonical context on first run:

- `provision.json`
- `SPEC.md` with `Status: DRAFT`

## Fresh Repo Expectations

After a successful `provision-app.yml` run, a new app repo should have:

- `provision.json` at the repo root with `name`, `displayName`,
  `shortDescription`, `description`, `url`, and `provisionedAt`
- `SPEC.md` seeded as `Status: DRAFT`
- `SPEC.md` with `Product`, `In scope`, `User flows`, and `Non-functional`
  seeded from the long brief
- GitHub repo created and pushed on `main`
- Matching Forgejo repo created under `code.nard.uk/narduk-enterprises/*`
- GitHub as the current primary repo and Forgejo as the mirrored secondary repo
- GitHub Actions environment `copilot`
- `copilot` environment secrets synced from Doppler `prd_copilot`

This is required so operators can run downstream
`.github/workflows/provisioned-app-build.md` without pasting secrets into chat.

## Copilot Secret Source Of Truth

For agents, Doppler `prd_copilot` is the source of truth. Keep it minimal and
agent-only. The default sync surface is:

- `PACKAGE_REGISTRY_PROVIDER`
- `FLEET_FORGEJO_BASE_URL`
- `FLEET_FORGEJO_OWNER`
- `GITHUB_TOKEN_PACKAGES_READ` → GitHub environment secret
  `GH_TOKEN_PACKAGES_READ`
- `FORGEJO_TOKEN`
- `NODE_AUTH_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Do not treat full `prd` as the agent config.

## Provision-Time Sync

The provisioning workflow now does this automatically:

1. Seeds Doppler `prd_copilot` with the minimal agent secret set.
2. Mints a read-only Doppler token scoped to `<app>/prd_copilot`.
3. Creates or updates GitHub Actions environment `copilot`.
4. Ensures the Forgejo repo exists and mirrors GitHub refs into Forgejo.
5. Runs:

```bash
pnpm run sync:copilot-secrets -- <doppler-project-slug> --doppler-config=prd_copilot --github-repo=<owner>/<repo>
```

## Repeatable Re-Sync

For drift control, use control-plane workflow
[`sync-copilot-secrets.yml`](../.github/workflows/sync-copilot-secrets.yml).

- Scheduled mode: nightly resync across active fleet apps
- Manual mode: single-app or all-app resync
- Staging validation: run manual dispatch with `dry-run=true` first

You can also run the sync locally from the control-plane repo when the Doppler
CLI and `gh` CLI are authenticated:

```bash
pnpm run sync:copilot-secrets -- <doppler-project-slug> --doppler-config=prd_copilot --github-repo=<owner>/<repo>
```

To fan out across fleet apps from the control-plane repo:

```bash
pnpm exec tsx tools/sync-fleet-copilot-envs.ts --app-name=<app-name>
```

For GitHub → Forgejo mirroring, use control-plane workflow
[`sync-fleet-to-forgejo.yml`](../.github/workflows/sync-fleet-to-forgejo.yml).

- Scheduled mode: nightly mirror across sync-managed repos
- Manual mode: single-app mirror, explicit repo override, or full-fleet run
- Staging validation: run manual dispatch with `dry-run=true` first

You can also run the mirror locally from the control-plane repo:

```bash
pnpm run fleet:mirror:forgejo -- --repo=<app-name>
pnpm run fleet:mirror:forgejo:dry -- --repo=<app-name>
```

## Credentials

Keep sync credentials least-privilege:

- Doppler: read-only token scoped to the target project/config (`prd_copilot`)
- GitHub: token able to manage Actions environment secrets on the target repo
- Forgejo: PAT able to read the current user, create org repos in
  `narduk-enterprises`, and push refs to existing repos

The scheduled/manual fleet sync workflow uses the broad Doppler API token only
to mint per-app read tokens, then hands those scoped tokens to the actual sync
command.

## Downstream Maintainer Handoff

Point downstream repo maintainers to the template operations guide:

[docs/agents/operations.md](https://github.com/narduk-enterprises/narduk-nuxt-template/blob/main/docs/agents/operations.md)

The relevant sections are:

- provisioning with `shortDescription` plus long `description`
- GitHub Actions environment `copilot`
- `pnpm run sync:copilot-secrets`
