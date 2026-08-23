# 🔒 Security Assessment Report — Design Phase

## Document Information

| Field | Value |
|-------|-------|
| Project | AI Chat Assistant (SA4E) — Slash Commands (Tier 1), SA4E-191 |
| Scope | Design-phase security review of BRD.md, FSD.md, TDD.md (no source code yet) |
| Date | 2026-08-23 |
| Assessor | Security Agent (static design review) |
| Version | 1.0 |
| Artifacts Reviewed | documents/SA4E-191/BRD.md, documents/SA4E-191/FSD.md, documents/SA4E-191/TDD.md |

---

## 1. Scope & Methodology

This is a **design-phase** (pre-implementation) security assessment. No source code was available; findings are derived from the Business Requirements Document (BRD), Functional Specification Document (FSD), and Technical Design Document (TDD) for SA4E-191. The review treats the three documents as the authoritative threat model and identifies security gaps that must be closed **before** the implementation checklist (TDD §9) is executed.

### 1.1 Reviewed Artifacts
- **BRD.md** — business scope, 7 commands, owner-only requirement (§2.3 US-06/US-07), dependencies SA4E-182/183/186 (§3), NFR-03 security (§6).
- **FSD.md** — functional API contracts per command (§3.x.7), consolidated business rules BR-1..BR-7 (§3.8), technical integration (§5.4), security requirements (§7), audit trail (§7.3).
- **TDD.md** — `CommandRegistry.dispatch` (§2.3), `ChatSessionSnapshot` (§2.1), adapter contracts (§6.1), handler pseudocode (§6.3–6.5), module/file map (§3.1, §9), backend `slash-command` module (§3.1 #20).

### 1.2 OWASP Top 10 (2021) Mapping Approach
Each design element was mapped against the OWASP categories: **A01 Broken Access Control** (owner-only, IDOR, backend endpoints), **A03 Injection** (argument/command injection, prompt injection), **A04 Insecure Design** (missing trust boundaries, abuse/cost controls), **A05 Security Misconfiguration** (backend endpoint hardening), **A08 Software & Data Integrity Failures** (dependency trust, audit integrity), **A09 Logging & Monitoring Failures** (PII/secret leakage, tamperability). Categories not triggered (A02 crypto, A06 components, A07 auth, A10 SSRF) are noted as "not applicable at design stage" where relevant.

### 1.3 Threat Context
This is an **AI chat assistant** running inside a VS Code extension webview with a Node/TS backend (TDD §1.1). It provides a command surface that (a) mutates **session state** (`/agents`, `/models`, `/new`, `/compact`), (b) reads and reverts **files on disk** (`/diff`, `/undo`), and (c) spawns **LLM-powered agents** (`/review`). The feature consumes three external engines (SA4E-182 compaction, SA4E-183 file-change tracking, SA4E-186 agent routing) and persists audit events to a backend. The combination of **file write**, **arbitrary engine invocation**, and **client-held identity** makes the trust-boundary placement the central security question of this design.

---

## 2. Security-Relevant System Summary

**Authentication / Session.** An authenticated session is assumed pre-existing (BRD §1.3). Identity is modeled as `ChatSessionSnapshot { id, userId, ownerId, activeAgentId, activeModelId, contextRef, historyRef }` (TDD §2.1), held in a **client-side Svelte `sessionStore`** (TDD §3.1, §5.1). There is no server-side session object owned by the slash-command feature itself.

**Command Dispatch.** A single `CommandRegistry.dispatch(ctx)` (TDD §2.3) centralizes cross-cutting controls: owner-only check (`descriptor.requiresOwner && ctx.session.userId !== ctx.session.ownerId`), token-bucket rate limit (20/min/session), timeout, circuit breaker, and audit. All 7 handlers implement `CommandHandler.execute(ctx)`.

**Owner-Only Commands.** `/review` and `/undo` are registered with `requiresOwner: true` (FSD §3.6.7, §3.7.7; TDD §2.1). The check is performed **in the webview dispatch**; the UI also greys out the entries for non-owners. These commands perform the most sensitive actions: `/review` streams source diffs to an LLM agent; `/undo` can **revert files on disk**.

**Audit Logging.** One structured event per invocation is emitted from `dispatch` and handlers (FSD §3.9) and bridged via `slash:audit` to a backend module that "persists audit" (TDD §3.1 #20). Retention is 90 days (FSD §7.3, §8). Logged fields per spec: `event, userId, command, ts, target, status`.

**Integrations (trust boundaries).**
- **SA4E-186 (Agent Runtime Routing):** supplies `availableAgents` and resolves `review_agent`; called by `/agents` and `/review`.
- **SA4E-182 (Compaction):** returns `compactedSummaryRef` + summary content; called by `/compact`.
- **SA4E-183 (File Change Tracking):** returns `DiffEntry[]` (`filePath`, hashes, status) and accepts `revert(entry)`; called by `/diff` and `/undo`.

**Transport.** All engine calls are "in-process" (FSD §5.4, TDD §6.1) Webview → `MessageBridge.request(slash:*)` → Extension Host → backend `slash-command` module → engine. The backend module is described as exposing `slash:*` endpoints (TDD §3.1), but its authentication/authorization contract is unspecified.

---

## 3. Threat Model

### Attacker Profiles
1. **Malicious authenticated chat user (non-owner).** Goal: invoke `/review`/`/undo`, read other users' source via `/diff`, or revert files they should not control. Leverages any gap where owner enforcement is bypassable or where `filePath`/`sessionId` is attacker-influenced (IDOR).
2. **Compromised / tampering webview client.** Because identity (`userId`/`ownerId`) and the owner check live in the client Svelte store, a modified client can set `userId === ownerId` or forge `slash:*` bridge messages to the backend, bypassing UI-level protection.
3. **Compromised dependency (SA4E-182 / SA4E-183 / SA4E-186).** A malicious or buggy engine can return: a `filePath` with traversal/symlink (`/diff`, `/undo`), a poisoned compaction summary (prompt injection into future LLM turns), a malicious/forged `agent` id, or suppress/forge audit events.
4. **Network / cross-origin caller (if backend `slash:*` endpoints are network-reachable).** Could issue forged commands (CSRF / missing authn) if backend does not re-establish the principal from a server-side session.

### Trust Boundary Gaps (design-level)
- **TB-1:** Identity is asserted by the client, not derived from an authenticated server principal.
- **TB-2:** Engine outputs (SA4E-182/183/186) are consumed without validation/sandboxing.
- **TB-3:** File-system operations use externally-supplied `filePath` without canonicalization.
- **TB-4:** Audit is client-emitted and its integrity/secret-handling is unspecified.

---

## 4. Findings

| ID | Title | OWASP Category | Severity | Affected Design Element |
|----|-------|----------------|----------|--------------------------|
| SEC-1 | Owner-only `/review` & `/undo` enforced only in webview, not server-side | A01 Broken Access Control | High | TDD §2.3 dispatch; FSD §3.6.7/§3.7.7; TDD §3.1 #20 |
| SEC-2 | Command/argument injection via `/review` & `/agents` args | A03 Injection | High | TDD §6.4 (`branchName`→`VCS.getBranchDiff`); FSD §3.6.4; TDD §4.2 AgentsCommand |
| SEC-3 | Insecure file operations: path traversal / symlink in `/diff` read & `/undo` revert | A01 / A03 | High | FSD §4.2 DiffEntry.filePath; TDD §6.5 revert; SA4E-183 contract §5.4.3 |
| SEC-4 | Audit log integrity & source/PII leakage in logs | A09 / A08 | Medium | FSD §7.3, §3.9; TDD §3.1 #20; TDD §10.2 logs |
| SEC-5 | Unvalidated outputs from SA4E-182/183/186 (dependency trust) | A08 Software & Data Integrity | High | FSD §5.4; TDD §6.1 adapters; SA4E-186/182/183 contracts |
| SEC-6 | Backend `slash:*` endpoints lack specified authn/authz & CSRF protection | A01 / A05 | High | TDD §3.1 #20, §6.1; FSD §7.1 |
| SEC-7 | Abuse / rate-limiting / LLM cost & resource exhaustion | A04 Insecure Design | Medium | FSD §3.6.7/§3.2.7 rate limit; TDD §10.1 NFR-07-T |
| SEC-8 | Missing input schema validation / prototype-pollution & mass-assignment | A04 / A03 | Low | TDD §2.1 `args: Record<string,unknown>`; FSD §3.x.4 |
| SEC-9 | Error messages may leak internal detail to UI/logs | A09 | Low | TDD §2.3 `fail(..., (err as Error).message)`; FSD §3.9 |

### Finding SEC-1 — Owner-only not enforced server-side (Broken Access Control)
**Severity:** High | **OWASP:** A01
**Description:** `requiresOwner` is checked inside `CommandRegistry.dispatch` (TDD §2.3) using `ctx.session.userId !== ctx.session.ownerId`. Both values originate from the **client-side Svelte `sessionStore`** (TDD §5.1). A tampering client can set them equal, or forge a `slash:review`/`slash:undo:revert` bridge message to the backend, passing the owner check. The backend `slash-command` module (TDD §3.1 #20) is described only as a "consumer of SA4E-182/183/186" and "persists audit" — it is **not specified to re-validate** that the authenticated principal is the session owner. Without server-side enforcement, owner-only protection is cosmetic against a motivated attacker. This can escalate to **Critical** if the backend endpoint performs the file revert / agent dispatch without re-checking ownership.
**Affected Design Element:** TDD §2.3 `dispatch`; FSD §3.6.7/§3.7.7 (`requiresOwner=true`); TDD §3.1 #20.
**Recommendation:** Make the backend the trust anchor. Derive `ownerId` from the authenticated session token server-side; never accept `userId`/`ownerId` from the client payload. Re-run the `requiresOwner` check in `SlashCommandModule` before invoking SA4E-183 `revert` or SA4E-186 `review_agent`. Keep the webview check only as UX convenience (defense-in-depth), not as the control.

### Finding SEC-2 — Argument / command injection via command args
**Severity:** High | **OWASP:** A03
**Description:** `/review` accepts `branchName` and `branchDiff` from `ctx.args` (TDD §6.4: `ctx.args.branchName as string ?? …`). `branchName` is passed to `VCS.getBranchDiff(ctx.args.branchName)`. If the VCS wrapper shells out to `git` with the branch name as an argument, a value such as `--upload-pack=…` or `; rm -rf` enables **argument/command injection**. Even with a library, an unsanitized branch name can confuse ref resolution. `branchDiff` (arbitrary source text) is fed to the review agent and streamed into chat → **indirect prompt injection** and potential stored XSS if rendered without escaping. `/agents selectedAgentId` and `/undo lastExchangeId` are likewise client-supplied and used in routing/lookup without a server-side allowlist.
**Affected Design Element:** TDD §6.4; FSD §3.6.4 (branchName/branchDiff validation only "Valid VCS branch"/"Non-empty diff"); TDD §4.2 AgentsCommand.
**Recommendation:** Validate `branchName` against `^[A-Za-z0-9._\/-]+$` (reject `--`, spaces, shell metacharacters); never interpolate into a shell — use a typed git API. Cap `branchDiff` size (e.g., 1 MB) and scan for prompt-injection markers before agent dispatch. Validate `selectedAgentId`/`lastExchangeId` against server-side allowlists (availableAgents, session history) rather than trusting client input.

### Finding SEC-3 — Insecure file operations (path traversal / symlink)
**Severity:** High | **OWASP:** A01/A03
**Description:** `/diff` displays and `/undo` **reverts** files whose `filePath` comes from SA4E-183 `DiffEntry` (FSD §4.2). The design specifies **no path canonicalization, no workspace-root allowlist, and no symlink resolution**. A `filePath` of `../../../../etc/passwd` (in `/diff`) could expose arbitrary file content; in `/undo revert`, a malicious or compromised SA4E-183 could supply a `filePath` outside the workspace or a symlink pointing to a sensitive file (e.g., SSH keys, `.env`), causing **arbitrary file overwrite**. Revert writes are high-impact (data destruction / RCE-adjacent).
**Affected Design Element:** FSD §4.2 DiffEntry.filePath; TDD §6.5 `adapter.revert(entry)`; FSD §5.4.3 SA4E-183 revert contract.
**Recommendation:** In `FileChangeAdapter` (and the backend module), canonicalize every `filePath` with `realpath` and verify it is **contained within the project workspace root** (prefix check after resolution). Refuse symlinks or resolve and re-validate the target. Apply the same guard when *reading* for `/diff`. Log rejected paths as security events.

### Finding SEC-4 — Audit log integrity & source/PII leakage
**Severity:** Medium | **OWASP:** A09/A08
**Description:** Audit events are emitted from the webview (FSD §3.9) and bridged to a backend that "persists audit." Two problems: (1) **Integrity** — there is no mention of append-only/WORM storage, cryptographic signing, or backend-owned sequencing, so a tampering client or compromised engine can forge or suppress events (undermining FSD §7.3 traceability). (2) **Confidentiality** — `/review` and `/diff` handle **Restricted** source code (FSD §7.2). The spec logs only `userId/command/ts/target/status` (good), but the dev `console` logging (TDD §10.2) and any future "log args for debugging" could capture `branchDiff`/file contents → secret/PII leakage into logs retained 90 days.
**Affected Design Element:** FSD §7.3, §3.9; TDD §3.1 #20; TDD §10.2.
**Recommendation:** Generate audit events **server-side** at `SlashCommandModule` (not the webview) so clients cannot suppress/forge them; store with append-only + hash-chaining or signed entries. Explicitly forbid logging `args`, `branchDiff`, `branchName`, or file contents; restrict `target` to session/resource ids. Apply 90-day retention with access controls.

### Finding SEC-5 — Unvalidated outputs from SA4E-182/183/186
**Severity:** High | **OWASP:** A08
**Description:** The three dependency outputs are consumed as trusted: SA4E-183 `filePath` (→ SEC-3), SA4E-182 `compactedSummaryRef` + summary text injected into context (a poisoned summary is **prompt injection** into all subsequent LLM turns), and SA4E-186 `availableAgents`/`review_agent` resolution (a malicious agent id could be routed/executed). The design validates `selectedAgentId ∈ availableAgents` (good) but performs **no schema/type/range validation** on engine responses and assumes engine honesty.
**Affected Design Element:** FSD §5.4; TDD §6.1 adapters; SA4E-186/182/183 contracts.
**Recommendation:** Treat all engine responses as untrusted. Validate with strict schemas (e.g., Zod): `DiffEntry.filePath` must be workspace-relative; compaction summary must be sized and content-scanned; agent ids resolved against a fixed server-side routing table (no dynamic import by name). Sandbox agent execution and treat review-agent output as untrusted when rendered.

### Finding SEC-6 — Backend `slash:*` endpoints lack specified authn/authz & CSRF protection
**Severity:** High | **OWASP:** A01/A05
**Description:** The backend `slash-command` module "exposes `slash:*` endpoints" (TDD §3.1 #20) reached via `MessageBridge`. The design does **not** specify that these endpoints re-authenticate the caller, re-check ownership (see SEC-1), or defend against CSRF / cross-origin invocation. If reachable beyond the Extension Host (or if the bridge is abusable), an attacker could directly call `/review` (LLM cost + source exfil to agent) or `/undo revert` (file overwrite) without the webview guard.
**Affected Design Element:** TDD §3.1 #20, §6.1; FSD §7.1.
**Recommendation:** Require an authenticated principal on every backend `slash:*` handler; bind `sessionId`→owner server-side; enforce `requiresOwner` server-side; add CSRF token / same-origin checks for any network-exposed surface; reject requests where the caller's principal ≠ session owner.

### Finding SEC-7 — Abuse / rate-limiting / LLM cost & resource exhaustion
**Severity:** Medium | **OWASP:** A04
**Description:** Rate limit is **20 req/min per `sessionId` per command** (FSD §3.x.7, TDD NFR-07-T). `/review` spawns a review agent + LLM call (cost), `/compact` runs a summarization LLM call (heavy), and `/diff` can return very large diffs (memory). A user can open many sessions to bypass the per-session cap, and there is **no global per-user/per-day quota** or maximum diff size, enabling financial DoS (LLM spend) and resource exhaustion. Streaming review findings also lacks a max-size cap.
**Affected Design Element:** FSD §3.6.7/§3.2.7; TDD §10.1 NFR-07-T.
**Recommendation:** Add a **global per-user quota** (e.g., N reviews/day) and a hard cap on `branchDiff`/response size. Enforce quotas server-side (not just webview token-bucket). Consider cost-aware circuit breaker that trips on spend thresholds, not only failure counts.

### Finding SEC-8 — Missing input schema validation / prototype pollution
**Severity:** Low | **OWASP:** A04/A03
**Description:** `ctx.args: Record<string, unknown>` (TDD §2.1) is parsed from client input with no declared schema. JSON parsing could carry `__proto__`/`constructor` keys (prototype pollution) if merged into objects, and unvalidated fields enable mass-assignment (e.g., a client sending extra fields to `ModelsCommand` or `NewCommand`).
**Affected Design Element:** TDD §2.1 `CommandContext.args`; FSD §3.x.4.
**Recommendation:** Define explicit Zod schemas per command and parse/validate `args` at the boundary (webview + backend). Reject unknown keys; never merge untrusted objects into prototypes.

### Finding SEC-9 — Error messages may leak internal detail
**Severity:** Low | **OWASP:** A09
**Description:** `dispatch` catches errors and returns `(err as Error).message` to `fail(...)` (TDD §2.3). Although FSD §3.9 says "never surface raw stack traces," the raw `err.message` may still reveal internal paths, engine names, or ids useful to an attacker.
**Affected Design Element:** TDD §2.3; FSD §3.9.
**Recommendation:** Map all exceptions to stable, generic user-facing codes/messages; log the detailed error server-side only. Never return `err.message` to the client.

---

## 5. Risk Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 5 (SEC-1, SEC-2, SEC-3, SEC-5, SEC-6) |
| 🟡 Medium | 2 (SEC-4, SEC-7) |
| 🔵 Low | 2 (SEC-8, SEC-9) |
| ℹ️ Informational | 0 |

**Overall Risk Rating:** High (design-phase; all High findings are remediable via the changes in §6 before implementation).

---

## 6. Remediation Plan (Prioritized)

### P0 — Must resolve before implementation (blocks safe build)
1. **SEC-1 / SEC-6 — Server-side trust anchor.** Move identity and `requiresOwner` enforcement into `SlashCommandModule` (backend). Derive `ownerId` from the authenticated session token; reject client-supplied `userId`/`ownerId`; enforce authn + CSRF on every `slash:*` endpoint. *(Design change: TDD §2.3, §3.1 #20, §6.1.)*
2. **SEC-3 — Safe file operations.** Add `realpath` + workspace-root containment + symlink refusal in `FileChangeAdapter` and backend revert/read paths. *(Design change: TDD §6.5, FSD §4.2, §5.4.3.)*
3. **SEC-2 — Argument hardening.** Validate `branchName` with strict regex; use typed git API (no shell); cap `branchDiff` size; validate `selectedAgentId`/`lastExchangeId` server-side. *(Design change: TDD §6.4, FSD §3.6.4.)*
4. **SEC-5 (file/agent portions) — Validate dependency outputs.** Strict schema validation for `DiffEntry`, compaction summary, and agent-id routing table. *(Design change: TDD §6.1.)*

### P1 — Resolve in current sprint (hardening)
5. **SEC-4 — Audit integrity & secret hygiene.** Emit audit server-side, append-only/signed, 90-day retention; forbid logging `args`/source/file contents. *(Design change: FSD §7.3, TDD §3.1 #20, §10.2.)*
6. **SEC-5 (summary/agent portions) — Sandbox engine influence.** Treat compaction summary and review-agent output as untrusted (scan, size-limit, escape on render). *(Design change: TDD §6.1, §6.4.)*
7. **SEC-7 — Cost & resource controls.** Add global per-user quota for `/review`/`/compact`, max diff/response size, server-side enforcement. *(Design change: FSD §3.6.7, TDD NFR-07-T.)*

### P2 — Follow-up (defense-in-depth)
8. **SEC-8 — Input schemas.** Add Zod validation for all `ctx.args`; reject unknown keys; guard prototype pollution. *(Design change: TDD §2.1.)*
9. **SEC-9 — Error sanitization.** Map exceptions to generic codes; detailed errors server-side only. *(Design change: TDD §2.3.)*

---

## 7. Design Sign-off Recommendation

**Verdict: GO-with-conditions.**

The functional design is coherent and demonstrates good practices (centralized `CommandRegistry`, defense-in-depth owner check in UI, circuit breakers, structured audit, rate limiting, validation of agent selection). However, the **security control placement is wrong for a feature that writes files and invokes LLM agents**: identity and owner enforcement currently rely on a **client-held snapshot**, and the backend `slash:*` endpoint contract does not specify authentication or server-side authorization. These are design-stage gaps that are cheap to fix now and expensive to fix after release.

**Conditions that must be satisfied before implementation proceeds (P0):**
1. Backend `SlashCommandModule` is defined as the authentication/authorization authority; `userId`/`ownerId` are never trusted from the client; `requiresOwner` is re-checked server-side (SEC-1, SEC-6).
2. `FileChangeAdapter`/backend implement path canonicalization + workspace containment + symlink refusal for both read (`/diff`) and revert (`/undo`) (SEC-3).
3. `branchName`/`branchDiff`/`selectedAgentId`/`lastExchangeId` are validated against strict server-side schemas and allowlists; no shell interpolation (SEC-2, SEC-5).
4. Engine responses (SA4E-182/183/186) are validated/untrusted by default (SEC-5).

**Strongly recommended before GA (P1):** server-side signed/append-only audit (SEC-4) and global cost/quota controls (SEC-7).

If conditions 1–4 are not met in the design, the recommendation downgrades to **NO-GO** for any environment where the webview or backend transport is reachable by an untrusted actor.

---

## Appendix A — Methodology & Limitations
- **Method:** Static review of BRD/FSD/TDD against OWASP Top 10 (2021) and OWASP ASVS-style control placement. No running code, no dynamic testing, no penetration testing.
- **Limitations:** Dependent tickets (SA4E-182/183/186) were not reviewed; their internal security is assumed and flagged as a trust boundary (SEC-5). Backend `slash-command` module internals are unspecified, so findings SEC-1/SEC-6 are based on the *absence* of a defined server-side authz contract rather than a confirmed vulnerability.
- **Assumptions:** Authenticated session infrastructure exists per BRD §1.3; transport is in-process as stated in FSD §5.4.

## Appendix B — Glossary
- **TB (Trust Boundary):** the line between trusted (our code) and untrusted (client, dependency, network) inputs.
- **IDOR:** Insecure Direct Object Reference — accessing a resource by id without ownership check.
- **Prompt Injection:** attacker-controlled text that manipulates LLM behavior.
- **WORM:** Write-Once-Read-Many — storage that prevents modification/deletion.
