# Lab: Run the zen-pharma-frontend CI/CD Pipeline After Forking

You forked `zen-pharma-frontend`. This guide gets its GitHub Actions pipeline running end
to end for `pharma-ui` — from a push on your laptop to a pod running on your EKS cluster,
promoted through DEV → QA → PROD.

This is the companion to `zen-pharma-backend/auth-service-ci-lab.md` — same pipeline shape,
same `zen-gitops` repo, adapted for a single Node.js/React service instead of 8 Java/Node
microservices. If you've already done the backend lab, most of Part 1–2 below is just
"do it again for this repo" — the PAT, AWS account, and `zen-gitops` fork are shared.

This guide covers **CI/CD only**. It assumes your AWS infrastructure (EKS, RDS, ECR, IAM)
and ArgoCD are already running — see [Part 0](#part-0--things-that-must-already-be-true).

---

## Architecture at a glance

```
feature branch push (feat-*/fix-*/chore-*)
      │
      ▼
ci-pr-pharma-ui.yml               (~5 min, no Docker, no ECR)
  npm ci → ESLint → CodeQL → Jest → npm audit
      │
      │  merge to develop / release/**
      ▼
ci-pharma-ui.yml                  (~8-10 min)
  ├─ build            npm ci → ESLint → CodeQL → Jest → npm audit → Docker → Trivy
  │                   → ECR push → Cosign sign
  ├─ deploy-dev  ───► git commit  envs/dev/values-pharma-ui.yaml   in zen-gitops
  │                        │
  │                        ▼
  │                   ArgoCD auto-syncs DEV (polls every ~3 min)
  │
  └─ open-qa-pr  ───► PR opened  envs/qa/values-pharma-ui.yaml    in zen-gitops
                            │
                       (you review + merge)
                            ▼
                       ArgoCD auto-syncs QA
                            │
                  promote-prod.yml (workflow_dispatch, manual)
                            ▼
                       PR opened  envs/prod/values-pharma-ui.yaml  in zen-gitops
                            │
                     (2 approvals + merge)
                            ▼
                       ArgoCD PROD — you trigger sync manually
```

Unlike `promote-prod.yml` in `zen-pharma-backend`, this repo only ships one service — there
is no service dropdown, `workflow_dispatch` just runs.

---

## Part 0 — Things that must already be true

| Prerequisite | Where it comes from |
|---|---|
| AWS account, VPC, EKS cluster, RDS, ECR repo `pharma-ui`, IAM OIDC role | `zen-infra` — Terraform. See `zen-infra/docs/FULL-DEPLOYMENT-GUIDE.md` Stages 1–2 |
| ArgoCD installed + `pharma` AppProject + `pharma-ui-dev` Application (and `pharma-qa`/`pharma-prod` app-of-apps) | `zen-infra/scripts/01-install-prerequisites.sh` and `02-bootstrap-argocd.sh` |
| `zen-gitops` fork personalised with **your** AWS account ID and RDS instance ID | `zen-gitops/README.md` → "After Forking — Required Personalisation" |

`pharma-ui` doesn't talk to RDS directly, but the shared `zen-gitops` values files across
all 8 services are patched with `sed` in one pass — if you did this for the backend lab,
it's already done for `pharma-ui` too.

---

## Course / instructor setup

Same model as the backend lab — see `zen-pharma-backend/auth-service-ci-lab.md` →
"Course / instructor setup" for the full explanation. Summary:

- **Mode A (recommended):** each student forks `zen-infra`, `zen-gitops`,
  `zen-pharma-backend`, `zen-pharma-frontend` and runs their own Terraform. The IAM role
  `pharma-dev-github-actions-role` is scoped automatically to whichever fork ran
  `terraform apply` — no instructor step needed per student.
- **Mode B (shared cluster):** instructor manually appends each student's
  `zen-pharma-frontend` fork to the trust policy's `sub` list (same command as the backend
  lab, just note the role is shared across both `zen-pharma-backend` and
  `zen-pharma-frontend` — `zen-infra`'s trust policy already lists both repos per org, see
  `zen-infra/modules/iam/github-actions-oidc.tf`), and creates the `dev`/`prod` GitHub
  Environments in each student's `zen-pharma-frontend` fork (not inherited from the
  template repo).

---

## Prerequisites

