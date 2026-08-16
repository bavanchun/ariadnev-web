# ariadnev bridge and legacy host redirect

Status: **Applied in production**
Recorded: 2026-08-16
Phase: interim (between Phase 7 and the Phase 12 cutover)
Required by: Phase 12 (production cutover), legacy decommission

Sources of record:

- [`deployment/topology.json`](../../deployment/topology.json) — the `interim` block
- [`rules/legacy-host-redirect.json`](../../rules/legacy-host-redirect.json) — the redirect policy
- [`workers/bridge/wrangler.toml`](../../workers/bridge/wrangler.toml) — the interim Worker
- `plans/260816-1255-ariadnev-domain-cutover-bridge-and-redirect/` — execution record

## Decision

`ariadnev.com` is served by a **new, separate Worker** (`ariadnev-bridge`), and
`vcskill.vchun.dev` **302s** to it via a source-controlled Cloudflare Single
Redirect. Neither change touches the four frozen legacy files, and neither
changes `topology.json`'s `selected: candidate-b`.

## Why this was urgent, not a preference

`ariadnev@1.0.0` shipped and **could not be installed**. `install.sh:10` and
`install.ps1` point at `https://ariadnev.com`, and
`packages/cli/src/cli/update-command.ts:9` hardcodes the same host as
`const DOMAIN` with **no environment override**. So the domain was not a
branding choice — fresh installs *and* `av update` on every already-installed
copy were broken until that host answered. Standing it up was the fix.

## Why a bridge instead of one line in the frozen `wrangler.toml`

Adding `ariadnev.com` to the legacy Worker's `routes` would have been one line.
It was rejected because the freeze protects three things, not just a file:

1. **The redeployable artifact.** Any edit to `wrangler.toml` requires a
   redeploy to take effect, and the rollback target is defined as the artifact
   currently deployed at `b93d9d2`.
2. **The binding map.** `topology.json`'s `firstCutover.restoresLegacyBinding`
   exists to restore the captured legacy custom-domain and route bindings.
   Adding a route mutates the very map that mechanism restores.
3. **The credential namespace.** `credentialMutationFrozenUntil:
   rollback-window-close` forbids writing the legacy Worker's secrets. A shared
   Worker would have shared its `GH_TOKEN`.

The bridge is additive: a separate Worker, a separate secret namespace, and no
deploy against `vcskill`. `wrangler deployments list --name vcskill` still shows
`b93d9d2` after every step of this work.

## The rename-redirect invariant — load-bearing today

The frozen `worker.js:11` hardcodes `REPO = "bavanchun/vcskill"`. That repository
was renamed to `bavanchun/ariadnev-kit`; the legacy Worker keeps functioning
**only because GitHub serves a rename redirect**.

This was confirmed by observation, not assumed. With the redirect rule
temporarily removed, `https://vcskill.vchun.dev/version` answered
`ariadnev@1.0.0` — a tag that exists only in the *renamed* repository. The
frozen Worker is reaching `ariadnev-kit` through the rename redirect right now.

> **Never create a repository named `bavanchun/vcskill`** until the legacy
> Worker is decommissioned. Creating it would break GitHub's rename redirect and
> take the rollback target down.

The bridge deliberately does **not** inherit this dependency: it names
`bavanchun/ariadnev-kit` directly.

### Known-broken legacy behavior the redirect now masks

That same probe shows `vcskill.vchun.dev/version` returns `ariadnev@1.0.0`
rather than `1.0.0`, because the frozen Worker strips `^vcskill@`, which no
longer matches the renamed tag. This is **not** worth unfreezing a file to fix:

- The redirect now shadows the legacy host, so nothing reaches it in normal use.
- `update-command.ts:26` strips `^ariadnev@` itself, so the value parses
  correctly even unstripped.
- The bridge strips `^ariadnev@`, so the canonical host is already correct.

Recorded so a future reader does not mistake it for a regression introduced here.

## What "rollback" does and does not restore

**The frozen legacy Worker is a routing rollback target, not a serving-correctness
rollback target.** This distinction is easy to lose and expensive to rediscover.

`--remove` restores *reachability* of `vcskill.vchun.dev`. It does not restore
working installs from it, because the pre-cutover state was already broken for
1.0.0 — that is this plan's premise, not a side effect of it. Verified:

```
/download/vcskill-darwin-arm64  → 404
/download/vcskill-linux-x64     → 404
/download/ariadnev-darwin-arm64 → 200
```

The `ariadnev@1.0.0` release publishes only `ariadnev-*` assets. Any pre-rename
`vcskill` 0.11.x client whose self-update computes `vcskill-<os>-<arch>` was
broken by the **rename itself**, redirect or no redirect; its only path forward
is a manual reinstall from `https://ariadnev.com/install`.

