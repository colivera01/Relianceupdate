# Epic 3 Phase A Final Security Gate Review

**Review date:** August 3, 2026  
**Repository:** `C:\Users\Cesar Olivera\Project Reliance`  
**Branch:** `cursor-latest-build`  
**Reviewed commit:** `012a3b2be35d73ee1e4ff5027c99b0a141d2afb4`  
**Scope:** Evidence-only security and Azure packaging review. No dependency, application, deployment, database, checklist, or frozen-document changes were made.

## Executive Decision

The remaining High package findings do not currently establish a remotely exploitable High vulnerability in the Reliance beta runtime. The review found:

- no High finding classified as **Runtime exploitable** in the current architecture;
- two package nodes classified as **Configuration dependent** (`axios` and the aggregate `next` finding);
- nine package nodes classified as **Build-time only**;
- three package nodes classified as **Development/test tooling only** when the full audit is considered; and
- four package nodes classified as **Not reachable with current production architecture**.

Epic 3 Phase A is nevertheless **not ready for a clean beta deployment** until the deployment package is corrected. The current Next.js standalone output contains a root `.env`, the local packaging utility copies the entire standalone tree, and two recent local beta ZIPs were verified to contain `.env`. This is a packaging and secret-handling release blocker, independent of the remaining High advisories.

No dependency upgrade is authorized or performed by this review.

## Review Method

The classification is based on all of the following, not only `npm audit` labels:

1. Direct and transitive dependency paths from `npm ls`.
2. Active imports and call sites in executable Reliance code.
3. Beta Azure App Service configuration names and non-secret runtime settings.
4. Contents and dependency directories in `.next/standalone`.
5. Next.js output-file-tracing manifests (`*.nft.json`).
6. Package vulnerability mechanics from the current advisory feed.
7. Current configuration and reachable inputs.
8. The untracked local package-construction utility used for recent beta packages.

No secret value, environment-file content, connection string, token, OTP, private key, or customer data was read into this report.

## Audit Snapshot

### Production-oriented audit

Command: `npm audit --omit=dev --json`

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 17 |
| Moderate | 7 |
| Low | 1 |
| Total | 25 |

The command still reports some package nodes declared as development dependencies, including Playwright. The deployment classification below therefore also verifies whether each package is present in the generated standalone runtime and whether executable production code imports it.

### Full dependency-tree audit

Command: `npm audit --json`

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 18 |
| Moderate | 7 |
| Low | 2 |
| Total | 28 |

The additional High is `vite`, reached through `vitest`. The Critical is `vitest`. Both are development/test tooling, are absent from `.next/standalone`, and are not imported by application code. The repository invokes Vitest with `vitest run` or its non-UI watch mode; no Vitest UI-server command was found. This is not a beta runtime finding, but development tooling should be upgraded in a separately approved checkpoint and its UI server must not be exposed to an untrusted network.

## Required Classification

Each remaining High package node is assigned exactly one requested category.

