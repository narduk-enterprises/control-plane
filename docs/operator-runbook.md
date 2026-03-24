# Operator Runbook

This runbook covers the control-plane side of provisioning downstream app repos
for GitHub Agentic Workflows.

## Provision Contract

Provision requests must include:

- `name`
- `displayName`
- `description`
- `url`

The control plane persists that product blurb into the generated repo so agents
have canonical context on first run:

- `provision.json`
- `SPEC.md` with `Status: DRAFT`

## Fresh Repo Expectations

After a successful `provision-app.yml` run, a new app repo should have:

- `provision.json` at the repo root with `name`, `displayName`, `description`,
  `url`, and `provisionedAt`
- `SPEC.md` seeded as `Status: DRAFT`
- GitHub Actions environment `copilot`
- `copilot` environment secrets synced from Doppler `prd_copilot`

This is required so operators can run downstream
`.github/workflows/provisioned-app-build.md` without pasting secrets into chat.

## Copilot Secret Source Of Truth

For agents, Doppler `prd_copilot` is the source of truth. Keep it minimal and
agent-only. The default sync surface is:

- `GITHUB_TOKEN_PACKAGES_READ` → GitHub environment secret
  `GH_TOKEN_PACKAGES_READ`
- `NODE_AUTH_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Do not treat full `prd` as the agent config.

## Provision-Time Sync

The provisioning workflow now does this automatically:

1. Seeds Doppler `prd_copilot` with the minimal agent secret set.
2. Mints a read-only Doppler token scoped to `<app>/prd_copilot`.
3. Creates or updates GitHub Actions environment `copilot`.
4. Runs:

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

## Credentials

Keep sync credentials least-privilege:

- Doppler: read-only token scoped to the target project/config (`prd_copilot`)
- GitHub: token able to manage Actions environment secrets on the target repo

The scheduled/manual fleet sync workflow uses the broad Doppler API token only
to mint per-app read tokens, then hands those scoped tokens to the actual sync
command.

## Downstream Maintainer Handoff

Point downstream repo maintainers to the template operations guide:

[docs/agents/operations.md](https://github.com/narduk-enterprises/narduk-nuxt-template/blob/main/docs/agents/operations.md)

The relevant sections are:

- provisioning with `description`
- GitHub Actions environment `copilot`
- `pnpm run sync:copilot-secrets`
