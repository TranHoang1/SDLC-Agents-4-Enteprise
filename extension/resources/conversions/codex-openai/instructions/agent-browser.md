# Always consider agent-browser (vercel-labs) for ANY web task: deep web research, investigating/gathering information online, scraping, reading rendered or login-protected pages, browser automation, testing, or site/app interaction. Native Rust CLI — snapshots, clicks, fills, screenshots, JS eval, auth reuse, network inspection, and AI chat. Prefer it over a plain fetch when the task needs rendering, interaction, a logged-in session, or multi-step navigation.

# agent-browser

Fast native Rust CLI for browser automation by Vercel Labs. Install once, then drive
Chrome through a persistent daemon. Best for interaction (click, type, navigate),
logged-in sessions, JS rendering, or bot-protected pages. If a plain `curl`/fetch can
read it, prefer that and skip the browser.

Repo: https://github.com/vercel-labs/agent-browser

## Installation

Run `agent-browser` from your bash tool. Install the native binary first:

```bash
npm install -g agent-browser
agent-browser install        # download Chrome from Chrome for Testing (first time)
```

- Homebrew (macOS): `brew install agent-browser && agent-browser install`
- Cargo: `cargo install agent-browser && agent-browser install`
- Linux deps: `agent-browser install --with-deps`
- Update: `agent-browser upgrade`
- Diagnose: `agent-browser doctor`

If `agent-browser` is not on PATH, install globally or run via `npx agent-browser ...`.

## Core Loop (AI-friendly)

The accessibility snapshot gives numbered element refs (`@e1`, `@e2`, ...) that you
click/fill by ref. Always re-snapshot after navigation or DOM changes.

```bash
agent-browser open example.com        # launch + navigate (alias: goto, navigate)
agent-browser snapshot                # accessibility tree with refs (best for AI)
agent-browser click @e2               # click by ref from snapshot
agent-browser fill @e3 "test@x.com"   # clear + fill by ref
agent-browser get text @e1            # read text by ref
agent-browser screenshot page.png     # screenshot (--full for full page)
agent-browser close                   # close browser (alias: quit, exit)
```

Traditional selectors also work: `agent-browser click "#submit"`, `fill "#email" "x"`.

Clicks fail early if another element covers the target (e.g. a consent banner).
Dismiss the covering element, take a fresh `snapshot`, then retry.

## Essential Commands

**Navigate / read**
```bash
agent-browser open <url>             # launch + navigate
agent-browser read <url>             # fetch agent-readable text WITHOUT launching Chrome
agent-browser read                   # read rendered DOM of active tab (uses auth/client state)
agent-browser read https://docs.x.com --llms index   # nearest llms.txt links
agent-browser read https://x.com/a --filter overview --outline
agent-browser back | forward | reload
```

**Interact**
```bash
agent-browser click <sel>            # --new-tab to open in new tab
agent-browser dblclick <sel>
agent-browser type <sel> <text>      # type (keeps existing)
agent-browser fill <sel> <text>      # clear + fill
agent-browser press <key>            # Enter, Tab, Control+a
agent-browser keyboard type <text>   # real keystrokes at current focus
agent-browser hover <sel>
agent-browser select <sel> <val>
agent-browser check <sel> | uncheck <sel>
agent-browser scroll <dir> [px]      # up/down/left/right
agent-browser drag <src> <tgt>
agent-browser upload <sel> <files>
```

**Find (semantic locators)** — prefer these over brittle selectors:
```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "x@x.com"
agent-browser find first ".item" click
agent-browser find nth 2 "a" text
```
Actions: `click | fill | check | hover | text`. Options: `--name`, `--exact`.

**Get info**
```bash
agent-browser get text|html|value|attr <sel> [attr]
agent-browser get title | url | count <sel> | box <sel> | styles <sel>
agent-browser is visible|enabled|checked <sel>
```

