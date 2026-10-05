# Git workflow

| Rule | Example |
|---|---|
| Never commit or push without the user's OK, asked each time | « Commit with this message? » → wait for yes |
| No AI trailer in commits or PRs | no `Co-Authored-By: Claude …`, no « Generated with … » |
| Work on `dev`; PRs go to `main` | `old-version` is read-only |
| Never commit `.env` | only `.env.example` |
| Rewrite history (amend, rebase, force push) only on explicit OK | `dev` is pushed: a rewrite needs `git push --force` |
| Message = what changed, conventional prefix | `feat(rapport): …`, `fix(imports): …`, `refactor(frontend): …` |

- Before proposing a commit: `make format` ran, type-check clean, `make tests` green (or say what failed).