The practical consequence: redirect rollback protects the *legacy host binding*,
but correct installs depend on the bridge staying up. Treat the bridge as
production, not as scaffolding.

## Measured: a Single Redirect beats a Workers Custom Domain

Cloudflare documents the Rules execution order but **does not state** how a
dynamic redirect interacts with a hostname bound by a Workers Custom Domain, and
this repository had no evidence either — `edge-routing-topology.md` still lists
the ingress guard as an open gate, and the failing traversal rows in
`edge-routing-reprobe.json` failed precisely because no zone rule had ever been
applied. The whole rollback story ("delete one rule, legacy resumes instantly")
rested on this, so it was measured.

**Result, 2026-08-16 — the redirect wins.**

| Probe | Result |
|---|---|
| `curl -sSI https://vcskill.vchun.dev/install`, immediately after `--apply` | `200` (Worker served) |
| Same probe at **t+15s** | `302`, `location: https://ariadnev.com/install` |
| `/download/checksums.txt?x=1&y=2` | `302`, query preserved verbatim |
| `curl -sSL …/version` | 1 redirect, final `https://ariadnev.com/version`, `200` |
| `--remove`, then re-probe | `200` direct from the frozen Worker within ~8s |
| `--apply`, then re-probe | `302` restored within ~8s |

**The first probe returned 200 and that was a false positive.** Propagation had
not completed. The plan's pre-decided triage order — rule out propagation, then
rule out an expression bug, and only then conclude the assumption failed —
is what prevented a wrong conclusion and a premature stop.

### Scope of this finding — do not overclaim it

Measured configuration: a rule in the **`http_request_dynamic_redirect`** phase
on zone `vchun.dev`, against a hostname bound by a **Workers Custom Domain**
(`wrangler.toml:8`, `custom_domain = true`).

- **Holds:** redirect-phase rules on a Custom-Domain-bound hostname in this zone.
- **Not tested:** other ruleset phases; other zones; cross-zone rules.
- **Propagation is not instant.** ~8–15s in every observation. Any future probe
  must retry before concluding a rule is ineffective.

> **Phase 12 must re-probe.** This measurement covers **Custom Domains only**.
> `workers/edge/wrangler.combined.production.toml:24` is `routes = []` with
> "Phase 12 owns attaching `vcskill.vchun.dev`", so the binding type at cutover
> is still undecided and may be a **route pattern** instead. Cloudflare's
> published traffic sequence puts redirect rules before Workers generally, but
> that is documented belief, not this repository's measurement. If the binding
> type changes, re-run one curl before treating the redirect as authoritative:
>
> ```sh
> curl -sSI https://vcskill.vchun.dev/install | head -3   # expect 302, retry ~15s
> ```

Two things Phase 12 does **not** need to re-derive: the rule's target
(`concat("https://ariadnev.com", …)`) is owner-agnostic, so moving `ariadnev.com`
from the bridge to the combined Worker requires no change to the rule and no
re-validation of ordering. Only a change to the *legacy* host's binding does.

**Traffic shadow.** While the rule is active, the frozen Worker receives
essentially no legacy-host traffic. Its silence is not evidence it can be
decommissioned, and conversely the freeze is passively protected.

## 302, not 301

A `301` caches indefinitely in browsers and intermediaries and **cannot be
recalled**, which would partially defeat a rollback to `vcskill.vchun.dev`. curl
does not cache redirects, so machine clients are indifferent either way.

The flip to `301` is a deliberate, separate act: edit `status_code` in
`rules/legacy-host-redirect.json` and re-run `--apply`, **only after the
rollback window closes**. The manager compares that field exactly, so the change
registers as drift rather than a silent no-op.

## Lifetimes — these two things retire at different times

This is the distinction most likely to be lost:

| Artifact | Retires at | What happens |
|---|---|---|
| `workers/bridge/` | **Phase 12 cutover** | Deleted. `ariadnev.com` moves to `vcskill-edge-combined`. |
| `rules/legacy-host-redirect.json` | **legacy decommission** | Survives Phase 12. Flips 302 → 301 after the rollback window closes. |

The redirect policy is filed under `rules/` rather than `workers/bridge/` for
exactly this reason: filing it under the bridge would miscode its lifetime and
drag it into that deletion.

At Phase 12, delete `workers/bridge/`, remove `workers/bridge` from
`pnpm-workspace.yaml` and the `test:native` list, and drop the `interim.host`
block from `topology.json` — but keep `interim.legacyHostRedirect`.

## Operator runbook