| Package | Installed path/version | Classification | Current Reliance evidence | Private-beta effect |
|---|---|---|---|---|
| `@playwright/test` | Direct dev dependency `1.52.0` | **Development/test tooling only** | Imported only by `e2e/**` and the Playwright test runner. Absent from `.next/standalone`. | Does not block runtime deployment. Upgrade in a separate test-tool checkpoint. |
| `playwright` | Transitive from `@playwright/test`, `1.52.0` | **Development/test tooling only** | Browser-download advisory applies to test browser installation. No production import; absent from standalone output. | Does not block runtime deployment. Do not install test browsers on the production host. |
| `vite` | Transitive from `vitest`, `7.3.2` | **Development/test tooling only** | The High finding concerns Vite development-server file serving on Windows. Reliance beta runs Next.js on Azure Linux; Vite is absent from standalone output. | Does not block runtime deployment. Do not expose local Vite/Vitest servers. |
| `prisma` | Direct dependency `6.19.0` | **Build-time only** | Used by `postinstall`, migration, generation, and Studio commands. Runtime application data access uses generated `@prisma/client`; Prisma CLI is absent from standalone output. | Does not block runtime deployment. Moving CLI-only Prisma to development dependencies can be considered separately. |
| `@prisma/config` | Via `prisma`, `6.19.0` | **Build-time only** | Prisma CLI configuration dependency; no application import and absent from standalone output. | Does not block runtime deployment. |
| `effect` | Via `@prisma/config`, `3.18.4` | **Build-time only** | Finding concerns Effect fiber/RPC context. Reliance does not import Effect; path is Prisma CLI configuration and absent from standalone output. | Does not block runtime deployment. |
| `defu` | Via Prisma `c12`, `6.1.4` | **Build-time only** | Prototype-pollution finding is on Prisma configuration loading. Reliance does not import `defu`; package is absent from standalone output. | Does not block runtime deployment. |
| `brace-expansion` | Via Tailwind/Sucrase/Glob; dev Nodemon also has an older copy | **Build-time only** | Vulnerable expansion is used by build/dev globbing. No request-time import; absent from standalone output. | Does not block runtime deployment. Do not apply user-controlled patterns to build tools. |
| `glob` | Via Tailwind/Sucrase, `10.4.5` | **Build-time only** | Advisory is command injection through the Glob CLI `--cmd` option. Reliance does not invoke Glob CLI with user input; absent from standalone output. | Does not block runtime deployment. |
| `minimatch` | Via Glob/Tailwind, `9.0.5`; a dev Nodemon copy also exists | **Build-time only** | ReDoS requires attacker-controlled glob patterns. Reliance does not accept patterns for this build dependency at runtime; absent from standalone output. | Does not block runtime deployment. |
| `picomatch` | Via Tailwind build chain and dev tooling, affected copy `2.3.1` | **Build-time only** | ReDoS requires attacker-controlled extglob patterns. No production request path supplies patterns to this package; absent from standalone output. | Does not block runtime deployment. |
| `postcss` | Via Next `8.4.31` and Tailwind `8.5.5` | **Build-time only** | Findings require processing attacker-controlled CSS/source-map comments. Reliance compiles repository CSS during `next build`; it does not offer runtime CSS compilation or accept uploaded CSS. `postcss` is traced in standalone as a framework dependency, but no active request handler processes customer CSS. | Does not block runtime deployment under the present architecture. Reassess if runtime CSS processing is introduced. |
| `axios` | Via `twilio@5.13.1`, installed `1.15.0` | **Configuration dependent** | Twilio is imported by the SMS adapter, but beta is configured with `SMS_PROVIDER=telnyx` and dispatches Telnyx through native `fetch`. Axios risk becomes reachable only if the Twilio branch is selected; several findings also depend on proxy configuration or polluted Axios options. | Does not block the current Telnyx-configured beta. Must be remediated before enabling Twilio, and after any proxy configuration change. |
| `form-data` | Via Axios, `4.0.5` | **Not reachable with current production architecture** | The vulnerable operation is multipart field/filename construction. Reliance's Twilio SMS branch sends Twilio message fields and does not construct attacker-controlled multipart uploads. The selected Telnyx branch does not use this package. | Does not block current beta. Reassess if Twilio multipart functionality or direct FormData use is added. |
| `fast-xml-builder` | Via Azure Blob SDK XML stack, `1.1.4` | **Not reachable with current production architecture** | Azure Blob storage is active, but Reliance uses upload/download/properties/delete/SAS methods with server-generated blob keys and fixed metadata keys. No batch/XML-building operation or attacker-defined XML attribute name is called. The advisory concerns XML attribute construction. | Does not block current beta. Reassess if Azure batch operations or user-defined XML/metadata structures are introduced. |
| `lodash` | Via `recharts`, `4.17.21` | **Not reachable with current production architecture** | Recharts imports `lodash/omit`; no `lodash/template` reference was found. Recharts supplies static omit paths rather than customer-controlled paths. The charts are bundled UI code, not a server template service. | Does not block current beta. Reassess if user-controlled property paths or Lodash templates are introduced. |
| `sharp` | Optional Next dependency, `0.34.5` | **Not reachable with current production architecture** | No `next/image` import or custom image optimizer call was found. `next.config.js` defines no remote image sources. User media remains in Azure Blob Storage and is not written into the immutable `public` directory. An external actor therefore cannot provide Sharp with a crafted image through the current optimizer configuration. | Does not block current beta. Becomes a blocker before allowing remote/user-uploaded sources through Next image optimization. |
| `next` | Direct `15.5.21`; audit node aggregates `postcss` and `sharp` | **Configuration dependent** | The current High node has no separate direct Next core advisory; it aggregates the PostCSS and Sharp paths above. PostCSS is build-only and Sharp lacks an untrusted image source under current configuration. | Does not block current architecture on advisory reachability alone. Any runtime CSS processor or remote/user image optimizer configuration requires a new review. |

