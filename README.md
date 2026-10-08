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

The hooks run `scripts/check-repo.mts` before every commit. It blocks planning files that are not on the publish allow-list, anything under `docs/`, `.claude/` or `_bmad/`, em dashes, and confidential terms read from an untracked local `.forbidden-terms` file.

## Working through pull requests

`main` is protected. Every change reaches it through a pull request, and the pull request merges only when the `gate` job in `.github/workflows/ci.yml` passes. Protection is strict (the branch must be up to date with `main` before merging) and applies to admins too, so there is no direct push to `main` for anyone.

The `gate` job also checks part of this protection on every run: its last step, `scripts/check-protection.mts`, fails unless `main` is protected, its required checks apply to admins too, and `gate` is among them. Those three are all the public branch endpoint shows; the pull request, strict and force push settings need an admin token to read and are not checked. Run `node scripts/check-protection.mts` to check it locally.

```sh
git switch -c <topic> main
# commit, through the hooks
git push -u origin <topic>
gh pr create --fill
gh pr checks --watch
gh pr merge --squash --delete-branch
```

When `main` moves while a pull request is open, strict protection blocks the merge until the branch is updated: `gh pr update-branch`, then wait for `gate` again.

Two repository settings keep this cheap:

- **Always suggest updating pull request branches**, so the update is one click (or `gh pr update-branch`).
- **Automatically delete head branches**, so merged branches do not pile up.

### Emergency path

1. **Production is broken:** roll back in Vercel to the previous production deployment (instant rollback). No commit is needed, and the gate is not involved.
2. **The fix:** goes through a pull request like any other change.
3. **The gate fails for a reason outside the change** (an outage at GitHub, npm or the gitleaks download): wait for the outage to pass, then re-run the job with `gh run rerun <run-id> --failed`. There is no bypass; production stays safe on the rolled-back deployment meanwhile.

## Changing the confidential terms

The confidential term list lives in three places: the local untracked `.forbidden-terms`, and the `FORBIDDEN_TERMS` secret in both the Actions and the Dependabot secret stores (runs started by Dependabot read only the second). Change it only like this.

Prerequisite: `gh auth login` as a user with admin rights on this repository, since writing repository secrets needs them. A `--dry-run` needs no `gh` at all.

```sh
# edit .forbidden-terms, then
npm run terms:sync -- --dry-run   # the guard alone; writes nothing
npm run terms:sync                # the guard, then both secrets
```

`scripts/terms-sync.mts` first runs `git fetch --prune origin`, then `scripts/check-repo.mts --history` against the edited list, over every local and remote-tracking branch. CI scans every blob and commit message in history, so a term that already matches history would turn every run red, and the only fix would be rewriting a public history. If anything matches, the script stops before writing any secret and names the commit and path. Only when the scan passes does it write both secrets with `gh secret set`, passing the file on stdin so the terms never appear in arguments or logs. Never set the secret by hand in the GitHub UI: the two stores and the local file would drift.

## Pinned versions

`.github/dependabot.yml` holds back TypeScript, `@types/node` and ESLint, with a reason for each, and `ci.yml` pins the gitleaks binary by version and checksum, which Dependabot does not track. Once a month `.github/workflows/pin-review.yml` runs `scripts/pin-review.mts`, which keeps one issue, "Dependency pins to review", current with the latest versions next to those pins. Close it after review; it comes back only when a major version, a peer range verdict or the gitleaks pin moves, not for patch releases. The report also carries the same protection reading, so relaxed protection is noticed even when nothing runs CI, and the registry expiry date of `shahrouzmohaghegh.com`, read over RDAP. The issue returns, led by an alert line, when protection drifts or cannot be read, or the domain is within 21 days of expiry, expired or unreadable, in case auto-renew or billing fails. `node scripts/pin-review.mts --print` shows the same report locally without touching the issue.

GitHub disables scheduled workflows in a public repository after 60 days without repository activity, and says so in the Actions tab. To turn the review back on, open Actions, select "Pin review" and choose "Enable workflow", or run `gh workflow enable pin-review.yml`. Running it once by hand (`gh workflow run pin-review.yml`) checks it still works.

A full README follows in a later change.