- `git`, `kubectl`, `aws` CLI, `argocd` CLI — same as the backend lab
- Node.js 20+ (optional, only needed if you want to run `npm test` / `npm run lint`
  locally before pushing)

---

## Part 1 — Fork the repos

### Step 1.1 — Fork zen-pharma-frontend

1. Go to `https://github.com/DPP-2026/zen-pharma-frontend` → **Fork** → **Create fork**
2. Clone it:

```bash
git clone https://github.com/<YOUR-USERNAME>/zen-pharma-frontend.git
cd zen-pharma-frontend
```

Relevant contents:

```
zen-pharma-frontend/
├── src/ public/ package.json Dockerfile nginx.conf
└── .github/workflows/
    ├── _node-build.yml         ← reusable: full build + ECR push
    ├── _node-pr-check.yml      ← reusable: lint + test + SAST (no Docker)
    ├── ci-pr-pharma-ui.yml     ← trigger: feature branches
    ├── ci-pharma-ui.yml        ← trigger: develop merges
    └── promote-prod.yml        ← manual PROD promotion
```

**Important:** GitHub disables Actions on forks by default. Fork → **Actions** tab →
**"I understand my workflows, go ahead and enable them"**.

### Step 1.2 — Fork zen-gitops (skip if done for the backend lab)

Same repo as the backend lab — `zen-gitops` is shared across both. If you already
personalised it there, nothing more to do here. Otherwise follow
`zen-gitops/README.md` → **"After Forking — Required Personalisation"** now.

---

## Part 2 — Configure GitHub Actions on zen-pharma-frontend

### Step 2.1 — Personal Access Token for GitOps writes

If you already created `zen-pharma-gitops-token` for the backend lab (scoped to your
`zen-gitops` fork with Contents + Pull requests write), **reuse it** — it's the same
target repo. Otherwise, create it exactly as in the backend lab's Step 2.1.

### Step 2.2 — Add repository secrets

`zen-pharma-frontend` fork → **Settings → Secrets and variables → Actions → Secrets** →
**New repository secret**:

| Secret | Value |
|---|---|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `GITOPS_TOKEN` | The PAT from Step 2.1 |

No `NVD_API_KEY` here — `_node-build.yml` doesn't run OWASP Dependency Check; Node
dependency scanning is `npm audit`, which needs no key. No AWS access keys either — auth
is via OIDC (`role-to-assume:
arn:aws:iam::<account>:role/pharma-dev-github-actions-role`), same role the backend uses.

### Step 2.3 — Add a repository variable

**Variables** tab → **New repository variable**:

| Variable | Value |
|---|---|
| `GITOPS_REPO` | `<YOUR-USERNAME>/zen-gitops` |

### Step 2.4 — Create GitHub Environments

**Settings → Environments → New environment**:

| Environment | Protection rule | Used by |
|---|---|---|
| `dev` | None | `deploy-dev` job in `ci-pharma-ui.yml` |
| `prod` | **Required reviewers** — add yourself and/or a classmate; enable **Prevent self-review** | `promote-prod.yml` |

GitHub Environments are per-repo — creating `prod` in `zen-pharma-backend` does **not**
create it here. You need it in both forks.

---

## Part 3 — Confirm the zen-gitops values files for pharma-ui

```
zen-gitops/envs/dev/values-pharma-ui.yaml
zen-gitops/envs/qa/values-pharma-ui.yaml
zen-gitops/envs/prod/values-pharma-ui.yaml
```

```bash
cd zen-gitops
grep -rn "repository:" envs/dev/values-pharma-ui.yaml envs/qa/values-pharma-ui.yaml envs/prod/values-pharma-ui.yaml
```

Every `image.repository` should show **your** AWS account ID. `pharma-ui` has no `DB_HOST`
— it's a static React build served by Nginx, it doesn't talk to Postgres.

---

## Part 4 — Trigger the CI pipeline

### Step 4.1 — Create the develop branch

```bash
cd zen-pharma-frontend
git checkout -b develop
git push -u origin develop
```

### Step 4.2 — Push a feature branch and watch the PR check

```bash
git checkout -b feat-first-build
# make any real change under src/ — a comment or a small tweak is enough
git add -A
git commit -m "test: trigger PR check"
git push -u origin feat-first-build
```

(Any change under `src/`, `public/`, `package.json`, `package-lock.json`, or the workflow
files themselves triggers this — see the `paths:` filter in `ci-pr-pharma-ui.yml`.)