The redirect manager reads `CLOUDFLARE_API_TOKEN` from the environment and never
prints it; `Bearer` tokens, zone ids, and API URLs are redacted from every error
path.

**Required token permission: Zone → Single Redirect → Edit** on `vchun.dev`.
This is confirmed by an actual successful write, not inferred from a probe — an
earlier validation-error response proved authentication only, because the
request was rejected during body validation before phase-scoped permission was
ever checked.

```sh
# Read-only. Default mode. Exits 2 on drift, so it works as a CI gate.
CLOUDFLARE_API_TOKEN=… node scripts/manage-legacy-host-redirect.mjs --inspect

# Reconcile the zone to the policy. Idempotent: a second run is a no-op.
CLOUDFLARE_API_TOKEN=… node scripts/manage-legacy-host-redirect.mjs --apply

# Instant rollback. Legacy resumes serving directly in ~8s. No deploy involved.
CLOUDFLARE_API_TOKEN=… node scripts/manage-legacy-host-redirect.mjs --remove
```

Store the token in a mode-600 file outside the repository and pass it at call
time. Never commit it, and never paste it into a chat transcript — a pasted
token must be treated as compromised and rotated.

### Two things the drift check cannot see

`--inspect` compares `action_parameters` as a **recursive subset over declared
keys**, not as a strict deep-equal. This is deliberate: Cloudflare re-serializes
`action_parameters` with its keys in its own order and may add server-side
defaults, and a strict comparison reported drift on a rule that matched exactly —
`--inspect` exited 2 forever and `--apply` re-PUT on every run. **Do not "fix"
this back to a strict compare.** Every key the policy declares, including
`status_code`, is still compared exactly.

Its blind spots:

1. **A dashboard edit to the rule's `description`** makes the rule invisible to
   `locateRule`, and the next `--apply` creates a *second* redirect rule. The
   tell is `preservedRuleCount` in the outcome: this policy expects to own the
   only rule on this zone, so any nonzero count deserves a look.
2. **Structural comparison is churn detection, not correctness.** The
   authoritative check is always the live probe — `302` plus the expected
   `location` header.

The bridge's own secret is set the same way, without echoing the value:

```sh
cat <token-file> | npx wrangler secret put GH_TOKEN --config workers/bridge/wrangler.toml
```

Deploy the bridge **before** setting its secret. `wrangler secret put` against a
Worker that does not exist yet prompts interactively to create a draft, which a
piped stdin cannot answer. Deploying first costs a few seconds of fail-closed
`500` on a hostname nothing points at yet.

## In-Worker asset validation, and what it cannot cover

`ariadnev.com` has **no zone ingress rule**, so the bridge validates asset names
itself with the pure `assertSafeAssetName` reused from `workers/edge`. It decodes
exactly one layer of percent-encoding **before** validating — the validator
rejects residual `%xx` as `asset-double-encoded`, so validating first would
over-block the legitimate `/download/checksums%2Etxt` form.

A measurement worth recording, because Phase 12 will otherwise re-derive it:
**literal RFC 3986 dot segments are collapsed before any handler reads the
path** — by Cloudflare, and by the WHATWG URL parser. Consequently two entries in
`raw-download-path-guard.json`'s `mustBlock` list (`/download/./checksums.txt`
and `/download/nested/../checksums.txt`) arrive already normalized to
`/download/checksums.txt`, which is itself a `mustAllow` entry. **No in-Worker
check can distinguish them.** This is consistent with that policy's own
rationale, which says in-Worker validation cannot observe raw forms — that is
why the zone rule exists for candidate-b.

What the Worker does cover, verified live against the deployed bridge: the
percent-encoded family that survives normalization (`%2e%2e%2f`, `sub%2F`),
double-encoding, `%00`, CRLF `content-disposition` injection, overlong UTF-8, and
leading-dot names — all `400`, with zero upstream calls.

## Newly unblocked, deliberately not acted on

`edge-routing-topology.md` lists the raw dot-segment ingress guard as **blocked**
on a Cloudflare API token with Zone → WAF → Edit. A working zone-scoped token now
exists. Applying that guard is candidate-b work outside this plan's scope and was
left alone; the gate is simply no longer credential-blocked.

## Open risk

The legacy Worker's `GH_TOKEN` PAT expiry is **unknown** and not readable via the
API. If it expires inside the rollback window, the rollback target fails closed
with `502`. A decision-recorded manual secret renewal is the one place the
freeze's letter yields to its intent — the freeze exists to keep the rollback
target working, and an expired credential defeats that.

## What has *not* happened

Production `vcskill.vchun.dev` still runs the frozen legacy Worker behind the
redirect. Candidate-b has not shipped, `selected` is unchanged, and the Phase 12
cutover remains outstanding.
