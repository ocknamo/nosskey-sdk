# CLAUDE.md

## Pre-commit verification

Run these from the repository root before committing. They mirror the CI
workflow (`.github/workflows/ci.yml`) — if any of them fails locally, CI
will too.

```sh
# 1. Format & lint (matches CI: SDK - Test, Lint, Build)
npm run format:check

# 2. Build all workspaces (SDK, iframe, sample app)
npm run build

# 3. SDK + iframe unit tests with coverage (matches CI test:coverage)
npm run test:coverage

# 4. Sample app type-check (matches CI: Sample App - Check, Build)
npm run check -w svelte-app
```

`npm run build` already builds `nosskey-sdk` → `nosskey-iframe` → `svelte-app`
in dependency order, so the dedicated `Build SDK / Build iframe package` CI
steps are covered by step 2.

If `format:check` reports issues, run `npm run fix` to auto-format.
