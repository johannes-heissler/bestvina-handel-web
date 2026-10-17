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
- Work in your own git worktree instead: `git worktree add .claude/worktrees/<task> -b <task> HEAD` (Claude
  Code: then switch into it with the worktree tool), and run `npm ci` there (`node_modules` is not shared).
  From a worktree, the C# project is at `../../../../Surface-Mappings-Visualizer` relative to the worktree root.
- Commit on your branch and leave the merge into `main` to the author (or merge when asked). The new worktree
  starts at the last commit, so it doesn't see the other agent's uncommitted work.
- Remove the worktree when the branch is merged: `git worktree remove .claude/worktrees/<task>`.

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
