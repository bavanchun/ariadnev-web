# Qualification evidence — 2026-08-19

## Candidate

- Qualified product commit: `8013949b66ed09a9c9c0e816c9f0e0151046a182`.
- Qualification evidence commit: the commit that first adds this record.
- Scope: Astro marketing M01-M02 and static Next/Fumadocs D00-D18.
- Publication state: not deployed; no deployment input or external mutation was
  created during qualification.

The evidence commit is intentionally a descendant of the product commit. It
contains verification-only documentation and the Lighthouse harness repair;
it does not change the product bytes selected above.

## Automated qualification

`pnpm run test:qualification` passed from freshly generated production output
at the qualified product commit:

| Gate | Result |
|---|---|
| Public/contracts suite | 85 passed |
| Typecheck and production builds | Passed; docs generated 447 HTML pages |
| Native Node tests | 215 passed |
| Docs Node tests | 172 passed |
| Vitest suites | 180 passed |
| No-JS browser shell | Passed, including EN/VI, versioning, search, copy fallbacks, axe, and JS-disabled locale routing |
| Chromium visual/semantic suite | 148 passed |
| Firefox critical journeys | 5 passed |
| WebKit critical journeys | 5 passed |

An immediate unchanged `pnpm run test:visual` then passed a second time with
the same 148 Chromium, 5 Firefox, and 5 WebKit results. No source, browser, or
baseline changed between these two visual runs.

The dedicated 390px compact probe passed for all 22 manifest fixtures (M01,
M02, D00-D18, including D01-vi). Each fixture proved the expected HTTP status,
document-level overflow containment, a first keyboard focus target intersecting
the viewport, and a visible focus outline. The wider visual matrix continued to
cover 320, 375, 768, 1280, and 1440 where declared.

## Lighthouse

`pnpm run test:visual:lighthouse` passed after declaring its direct
`chrome-launcher` dependency. Lighthouse cannot score a non-2xx document, so
the runner audits the exact generated D18 `404.html` artifact with status 200;
the critical journey separately proves that an unknown public docs URL serves
the same recovery surface with a real 404 response.

| Surface | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| M01 marketing home | 100 | 100 | 100 | 100 |
| D01-vi docs home | 100 | 100 | 100 | 100 |
| D06 graph execution | 100 | 98 | 100 | 100 |
| D12 CLI index | 100 | 98 | 100 | 100 |
| D14 provider reference | 100 | 100 | 100 | 100 |
| D18 recovery artifact | 100 | 100 | 100 | 63 |

All six surfaces exceed the frozen accessibility threshold of 95. The lower
D18 SEO score is expected for a recovery artifact and is not a release gate.

## Budget and generated-authority evidence

- Tightest docs route during final qualification: 304,766 bytes against the
  unchanged 308,000-byte cap. The dated reconciliation measurement was 304,768
  bytes; both are beneath the same cap.
- Docs walker: 444 enumerable routes, zero grandfathered routes.
- Search Brotli bytes, EN stable/current/previous: 117,115 / 117,353 / 33,926.
- Search Brotli bytes, VI stable/current/previous: 112,028 / 112,267 / 35,175.
- Static output reconciliation: 2,715 files, 447 `index.html` routes,
  45,460,845 bytes.
- Generated content, search isolation, Markdown discovery, release authority,
  static routes, locale/version partitions, and real 404 contracts all passed.
- No performance cap, search cap, ratchet, grandfather list, route contract,
  or deployment topology changed during qualification.

## Asset, baseline, and visual review

The immutable brand-asset contract passed for all six entries in
`tests/benchmarks/brand-asset-checksums.json`: distinct site/docs logos, shared
favicons, and site/docs touch icons retained their exact path, byte count,
dimensions, aspect ratio, and SHA-256 digest. CSS presentation tests also
confirmed no filter, crop, glow, or recolor was introduced.

Baseline ownership was reviewed by phase rather than accepted wholesale:

- Phase 3 owns M01-M02.
- Phase 4 owns D00-D11 and D18.
- Phase 5 owns D12-D17, including the new D13 command dossier.

The final human review inspected compact and desktop logo zones plus temporary
logo-hidden captures for M01 desktop/mobile, D06 desktop, and D01-vi mobile.
Marketing and docs remain recognizable as one system through mono/sans type,
square state shapes, cobalt interaction semantics, warm reading fields, dark
instrument fields, and shared border/grid rhythm. M01's first mobile viewport
states purpose and next actions without decorative delay. Vietnamese accents,
line height, and navigation labels remain legible. Dark/light transitions are
intentional, and no gradient text, frosted glass, broad blur, ambient glow,
generic bento wall, or pill-by-default grammar survived unintentionally.

## Harness and process review

- The shared screenshot helper waits on network idle and `document.fonts.ready`;
  it contains no arbitrary sleep.
- Visual servers remained fixed to loopback ports 4331/4332.
- The full qualification order is contracts/content, typecheck, build, native
  and docs tests, no-JS browser checks, then visual checks.
- Lighthouse exposed two harness defects: an undeclared direct dependency and
  an unscorable 404 URL. Both were repaired without changing public 404
  behavior, and the six-surface run then passed.
- Ports 4331/4332 were free after each managed run. No server, watcher, browser,
  or Lighthouse process started by qualification remained active.

## Review disposition

Direct review found no unresolved correctness, accessibility, contract,
security, or scope issue. Deployment files and production state were not
modified. Publication remains blocked only on a separate explicit ship
authorization and the live identities required by the existing deployment and
rollback contracts.
