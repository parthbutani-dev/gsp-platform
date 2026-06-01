# GSP Platform — StudyNow Ltd Technical Assessment

Prototype of **Global Students Pathway (GSP)**: a workflow-driven student application system from enquiry to enrolment. Built against the **Technical Assessment Brief** (StudyNow Ltd, April 2026) and runnable locally for the live walkthrough.

**Stack:** MongoDB · Express · Angular · Node.js (MEAN)

## Assessment coverage map

| Requirement (brief) | Implementation |
| ------------------- | -------------- |
| **1a** State machine, no skipping | `backend/src/config/workflow.config.ts` + `WorkflowService` |
| **1b** ≥2 conditional rules | 3 docs before QA→App Review; review note before App Review→Decision; decision before Decision→Deposit |
| **1c** RBAC + agent boundary | `PermissionService` + `toAgentDto()` strips internal fields |
| **1d** Contextual actions by stage/role | `backend/src/config/actions.config.ts` + `ActionService` |
| **1e** AI at QA / App Review | `AiAssessmentService` + mock provider; push on stage entry |
| **1f** REST API + demo UI | Express routes + Angular demo (role switcher, pipeline, blocked rules) |
| **Reduced pipeline (6–7 stages)** | New App → QA → App Review → Decision → Deposit → CAS → Enrolment |
| **Terminal / branch** | App Rejected, Closed Lost, `offer_exists` entry at Decision |
| **Roles** | Agent, Counsellor, QA, Admission, Visa, Enrolment (per assessment brief) |

**Scope cut (per brief):** Full 11-stage GSP pipeline (App Submitted, CAS Letter, Visa Pending/Decision as separate stages) — documented below; not required for the prototype.

## Setup

**Prerequisites:** Node.js 20+, npm, and [Docker](https://docs.docker.com/get-docker/) (for local MongoDB).

```bash
cd gsp-platform
cp .env.example .env   # skip if you already have .env

npm run setup          # Docker MongoDB + install + build shared + seed

# Terminal 1 — API (port 3000)
npm run dev:backend

# Terminal 2 — UI (port 4200, proxies /api)
npm run dev:frontend
```

Manual steps (same as `setup`):

```bash
npm run docker:up
npm install
npm run build -w @gsp/shared
npm run seed
```

Open http://localhost:4200

### Database (local Docker)

| Command | Purpose |
| ------- | ------- |
| `npm run setup` | One-shot: MongoDB (waits until healthy), install, build, seed |
| `npm run docker:up` | Start MongoDB and wait until healthy |
| `npm run docker:down` | Stop MongoDB (data kept in Docker volume) |
| `npm run docker:reset` | Wipe DB volume and start fresh (re-run `npm run seed` after) |

No MongoDB Atlas account or cloud credentials are required for local testing. Do not commit `.env`; use `.env.example` only.

If you already have a `.env` pointing at Atlas, set `MONGODB_URI=mongodb://127.0.0.1:27017/gsp` and run `npm run docker:up` before seeding.

## Demo users (password: `demo1234`)

| Email | Role |
| ----- | ---- |
| agent@gsp.demo | Agent (external partner) |
| counsellor@gsp.demo | Counsellor |
| qa@gsp.demo | QA Officer |
| admission@gsp.demo | Admission Officer |
| visa@gsp.demo | Visa Officer |
| enrolment@gsp.demo | Enrolment Officer |

Use the **role switcher** in the header during the demo (no re-login page required).

## Seeded demo data

| Student | Stage | Purpose |
| ------- | ----- | ------- |
| Alice Chen | New App | 0/3 documents |
| James Okafor | QA Review | 2/3 docs — blocked advance |
| Priya Sharma | App Review | All docs, no review note — blocked to Decision |

## Live walkthrough script (panel)

1. **QA** → James Okafor → **Advance to Application Review** → see blocked reason (documents).
2. **Admission** → Priya Sharma → **Admission review note** → save → advance to Decision.
3. **Decision** → record university outcome → advance to Deposit.
4. **QA** → AI assessment card (advisory disclaimer) on QA / App Review apps.
5. **Agent** → Alice Chen → no pipeline, no AI, no stage history; documents + notes + status only.
6. **Contextual actions** → Defer / Withdraw / Reject at appropriate stages; Refund only post-Deposit.

## Where application data appears

| Data | Stored on | Who sees it | UI section |
| ---- | --------- | ----------- | ---------- |
| **Notes** | `notes[]` | Staff: all (+ internal flag). Agent: non-internal only | Notes (bottom) |
| **Attachments** | `attachments[]` | Staff: all. Agent: on their apps | Attachments |
| **Tasks** | `tasks[]` | Internal staff only | Tasks (staff) |
| **Required docs** | `requiredDocuments[]` | All with app access | Required documents |

**Add Note**, **Add Attachment**, and **Add Task** are implemented only in their dedicated sections (Notes, Attachments, Tasks) — not duplicated in the contextual actions bar.

## API (Postman / curl)

Import `postman/GSP-Assessment.postman_collection.json`.

1. `GET /api/auth/csrf` → set `X-CSRF-Token` on mutating requests (Angular does this automatically).
2. `POST /api/auth/login` with `{ "email", "password" }` (cookies).

Key routes:

- `GET/POST /api/applications`
- `GET /api/applications/:id/available-transitions` (includes `forward` preview)
- `POST /api/applications/:id/transition`
- `GET /api/applications/:id/available-actions`
- `POST /api/applications/:id/actions/:type`
- `POST /api/applications/:id/notes`
- `PATCH /api/applications/:id/review-note`
- `GET /api/applications/:id/ai-assessment?refresh=true`

## Architecture (walkthrough answers)

**State machine?**  
`TRANSITIONS` in `workflow.config.ts`: each row is `from`, `to`, `allowedRoles`, `validators`. Routes call `workflowService.canTransition()` only.

**Add three stages tomorrow?**  
Add to `PIPELINE_STAGES`, add transition rows, optional validator in `validators.ts`. No route changes.

**MongoDB shape?**  
Single `Application` document with embedded `notes`, `tasks`, `attachments`, `stageHistory`. Agents get a reduced DTO from `dto.mapper.ts`.

**Swap LLM?**  
Implement `AiProvider`; select in `AiAssessmentService.getProvider()`. Prompt in `backend/src/ai/prompts/`.

**Action availability?**  
`ACTION_DEFINITIONS` filtered by `stageMatches()` + role in `ActionService.getAvailableActions()`.

**AI failures?**  
Timeout + `failed` status with `errorMessage`; UI shows retry via refresh. Workflow is never blocked by AI.

**Agent boundary?**  
Agents: own applications only; no transitions/actions panel; no AI/history/review note; non-internal notes only.

## Scope cuts (explicit)

| Cut | Reason |
| --- | ------ |
| Stages 4–10 from full GSP (App Submitted, CAS Letter, Visa Pending/Decision as separate stages) | Brief asks for 6–7 stage prototype |
| Production auth (refresh rotation, MFA) | Time budget |
| Live Anthropic/OpenAI in repo | Mock + OpenAI stub; architecture demonstrated |
| `{ success, data, error }` on every endpoint | Existing domain-shaped JSON + `AppError` middleware |
| File binary upload | “Mark uploaded” + attachment metadata only |

## AI tools transparency

Built with **Cursor**. AI used for: monorepo scaffolding, workflow/action config drafts, Angular templates, README/Postman outlines. Core rules, RBAC boundaries, and validators were implemented to match the assessment brief and are intended to be explainable live.

## Tests

```bash
npm run test -w @gsp/backend
```
