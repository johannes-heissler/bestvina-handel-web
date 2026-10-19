# AGENTS.md

Guidance for AI coding agents working in this repository.

## Context

- This is a port of the Unity/C# project `../Surface-Mappings-Visualizer` (the reference implementation).
  Read the C# source when porting; don't change it except for the golden-test exporter.
- Read `docs/architecture.md` (layers and the import rule) and `docs/porting-guide.md` (C# → TS conventions)
  before writing code.

## Parallel agents

Several agents may work on this repository at the same time. Before changing anything:

- Run `git status`. If there are uncommitted changes you didn't make, another agent is working in this checkout:
  don't touch, stash, reset or commit them, and don't switch branches here.
- Work in an **agent slot** instead: a git worktree next to this folder that is kept and reused, so that its
  `node_modules` (not shared between worktrees) and its place in the editor stay. The slots are
  `../bestvina-handel-web-a`, `../bestvina-handel-web-b`, … (`git worktree list` shows them). The C# project is at
  `../Surface-Mappings-Visualizer` from there too.
- **Taking a slot.** A slot is free when `git status` there is clean and it is on a detached `main` (no branch
  checked out). Then start your task from the current `main` (worktrees share the branches, no fetch needed):
  `git switch -c <task> main`, and run `npm ci` if `package-lock.json` changed since that slot's last install. If
  no slot is free, add the next one: `git worktree add --detach ../bestvina-handel-web-<letter> main`, then
  `npm ci` there. Claude Code: switch into the slot with the worktree tool by its path; don't create one with the
  tool, which would put it under `.claude/worktrees/`.
- Commit on your branch and leave the merge into `main` to the author (or merge when asked). The branch starts at
  the last commit of `main`, so it doesn't see another agent's uncommitted work.
- **Handing the slot back.** Stop every dev server and watcher you started there, with its whole process tree
  (on Windows `taskkill /T /F /PID <pid>`; stopping only the `npx` wrapper leaves `node` running and the files
  locked). Then detach, so that the branch can be merged and deleted elsewhere: `git switch --detach main`, and
  after the merge `git branch -d <task>`. Don't delete the slot.

## Process

- Every module gets a review note in `docs/port-notes/` **before** it is ported. Port only after the author
  approved the note, and follow its decisions. Update the status table in `docs/port-notes/README.md`.
- Readability beats a literal translation. Simplify where the note says so; don't add features.
- Everything in English: code, docs, commit messages, and also your replies and reasoning, even when the author
  writes or dictates in German.

## Code rules

- Nothing outside `src/render` and `src/ui` imports three.js or UI code (ESLint enforces this).
- Watch for reference equality in `Map`/`Set`, single-use iterators, and integer division (see the porting guide).
- Tests live next to the code as `*.test.ts`. Run `npm run check` before finishing.