### Runtime-exploitable High findings

**None demonstrated in the current Reliance production architecture.**

Accordingly, there is no Runtime-exploitable row for which an attack surface, immediate dependency remediation, and regression scope must be prescribed. This conclusion is configuration-specific and must be revisited if Twilio, remote Next image sources, runtime CSS processing, Azure XML/batch operations, or user-controlled glob/template inputs are introduced.

## Azure Deployment Review

### Current App Service model

Read-only Azure CLI inspection established:

- App Service: `app-reliance-beta-wcus`
- Resource group: `rg-reliance-beta-eastus`
- Runtime: `NODE|22-lts`
- Startup command: `node server.js`
- `alwaysOn`: enabled
- minimum TLS: `1.2`
- `SCM_DO_BUILD_DURING_DEPLOYMENT`: `false`
- `WEBSITE_RUN_FROM_PACKAGE`: present and configured as a remote URL
- deployed metadata: package `reliance-beta-08de960-epic1-operational-closeout-202608021730.zip`, commit `08de960c768463f2fea7c407d7bb39e6dcfacb3b`

Microsoft documents that `WEBSITE_RUN_FROM_PACKAGE` mounts the supplied ZIP as read-only `wwwroot`; Azure does not filter its contents. Therefore every file placed in the ZIP becomes part of the mounted application package. See [Run your app from a ZIP package](https://learn.microsoft.com/azure/app-service/deploy-run-package).

No tracked GitHub Actions workflow or tracked deployment/package script was found. Current package creation is represented by untracked local tooling and local package evidence, so the deployment process is not reproducible or reviewable from the committed repository.

### Why `.env` appears in standalone output

The cause is a four-step chain:

1. Next.js automatically loads project-root `.env*` files. Next warns that these files should not be committed. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).
2. Next standalone output uses output-file tracing to copy files that static analysis determines might be needed by the server. See [Next.js standalone output](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output).
3. Reliance route tracing manifests contain references to the project-root `.env`. Some manifests also reference `.env` files in old local `tmp/deploy-*` directories. The generated `.next/standalone` root currently contains `.env`, `tmp`, and `src` in addition to the runtime server.
4. The untracked local `tmp-create-beta-package.py` recursively copies the entire `.next/standalone` tree. Its skip list excludes only selected root directories and does not exclude `.env`; it is not an allow-list.

Evidence observed without opening environment contents:

- `.next/standalone/.env` exists.
- Two recent local beta ZIPs contain a root `.env` entry:
  - `reliance-beta-046b0da-20260726.zip`
  - `reliance-beta-dd56681-20260725-013044.zip`
- An earlier July 22 package checked in the same manner did not contain `.env`.

The currently mounted remote package was not unpacked or its `.env` read during this review. Its exact `.env` entry status is therefore **unable to verify from the current implementation evidence gathered here**. The raw standalone output and packaging utility are sufficient to prove that a new package built by this path is unsafe unless corrected.

## Safest Packaging Strategy

Use a committed, deterministic **allow-list package builder** operating from a clean checkout or clean CI workspace.

