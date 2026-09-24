# AGENTS.md

Guidance for AI coding agents working in this repository.

## Context

- This is a port of the Unity/C# project `../Surface-Mappings-Visualizer` (the reference implementation).
  Read the C# source when porting; don't change it except for the golden-test exporter.
- Read `docs/architecture.md` (layers and the import rule) and `docs/porting-guide.md` (C# → TS conventions)
  before writing code.

## Process

- Every module gets a review note in `docs/port-notes/` **before** it is ported. Port only after the author
  approved the note, and follow its decisions. Update the status table in `docs/port-notes/README.md`.
- Readability beats a literal translation. Simplify where the note says so; don't add features.
- Everything in English.

## Code rules

- Nothing outside `src/render` and `src/ui` imports three.js or UI code (ESLint enforces this).
- Watch for reference equality in `Map`/`Set`, single-use iterators, and integer division (see the porting guide).
- Tests live next to the code as `*.test.ts`. Run `npm run check` before finishing.
