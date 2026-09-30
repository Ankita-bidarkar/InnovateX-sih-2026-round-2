# InnovateX — Simplified Round-2 Fix v5

## Role flow
- Startup: Dashboard → Problems → My AI Review → Collaborate → Pilot
- Organisation: Dashboard → Challenges → AI Review → Collaboration → Pilot → Scale & Procurement
- Expert: Dashboard → AI Analysis → Expert Review → Pilot
- Admin: Dashboard → Problems → AI Analysis → Expert Review → Pilot → Scale & Procurement → Verify Startups

## Fixed
- Expert demo/manual login now routes directly to Expert Review instead of an inaccessible dashboard.
- Expert Review is restricted to Expert/Admin accounts.
- Expert Review simplified to four practical checks: feasibility, risk, problem fit, and pilot readiness, plus evidence and notes.
- Added a short 3-step explanation directly above the review workspace.
- Reduced the global workflow ribbon from 12 stages to 6 understandable stages.
- Rebuilt authenticated navigation by role so Startup, Organisation, Expert and Admin no longer see the same workflow.
- Dashboard copy now changes by role; organisation/expert views no longer present the startup dashboard as if it were their workspace.
- Removed duplicate Pilot "Final Pilot Recommendation" blocks and replaced them with one shared Pilot Recommendation section.
- Pilot recommendation is saved locally as `ix_pilot_recommendation`.
- Existing AI scores, solution data, collaboration and pilot data remain intact.

## Run
```powershell
npm install
$env:PORT=3004
npm start
```
Then open `http://localhost:3004`.

## v6 changes — Organisation problem posting + KPI Evidence removal
- Added a working **+ Post a Problem** action for Organisation accounts on the Problems page and Organisation dashboard.
- Added a simple problem-posting form with title, category, description, expected outcome, target date and budget/prize.
- Posted organisation problems are saved to `localStorage` under `ix_user_problems` for the prototype workspace.
- Removed/blocked any navigation item labelled **KPI Evidence** or linking to `kpi-evidence`.
- Kept KPI measurement inside the Pilot workflow; no separate KPI Evidence navigation section is required.

## v7 actual-source verification pass
- Rebuilt the homepage body in the actual project source to the compact judge-first structure: Hero → InnovateX Method → Intelligence Engine → Intelligence Layer → Explore the workflow → Footer.
- Removed the old homepage marquee, stats strip, Open Challenges preview, Complementary Solutions section, Prediction-to-Proof section and Complete Loop section from the live homepage markup.
- Preserved the requested workflow copy and links: Explore Challenges → `problem.html`; See AI Analysis → `ai-analysis.html`.
- Changed the Organisation form action label to `Post Problem`.
- Added rendering of `ix_user_problems` into the existing Problems grid and made posted-problem details readable from the same localStorage data.
- Ran `node --check` successfully against every JavaScript file in the project.
- Full `npm ci` / browser-rendered end-to-end testing could not be completed in this environment because the dependency install timed out; this is explicitly not being represented as a successful runtime test.