Go to **Actions**. `ci-pr-pharma-ui.yml` runs (calls `_node-pr-check.yml`):

```
✓ Checkout
✓ Setup Node.js 20
✓ Install dependencies          (npm ci)
✓ ESLint (--max-warnings 0)
✓ Initialize CodeQL
✓ Jest (tests + coverage)
✓ Upload Jest coverage report
✓ CodeQL — Analyze
✓ npm audit (HIGH/CRITICAL → fail)
```

No Docker, no AWS credentials, no ECR — ~5 minutes.

### Step 4.3 — Merge to develop and watch the full CI

```bash
git checkout develop
git merge feat-first-build
git push origin develop
```

**Actions → CI/CD — pharma-ui**. Three jobs:

**Job `build`** (`_node-build.yml`, ~8–10 min):

```
✓ Checkout
✓ Set image tag                 →  sha-abc1234
✓ Setup Node.js 20
✓ Install dependencies          (npm ci)
✓ ESLint (--max-warnings 0)
✓ Initialize CodeQL
✓ npm test (Jest + coverage)
✓ Upload Jest coverage report
✓ CodeQL — Analyze
✓ npm audit (HIGH/CRITICAL → fail)
✓ Configure AWS credentials (OIDC)
✓ Login to Amazon ECR
✓ Build Docker image            (multi-stage, Nginx, non-root)
✓ Trivy — Image vulnerability scan
✓ Upload Trivy SARIF to GitHub Security tab
✓ Push image to ECR             →  sha-abc1234
✓ Install Cosign
✓ Cosign — Sign image (keyless, GitHub OIDC → Fulcio → Rekor)
```

**Job `deploy-dev`** (needs `build`, environment `dev`) — commits to your `zen-gitops`
fork's `main`:

```
Run yq e ".image.tag = \"sha-abc1234\"" -i "_gitops/envs/dev/values-pharma-ui.yaml"
[main xyz5678] ci(dev): update pharma-ui → sha-abc1234
```

**Job `open-qa-pr`** (needs `build` + `deploy-dev`) — opens/updates a PR in `zen-gitops`:

```
promote(qa): pharma-ui → sha-abc1234
```

Branch `promote/qa/pharma-ui/latest` — reused and force-pushed on every subsequent push
to `develop`, not one PR per commit. Leave it open for Part 7.

> A `dast` job exists (ZAP baseline against DEV) but is disabled (`if: false`) by default.

### Step 4.4 — Verify the image landed in ECR

```bash
aws ecr describe-images \
  --repository-name pharma-ui \
  --region us-east-1 \
  --query 'sort_by(imageDetails, &imagePushedAt)[-1].imageTags' \
  --output table
```

---

## Part 5 — Watch ArgoCD deploy to DEV

```bash
argocd login <ARGOCD-URL> --username admin --password <PASSWORD>
argocd app get pharma-ui-dev
```

```bash
kubectl get pods -n dev -l app.kubernetes.io/name=pharma-ui -w
```

Ctrl+C once you see `1/1 Running`. Then:

```bash
kubectl get pods -n dev -l app.kubernetes.io/name=pharma-ui \
  -o jsonpath='{.items[0].spec.containers[0].image}'
# expect: <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/pharma-ui:sha-abc1234

kubectl port-forward -n dev deploy/pharma-ui 8080:80 &
curl -I http://localhost:8080/     # expect HTTP/1.1 200 OK
kill %1
```

`pharma-ui` has no `/actuator/health` — it's an Nginx-served static bundle, so `/` is the
health signal.

---

## Part 6 — ArgoCD self-heal demo (optional)

Same drift-correction demo as the backend lab, against `pharma-ui-dev`:

```bash
argocd app set pharma-ui-dev --self-heal
kubectl delete deployment pharma-ui -n dev
watch argocd app get pharma-ui-dev
```

Within ~3 minutes ArgoCD notices the missing deployment and recreates it from git — no
`kubectl apply` needed.

---

## Part 7 — Promote to QA

QA is the same **single shared** ArgoCD app (`pharma-qa`) used by every backend service —
it watches the whole `envs/qa/` directory.

1. Open your `zen-gitops` fork → **Pull requests** → `promote(qa): pharma-ui →
   sha-abc1234`
2. Review the diff (one `image.tag` line) → **Merge pull request**