**Wait**
```bash
agent-browser wait <selector>        # element visible
agent-browser wait 2000              # milliseconds
agent-browser wait --text "Welcome"  # text appears
agent-browser wait --url "**/dash"  # URL pattern
agent-browser wait --load networkidle
agent-browser wait --fn "window.ready === true"
agent-browser wait "#spinner" --state hidden
```

**Screenshot / PDF**
```bash
agent-browser screenshot [path]                    # --full, --annotate (numbered labels)
agent-browser screenshot --screenshot-dir ./shots  # custom dir
agent-browser screenshot --screenshot-format jpeg --screenshot-quality 80
agent-browser pdf <path>
```

**JavaScript**
```bash
agent-browser eval "<js>"            # run JS; -b for base64, --stdin for piped input
```

**Tabs & windows**
```bash
agent-browser tab                              # list tabs (tabId + label)
agent-browser tab new [url]                    # --label docs to name it
agent-browser tab <tN|label>                   # switch
agent-browser tab close [tN|label]
agent-browser window new
```

**Frames / dialogs**
```bash
agent-browser frame <sel>            # switch into iframe; frame main to exit
agent-browser dialog accept [text] | dismiss | status
```
By default `alert`/`beforeunload` are auto-accepted; `confirm`/`prompt` need explicit handling.

**Clicks that need a covering element dismissed first.** When a click fails because
something overlaps, resolve it, then re-`snapshot` and retry the ref.

## Batch (multi-step in one call)

Avoid per-command startup overhead:
```bash
agent-browser batch "open https://example.com" "snapshot -i" "screenshot"
agent-browser batch --bail "open https://example.com" "click @e1" "screenshot"
# stdin JSON mode:
echo '[["open","https://example.com"],["snapshot","-i"],["click","@e1"]]' | agent-browser batch --json
```

## Authentication & Profiles

Reuse existing login state instead of re-authenticating:
```bash
agent-browser profiles                              # list Chrome profiles
agent-browser --profile Default open https://gmail.com   # copy profile (read-only snapshot)
# persistent custom profile across restarts:
agent-browser --profile ~/.myapp-profile open myapp.com
# session persistence (auto save/restore cookies + localStorage):
agent-browser --session myapp --restore open example.com
# import auth from a running Chrome:
agent-browser --auto-connect state save ./auth.json
agent-browser --state ./auth.json open https://app.example.com/dashboard
```
On Windows, close Chrome before using `--profile <name>` if Chrome is running.

## Scraping / Extraction Tips

- Use `read <url>` first — it fetches readable text/markdown without launching Chrome.
- For rendered/SPA content or to use the logged-in session, `open` then `snapshot`
  and extract via `get text @ref` or `eval`.
- Network inspection: `agent-browser network requests --filter api`, `--type xhr,fetch`,
  `--status 2xx`; `network har start/stop`.
- Diff pages: `agent-browser diff url https://v1.com https://v2.com` (snapshot + optional `--screenshot`).
- Accessibility audit: `agent-browser a11y [url] [--tags wcag2a,wcag2aa] [--json]`.

## AI Chat (natural language control)

```bash
agent-browser chat "Add item to cart and proceed to checkout"   # single-shot
agent-browser chat                                             # interactive REPL
```

## MCP Server (for MCP clients)

`agent-browser mcp` starts an MCP stdio server. Profiles: `core` (default), `network`,
`state`, `debug`, `tabs`, `react`, `mobile`, `all`.
```json
{ "mcpServers": { "agent-browser": { "command": "agent-browser", "args": ["mcp"] } } }
```

## Gotchas

- Re-snapshot after every navigation or DOM mutation; refs go stale.
- `agent-browser install` is required once before first launch.
- State/auth files contain session tokens in plaintext — add to `.gitignore`, delete when done.
- On Linux use `agent-browser install --with-deps` for system libraries.
- `--remote-debugging-port` (used by `--auto-connect`) exposes full browser control on
  localhost; only use on trusted machines.
- When a click fails due to a covering element, dismiss it, re-snapshot, retry.
- Parallel/isolated tasks: use `--session <id>` to separate browser state per task.
