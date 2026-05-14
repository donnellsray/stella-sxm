# Stella AI — Client Services Operating Partner

An AI-powered web app built for an advertising sales team to manage campaigns, get instant answers to billing and workflow questions, and reduce time spent on repetitive operational tasks.

Deployed as a Google Apps Script web app — no installation required, accessible to any team member through their existing Google account.

---

## What It Does

**Campaign Management**
- Each user gets their own campaign database tab (auto-created on first login), backed by Google Sheets
- Track 23 fields per campaign: client name, order IDs, sales rep, flight dates, campaign/flight status, pacing %, tickets, billing flags, and direct links to every relevant platform
- Card grid view and sortable list view with filter bar (Live / Upcoming / Ending Soon / Ended)
- Per-section inline edit on the detail view — update just pacing or a ticket ID without opening the full form
- Structured flight date picker: add individual start/end date pairs per campaign

**AI Assistant (Stella)**
- Powered by Claude (Anthropic) via an internal LiteLLM endpoint
- Available as a persistent popup from any screen, and as an inline chat on every campaign's detail view pre-loaded with that campaign's context
- Dynamic knowledge base routing: billing questions automatically pull in the full Billing Workflow KB covering IO approval, order setup, billing close, make-goods, 3P reporting, and escalation paths
- Stella knows every active campaign by name, ID, dates, pacing, and rep without the user having to paste anything

**Home Dashboard**
- Six customizable widgets with drag-and-drop reorder:
  - Campaign Calendar — Gantt chart (rolling ±90 days) with color-coded status bars; toggle to sortable list view
  - Pending Tasks — auto-generated alerts for flight warnings, low pacing, ending-soon, untrafficked campaigns
  - Quick Links — one-click access to key internal tools
  - CS Tools — direct links to team tooling
  - Meetings — placeholder for calendar integration
  - Stella Runner — pixel art endless runner mini-game
- Per-widget close buttons synced with Settings toggles

**Virtual Office**
- Six agent desks (Billing, Stella, Trafficking, Reporting, Handoff, Tagging)
- Toggle between a pixel-art HTML5 canvas view and a flat card view
- Each desk opens a side chat panel; live agents connect to the AI, placeholder desks show roadmap status

**Seller View**
- AMs generate a read-only shareable link for their sellers
- Shows all campaigns and detail view without edit controls or AI chat

**Resources Tab**
- Browseable card grid of quick links, team tools, and user-added custom resources
- Add, edit, and remove personal resources (label, URL, description, emoji icon, color)

**Settings**
- Dark / light mode, accent color, default filter, widget visibility — all persisted per device

---

## Tech Stack

| Layer | Technology |
|---|---|
| Deployment | Google Apps Script (HtmlService) |
| Frontend | Vanilla JS + CSS custom properties — single-file SPA |
| Database | Google Sheets (one tab per user, auto-created) |
| AI | Anthropic Claude via LiteLLM |
| Auth | Google Workspace (session resolved automatically from Google login) |

No external servers. No npm. No build step. The entire app ships as one HTML file evaluated server-side by GAS.

---

## Architecture

```
Stella.gs          Orchestrator — doGet(), system prompt builder, KB router
StellaDB.gs        Data layer — Google Sheets read/write, schema migration
BillingKB.gs       Billing workflow knowledge base (keyword-matched injection)
Index.html         Single-file SPA — all CSS, HTML, and JS
```

**How AI calls work:**
GAS serves the HTML with API credentials injected as template variables. LiteLLM calls are made browser-side (not through GAS servers) so the internal endpoint is reachable on the corporate network. Before each call, the browser invokes `buildStellaSystemContent()` server-side via `google.script.run` to assemble the full system prompt — identity, live campaign context, and relevant KB sections — without exposing that logic to the client.

**Knowledge base routing:**
`STELLA_KB_ROUTER` maps trigger keywords to knowledge domains. When a user's message contains billing-related terms, the relevant KB sections are injected into the system prompt automatically. Additional KB domains (trafficking, reporting, upsell) are stubbed and ready to wire in as content is developed.

**Schema migration:**
`migrateAMTab()` runs on every page load and silently appends any new columns to a user's Sheet tab if the schema has been updated since their last login. Existing data is never touched.

---

## Setup (for your own deployment)

1. Create a new Google Apps Script project
2. Paste `Stella.gs`, `StellaDB.gs`, `BillingKB.gs`, and `Index.html` into the editor
3. Set Script Properties:
   ```
   LITELLM_API_KEY    → your API key
   LITELLM_BASE_URL   → your LiteLLM endpoint
   LITELLM_MODEL      → claude-sonnet-4-6 (or preferred model)
   ```
4. Run `setupStella()` once to create the campaign database Sheet
5. Deploy as Web App: Execute as **Me**, Access: **Anyone** (or your org)

---

## Roadmap Highlights

- Live pacing data pulled automatically from the ad server API
- Salesforce integration — IO approval state, case list, invoice data
- Outlook email parsing — surface new cases and ticket assignments as dashboard alerts
- JIRA/Theorem integration — live ticket status and assignee
- Additional AI subagents: Trafficking, Reporting, Handoff, Tagging
- Port of three team-built GPTs (trafficking, campaign monitoring, upsell) into Stella's KB
- Admin-managed shared resources visible to the whole team
- True multi-agent tool use via Claude's function-calling API

Full details in `ROADMAP.txt`.

---

## Notes for Portfolio Reviewers

- Internal tool URLs and endpoint hostnames have been replaced with placeholders in this public version
- No credentials are stored in code — all secrets live in GAS Script Properties
- The Billing KB (`BillingKB.gs`) contains proprietary workflow content and has been omitted from this repo
