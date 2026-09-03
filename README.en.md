# Command Code Chinese Localization Tool

Localize the **Command Code desktop app** UI from English to Simplified Chinese (cross-platform: Windows / macOS / Linux).

> Dictionary with 948 entries, covering renderer UI screens + main process + the harness config package.
> The tool only modifies files inside the installation directory — **automatic backups, one-click restore**.

## Quick Start

### Apply Chinese localization

On Windows, double-click **`汉化.bat`**, or run from the command line:

```bat
node localize.js apply
```

Install directory resolution (first match wins):

1. CLI argument: `node localize.js apply "D:\path\to\Command Code"`
2. Environment variable: `set CC_APP_DIR=D:\path\to\Command Code`
3. Auto-detection of common locations: `%LOCALAPPDATA%\Programs`, `Program Files`,
   `D:\commandcodedesktop`, macOS `/Applications/Command Code.app`, Linux `/opt`, etc.
4. If nothing is found, the tool prints an error and asks you to pass the path explicitly.

Before patching, the original files are backed up to `backups\` (each run gets its own
timestamped directory, so you can restore any historical version).
**Fully quit and restart Command Code** for the changes to take effect.

### Restore English version

Double-click **`还原.bat`**, or run:

```bat
node localize.js restore
```

Restores all files from the most recent backup.

### Status / dry run

```bat
node localize.js status    :: show install dir, backups, localized-or-not
node localize.js dry       :: preview replacements without writing anything
```

## Guide for AI Coding Agents

If you are an AI coding agent asked to localize Command Code for a user, follow these steps:

1. **Locate the install directory**: ask the user where Command Code is installed, or probe
   common locations (Windows: `%LOCALAPPDATA%\Programs\Command Code`,
   `D:\commandcodedesktop\Command Code`; macOS: `/Applications/Command Code.app/Contents/Resources/app`;
   Linux: `/opt/Command Code`). Verify by checking that
   `<install dir>/resources/app/out/main/index.js` exists.
2. **Run the localization** (pick one way to pass the directory):

   ```bash
   node localize.js apply "<install dir>"      # recommended: explicit argument
   CC_APP_DIR="<install dir>" node localize.js apply   # or via environment variable
   ```

3. **Verify the result**:

   ```bash
   node localize.js status                  # should report "已汉化" (localized)
   node tools/syntax-check.js "<install dir>"   # all target files pass syntax check
   ```

4. **Remind the user** to fully quit and restart Command Code.
5. **If the tool reports "already localized"**: run `node localize.js restore` first,
   then apply again.
6. **Adding new translation entries**: edit `dict.json` (structure below), following the
   dictionary rules, then re-apply. **Do not** edit JS files inside the app install
   directory directly — changes there are overwritten by the next apply/restore and are
   not traceable. All terms belong in `dict.json`.
7. **Ask the user before running apply** — it modifies files in the install directory
   (restorable via `restore`).

## How It Works

Command Code is an Electron app whose UI text is hardcoded in bundled JS files — there is
no language pack. This tool performs **dictionary-driven whole-string replacement**:

1. It only touches the app's own UI files:
   - UI chunks under `out/renderer/assets/` (`workspace-screen-*`, `settings-panel-*`,
     `browser-panel-*`, `source-panel-*`, `auth-screen-*`, `onboarding-screen-*`,
     main bundle `index-*.js`)
   - `out/main/index.js` (Electron main process: native menus, dialogs, IPC error text)
   - `node_modules/@commandcode/harness/dist/index.js` (Config setting schema, permission dialog options)
   - **Skips** third-party library chunks such as syntax highlighting (Shiki), diagrams
     (mermaid), dates (dayjs), xterm, etc.
2. It matches exact strings from the `dict.json` EN→ZH term pairs.
3. Replacement is guarded by **identifier boundaries**: a term must not be immediately
   surrounded by `[A-Za-z0-9_$]`, so identifiers like `onToggleTerminal` are never
   corrupted into `onToggle终端`.
4. Lexical awareness: comment/string/template regions are pre-scanned so text inside
   comments is never touched.
5. Every modified file is syntax-checked (`node --check`) and scanned for Chinese
   pollution after replacement.
6. The dictionary only contains **multi-word phrases / full sentences** — single words
   like `Terminal` or `Search` are excluded to avoid false positives.

### Files

| File | Purpose |
| --- | --- |
| `汉化.bat` / `还原.bat` | Double-click one-shot scripts (Windows) |
| `localize.js` | Core logic: apply / restore / status / dry |
| `dict.json` | EN→ZH translation dictionary (948 entries, editable) |
| `backups/` | Automatic pre-patch backups (timestamped, git-ignored) |
| `tools/extract.js` | Scan app JS for candidate English strings (read-only) |
| `tools/filter.js` | Filter UI sentence candidates from scan reports |
| `tools/clean-dict.js` | Dictionary de-duplication / cleanup |
| `tools/syntax-check.js` | Batch `node --check` over all target files |
| `tools/boundary-test.js` | Unit tests for the boundary-replacement logic |

## Dictionary Maintenance

`dict.json` structure:

```json
{
  "meta": { "updated": "2026-09-03", "count": 948 },
  "terms": [
    { "from": "New chat", "to": "新建会话" },
    { "from": "Rename chat", "to": "重命名会话" }
  ]
}
```

Rules for adding new entries:

- **Only add multi-word phrases or sentences** (containing spaces); never single words
  such as `Save` or `Open`;
- Do not translate model names (Claude Opus, DeepSeek, …), theme/font names, language
  names, slash command names, or CLI tool schema descriptions;
- The term must be an exact string literal in the code (run `tools/extract.js` first to
  confirm it exists — mind the minified code's exact quoting and whether it carries a
  `label:`/`title:` prefix);
- Terms are applied longest-first, so longer entries always win.

## Scope and Boundaries

Localized (user-visible GUI):

- Settings page: section titles, navigation, MCP form, theme details, shortcuts table,
  account/usage cards
- Main workspace: session list states/grouping, view menu, rewind/delete/stop dialogs,
  toasts, terminal task states, update banner, command palette
- Built-in browser design panel: style toolbar, browser toolbar, empty states
- File tree: Git status labels, search placeholder
- Main process: native app menu, update dialogs, link-preview blocks, IPC error text
- Harness: Config settings, permission dialog options, plan-mode / vision onboarding choosers

Intentionally **not** translated:

- Model/brand/theme/font names, language names, shortcut keybindings (e.g. `CmdOrCtrl+O`)
- Slash command names and CLI/tool schema descriptions (`/help` terminal help)
- Third-party internals (zod multilingual errors, xterm, mermaid, Shiki, dayjs, …)
- SVG path data, code identifiers, internal logs

## Notes

- **App updates overwrite the localization**: re-run the script after each official update;
- The tool modifies files inside the install directory — a **reversible** operation that
  can be undone at any time via `restore`;
- Run the localization while Command Code is **closed** for best results;
- Text not covered by the dictionary stays English — contributions to `dict.json` are
  welcome (see maintenance rules above).

## Disclaimer

This is an unofficial, personal localization tool and is not affiliated with Command Code.
It modifies local installation files; use at your own risk.
