# Shahrouz Mohaghegh

Personal portfolio site built with Next.js (App Router) and TypeScript.

## Run locally

Node 24 is required. `.npmrc` sets `engine-strict`, so installing under any other version fails rather than warning.

```sh
nvm use
npm ci
npm run dev
```

## One-time setup after cloning

```sh
git config core.hooksPath .githooks
```

The hooks run `scripts/check-repo.mjs` before every commit. It blocks planning files that are not on the publish allow-list, anything under `docs/`, `.claude/` or `_bmad/`, em dashes, and confidential terms read from an untracked local `.forbidden-terms` file.

A full README follows in a later change.
