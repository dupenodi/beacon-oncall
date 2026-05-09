# beacon-oncall

Private incident routing / escalation portfolio.

## Create the private GitHub repo (local terminal)

Cursor’s sandbox blocks `git init` here, and `gh` needs a valid login on your machine.

1. Authenticate GitHub CLI (one-time):

```bash
gh auth login -h github.com
```

2. From this folder, run:

```bash
./scripts/bootstrap-git-and-github.sh
```

Optional: pass a repo name if `beacon-oncall` is taken:

```bash
./scripts/bootstrap-git-and-github.sh beacon-oncall-portfolio
```

That initializes git (if needed), commits, runs `gh repo create ... --private --push`, and sets `origin`.
