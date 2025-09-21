# Repository Guidelines

## Project Structure & Module Organization
- `backend/` houses the Python 3.11 LangGraph agent; extend behaviour in `backend/src/agent/` where `graph.py` wires the research loop, `tools_and_schemas.py` defines tool payloads, and `configuration.py` reads runtime options.
- Add backend scripts under `backend/examples/` and tests under `backend/tests/unit_tests/`; mirror the package layout so fixtures stay close to the code they exercise.
- `frontend/` is a Vite + React + TypeScript UI; feature components live in `frontend/src/components/`, shared utilities in `frontend/src/lib/`, and routing starts from `frontend/src/App.tsx`. Static assets belong in `frontend/public/`.
- Root-level resources (`Makefile`, `docker-compose.yml`, `Dockerfile`) orchestrate combined dev flows and container builds; keep new infra artefacts here for consistency.

## Build, Test & Development Commands
- `make dev`, `make dev-backend`, and `make dev-frontend` start uvicorn/langgraph and Vite hot reloaders from the repo root.
- Backend: `make -C backend test` (or `uv run --with-editable . pytest backend/tests/unit_tests`) executes pytest; use `TEST_FILE=...` to target a module.
- Lint/format Python with `make -C backend lint` or `uv run ruff format src && uv run mypy src` before pushing.
- Frontend: `cd frontend && npm run dev` for local dev, `npm run build` for production bundles, and `npm run lint` to enforce ESLint.

## Coding Style & Naming Conventions
- Python follows Ruff + mypy rules: 4-space indentation, type hints on public functions, snake_case modules, PascalCase classes, and descriptive docstrings for graph nodes and tools.
- TypeScript uses the repo ESLint config: prefer functional React components, PascalCase filenames for components, camelCase helpers, and Tailwind utility classes declared in `global.css`.

## Testing Guidelines
- Place backend unit tests in `backend/tests/unit_tests/test_<feature>.py`, grouping fixtures alongside the code under test; aim for coverage of each graph branch and tool schema.
- Run `make -C backend test` locally before opening a PR; add `pytest --only-extended` cases for longer research flows when behaviour changes.
- Frontend tests are not yet scaffolded—at minimum add story- or interaction-driven checks via Playwright/Vitest in `frontend/tests/` when introducing UI logic, and keep snapshots lightweight.

## Commit & Pull Request Guidelines
- Use imperative, scope-prefixed commit subjects (e.g., `feat: add timeline node`) and keep bodies focused on rationale and side-effects.
- PRs should describe the user-facing impact, list backend/frontend touchpoints, link any tracker tickets, and include screenshots or terminal captures when altering UI or API surface.
- Note required env keys (`GEMINI_API_KEY`, optional `LANGSMITH_API_KEY`) in PR descriptions whenever behaviour depends on them, and update README/CLAUDE.md if setup shifts.
