---
paths:
  - "tools/**/*.py"
---

# Python tools (tools/*.py)

From CLAUDE.md, docs/NAMING.md and docs/TESTING.md:
- Run them with python3. The browser checks need Python Playwright at the version of the cloud image's browser;
  the session-start hook installs it (tools/requirements-check.txt pins CI's version).
- Browser checks share their set-up through tools/browser_check.py (`serve`, `new_page`, `open_game`, `until`,
  `drawing`, `go_scene`, `LAUNCH`): import it, don't copy it.
- Long lines are this code's style: reformat only in separate no-op commits.
- Modules that other tools import by name keep snake_case (gamedata.py, pixkit.py); other tool files are kebab-case.
- A tool's output goes to `validation/<tool>/`, with that folder in .gitignore.
- Debug and check code never sends save data, names or step history anywhere.