```bash
kubectl get pods -n qa -l app.kubernetes.io/name=pharma-ui -w
kubectl port-forward -n qa deploy/pharma-ui 8081:80 &
curl -I http://localhost:8081/
kill %1
```

---

## Part 8 — Promote to PROD

1. **Actions → Promote to PROD → Run workflow** — no dropdown, this repo only has one
   service, it just runs against `pharma-ui`
2. Approve the `prod` environment gate (Step 2.4's required reviewer)
3. The job reads `.image.tag` from your `zen-gitops` fork's
   `envs/qa/values-pharma-ui.yaml`, validates `envs/prod/values-pharma-ui.yaml` exists,
   and opens `promote(prod): pharma-ui → sha-abc1234` (branch
   `promote/prod/pharma-ui/<tag>`)
4. Merge after approvals — `pharma-prod` (the shared PROD app-of-apps) has **no automated
   sync policy**:

```bash
argocd app diff pharma-prod
argocd app sync pharma-prod --prune
argocd app wait pharma-prod --health --timeout 300

kubectl get pods -n prod -l app.kubernetes.io/name=pharma-ui -w
kubectl port-forward -n prod deploy/pharma-ui 8082:80 &
curl -I http://localhost:8082/
kill %1
```

---

## Part 9 — GitHub Secrets / Variables / Environments reference

| Kind | Name | Used by | Notes |
|---|---|---|---|
| Secret | `AWS_ACCOUNT_ID` | `ci-pharma-ui.yml`, `_node-build.yml` | 12-digit account ID |
| Secret | `GITOPS_TOKEN` | `ci-pharma-ui.yml`, `promote-prod.yml` | PAT, write access to your `zen-gitops` fork — can be the same PAT used by `zen-pharma-backend` |
| Variable | `GITOPS_REPO` | `ci-pharma-ui.yml`, `promote-prod.yml` | `<your-username>/zen-gitops` |
| Environment | `dev` | `deploy-dev` job | no protection rule |
| Environment | `prod` | `promote-prod.yml` job | required reviewers + prevent self-review — must be created separately from the backend repo's `prod` environment |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow doesn't start on push | Actions disabled on the fork | Fork → **Actions** tab → enable workflows |
| `ci-pr-pharma-ui.yml` doesn't trigger on a push | Change wasn't under `src/`, `public/`, `package.json`, `package-lock.json`, or the workflow files (path filter) | Touch a file under one of those paths |
| ESLint step fails | Real lint errors, or `--max-warnings 0` catching warnings you're used to ignoring locally | `npx eslint src/ --ext .js,.jsx` locally and fix before pushing |
| `npm audit` step fails | A HIGH/CRITICAL vulnerable dependency | `npm audit fix`, or bump the specific package; the gate is `--audit-level=high`, not advisory |
| Job fails: `Error assuming role` | `AWS_ACCOUNT_ID` wrong, or fork not covered by the IAM trust policy | Confirm account ID; in Mode B, check the shared role's trust policy includes your `zen-pharma-frontend` fork |
| `deploy-dev` / `open-qa-pr` fails against `zen-gitops` | `GITOPS_TOKEN` expired/wrong scope | Regenerate the PAT (Contents + Pull requests write) on your `zen-gitops` fork |
| Pod `ImagePullBackOff` | `zen-gitops` still has the instructor's AWS account ID in `values-pharma-ui.yaml` | Re-run the `sed` personalisation from `zen-gitops/README.md` |
| `curl http://localhost:.../` hangs or connection refused | Wrong local port already in use, or `kubectl port-forward` pointing at the wrong namespace/deployment | `kill %1` any stale port-forward, re-run against the right `-n <env>` |
| `promote-prod.yml` fails immediately, no reviewer prompt | `prod` environment not created in **this** fork (it's per-repo, not shared with the backend fork) | Settings → Environments → create `prod` here too |
| `promote-prod.yml` fails: `QA values file not found` | No QA promotion has ever been merged for `pharma-ui` | Merge the QA promotion PR first (Part 7) |
| ArgoCD `pharma-ui-dev` stuck `OutOfSync` | `selfHeal` not enabled (off by default) | `argocd app set pharma-ui-dev --self-heal`, or `argocd app sync pharma-ui-dev` |
| `pharma-prod` stuck `OutOfSync` after merge | Manual sync by design | `argocd app sync pharma-prod --prune` |