### Required process

1. Build in a clean workspace with deployment secrets supplied only as process environment variables or Azure App Settings, not a repository `.env` file.
2. Create an empty staging directory outside the repository and outside `.next/standalone`.
3. Copy only approved runtime roots from standalone:
   - `server.js`
   - `package.json`
   - `node_modules/**`
   - `.next/server/**`
   - `.next/BUILD_ID`
   - the required `.next/*.json` runtime manifests
   - `.next/static/**`
   - `public/**`
4. Do not copy standalone root `.env*`, `tmp/**`, `src/**`, `.next/cache/**`, source maps unless explicitly required, test output, reports, local ZIPs, logs, Git metadata, or deployment helper files.
5. Fail packaging if any entry matches a forbidden-secret rule, including:
   - `.env` or `.env.*`
   - private key/certificate extensions not explicitly approved
   - connection-string dumps
   - SAS-bearing metadata files
   - common secret/token filenames
6. Fail packaging if required runtime entries are missing.
7. Produce a sorted package manifest containing paths, sizes, and SHA-256 hashes, but no file contents.
8. Verify the ZIP itself after creation; do not trust only the staging directory.
9. Start the exact ZIP locally and run route, authorization, image, storage, and notification smoke tests.
10. Store runtime secrets only in Azure App Settings or a later approved managed-secret service. Prefer managed identity over long-lived SAS package URLs where deployment architecture permits.

### Why allow-list is safer

A deny-list assumes every future generated or local file name is known. The current output demonstrates why that fails: output tracing copied both a root `.env` and historical `tmp/deploy-*` paths. An allow-list constrains the package to known runtime artifacts and fails closed when the build shape changes.

### Secret-response precaution

After deploying a verified clean package, rotate credentials that may have existed in any package containing `.env`, particularly database, storage, authentication-session, notification-provider, AI-provider, beta-gate, worker, and device-pairing secrets. Rotation should be planned to avoid invalidating active sessions or operational links without notice. Do not log old or new values.

## Security Gate Decision

| Gate | Result |
|---|---|
| Remaining High advisories classified | **Pass** |
| Demonstrated Runtime-exploitable High finding | **None** |
| Critical runtime advisory | **None in production-oriented audit** |
| Full-tree test-tool Critical documented | **Yes: Vitest, development/test only** |
| Azure runtime model verified | **Pass** |
| Standalone `.env` cause identified | **Pass** |
| Current packaging safe for another deployment | **Fail** |
| Epic 3 Phase A ready for clean beta deployment | **No** |

The blocker is narrowly defined: create and validate a committed allow-list package builder, generate a clean package, confirm no `.env` or secret-bearing artifacts are present, deploy only after Product Owner approval, and rotate potentially exposed packaged secrets in a controlled sequence.

## Recommended Next Approval Checkpoint

Authorize a narrowly scoped **Azure Allow-List Packaging Correction**. It should change only deployment/package tooling and its tests, not application behavior or dependencies. Required evidence should include:

- deterministic package manifest;
- forbidden-file scanner results;
- ZIP entry verification;
- local startup of the exact ZIP;
- focused Epic 1, Epic 2, and Epic 3 Phase A smoke tests against that ZIP;
- Azure packaging rollback procedure;
- secret-rotation plan;
- confirmation that no raw environment file is mounted.

Do not begin Epic 3 Phase B or another dependency upgrade as part of that correction.

## Commands and Inspections Performed

- `git status --short`
- Azure App Service configuration and app-setting-name inspection through Azure CLI
- `npm audit --json`
- `npm audit --omit=dev --json`
- `npm ls ... --all --omit=optional`
- active source import and call-site searches
- standalone runtime package-presence checks
- Next image-configuration and import checks
- Next output-file-tracing manifest inspection
- name-only inspection of `.next/standalone` and selected local beta ZIP entries
- tracked deployment-workflow search

No tests, build, dependency installation, deployment, migration, or runtime behavior change was required or performed for this evidence-only review.

