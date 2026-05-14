// ============================================================
// Stella.gs — Orchestrator Backend
// SiriusXM Client Services AI Operating Partner
//
// Setup:
//   1. Run setupStella() once to initialize the DB sheet
//   2. Set Script Properties:
//        LITELLM_API_KEY   → your Bearer token
//        LITELLM_BASE_URL  → https://litellm.example.com
//        LITELLM_MODEL     → claude-sonnet-4-6
//   3. Deploy as Web App (Execute as: Me, Access: Anyone within SiriusXM)
//
// Architecture:
//   LiteLLM calls are made from the user's browser (not GAS servers)
//   so the internal LiteLLM endpoint is reachable.
//   GAS handles: serving HTML with injected credentials, building
//   Stella's system prompt with dynamic KB routing, and all
//   campaign data reads/writes via StellaDB.gs.
// ============================================================

// ── Stella's Identity ─────────────────────────────────────

var STELLA_IDENTITY = [
  "You are Stella, the AI operating partner for SiriusXM Client Services.",
  "You are named after the SiriusXM mascot — Sirius, the Dog Star.",
  "You work alongside Account Managers to help them run campaigns more efficiently,",
  "catch issues before they escalate, and spend less time on manual tasks.",
  "",
  "YOUR CAPABILITIES:",
  "- Billing review: Cross-reference IO terms, OMS line items, and invoiced amounts",
  "  to catch discrepancies before they reach the client.",
  "- Campaign monitoring: Review pacing data, flag under-delivery risk, suggest next steps.",
  "- Process guidance: Answer questions about SXM billing workflows, IO approval, OMS setup,",
  "  3P reporting requirements, and escalation paths.",
  "- Communication drafting: Help write client emails, status updates, handoff briefs.",
  "- Data review: Parse delivery reports, billing docs, campaign exports.",
  "",
  "YOUR PERSONALITY:",
  "- Direct and concise. AMs are busy — lead with the answer, not preamble.",
  "- Specific. Reference actual campaign names, dates, dollar amounts from the data provided.",
  "- Proactive. If you notice something the AM didn't ask about, flag it.",
  "- Honest. If you don't have enough information, say so and ask for what you need.",
  "- Collaborative. You're a partner, not a search engine.",
  "",
  "BOUNDARIES:",
  "- You work within SXM's internal workflows. Don't advise on actions that bypass",
  "  standard approval processes.",
  "- Don't invent data. If a field is missing, say it's missing.",
  "- Keep client data confidential. Don't repeat back PII unnecessarily."
].join("\n");

// ── KB Router ─────────────────────────────────────────────
// Maps query keywords to knowledge domains.
// As new agents are added, register their KB function here.

var STELLA_KB_ROUTER = {
  // Billing domain
  "billing": "billing", "invoice": "billing", "invoiced": "billing",
  "discrepancy": "billing", "discrepancies": "billing", "rebill": "billing",
  "credit": "billing", "io terms": "billing", "oms": "billing",
  "make good": "billing", "make-good": "billing", "makegood": "billing",
  "under-delivery": "billing", "under delivery": "billing",
  "billing case": "billing", "billing close": "billing",
  "cbs": "billing", "custom billing": "billing",
  "prepay": "billing", "prepayment": "billing",
  "io approval": "billing", "io audit": "billing",
  "qc": "billing", "quality control": "billing",
  "3p report": "billing", "dfa": "billing", "dcm": "billing",
  "isci": "billing", "slingshot": "billing", "pacing": "billing",

  // Future domains (uncomment as agents are built)
  // "jira": "trafficking", "theorem": "trafficking", "traffic": "trafficking",
  // "report": "reporting", "wrap report": "reporting", "delivery report": "reporting",
  // "handoff": "handoff", "transition": "handoff",
  // "tag": "tagging", "pixel": "tagging", "3p tag": "tagging",
};

/**
 * Returns KB content relevant to the query.
 * Currently routes to billing KB. Expands as agents are added.
 */
function _getRelevantKBContent(userMessage, campaignContext) {
  var combined = (userMessage + " " + (campaignContext || "")).toLowerCase();
  var domains = {};

  var keys = Object.keys(STELLA_KB_ROUTER);
  for (var i = 0; i < keys.length; i++) {
    if (combined.indexOf(keys[i]) !== -1) {
      var domain = STELLA_KB_ROUTER[keys[i]];
      domains[domain] = (domains[domain] || 0) + 1;
    }
  }

  var content = [];

  if (domains["billing"]) {
    // getRelevantKB() is defined in BillingKB.gs — same global scope in GAS
    var billingKB = getRelevantKB(userMessage, campaignContext);
    if (billingKB) content.push("=== BILLING WORKFLOW KNOWLEDGE ===\n" + billingKB);
  }

  // Future: if (domains["trafficking"]) { content.push(...) }

  return content.join("\n\n");
}

// ── Entry Points ──────────────────────────────────────────

/**
 * Receives calendar events POSTed by the Claude Code /refresh-stella-calendar skill.
 * Body: { secret: string, email: string, events: Array }
 *
 * Script Properties required:
 *   CALENDAR_SYNC_SECRET  — any random string; must match the skill config.
 *
 * Returns JSON: { ok: true } or { ok: false, error: "..." }
 */
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var body   = JSON.parse(e.postData.contents);
    var secret = body.secret || "";
    var email  = body.email  || "";
    var events = body.events || [];

    // Validate secret
    var expected = PropertiesService.getScriptProperties().getProperty("CALENDAR_SYNC_SECRET") || "";
    if (!expected || secret !== expected) {
      output.setContent(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return output;
    }

    if (!email) {
      output.setContent(JSON.stringify({ ok: false, error: "email required" }));
      return output;
    }

    saveCalendarEvents(email, events);
    output.setContent(JSON.stringify({ ok: true, saved: events.length }));
  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: err.message }));
  }

  return output;
}

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var t = HtmlService.createTemplateFromFile("Index");

  t.apiKey  = props.getProperty("LITELLM_API_KEY")  || "";
  t.baseUrl = props.getProperty("LITELLM_BASE_URL") || "https://litellm.example.com";
  t.model   = props.getProperty("LITELLM_MODEL")    || "claude-sonnet-4-6";

  // Seller view — passed as ?seller=1&am=first.last@siriusxm.com
  var params = (e && e.parameter) ? e.parameter : {};
  t.sellerMode = params.seller === "1" ? "true" : "false";
  t.sellerAM   = params.am ? params.am : "";

  return t.evaluate()
    .setTitle("Stella AI — SiriusXM Client Services")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── User Identity ─────────────────────────────────────────

/**
 * Returns the logged-in AM's identity.
 * Called once on page load.
 * @returns {Object} { email, name, initials }
 */
function getCurrentUser() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error("Could not identify user. Make sure you're signed in with your SXM Google account.");
  }

  // Derive display name from email prefix (donnell.ray → Donnell Ray)
  var prefix = email.split("@")[0];
  var name = prefix.split(".").map(function(part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");

  var initials = name.split(" ").map(function(w) { return w.charAt(0); }).join("").substring(0, 2);

  return { email: email, name: name, initials: initials };
}

// ── System Prompt Builder ─────────────────────────────────

/**
 * Builds Stella's full system prompt for a given request.
 * Called from browser via google.script.run before each LiteLLM call.
 * Runs server-side (no network needed — just string assembly).
 *
 * @param {string} userMessage   - The AM's message
 * @param {string} email         - AM email (for campaign context)
 * @param {string} billingData   - Any pasted billing/campaign data
 * @returns {string} Full system prompt
 */
function buildStellaSystemContent(userMessage, email, billingData) {
  var system = STELLA_IDENTITY;

  // Add the AM's live campaign context
  if (email) {
    try {
      var campaignContext = getCampaignContext(email);
      system += "\n\n--- YOUR ACTIVE CAMPAIGNS ---\n" + campaignContext;
      system += "\n\nUse campaign context above to give specific, relevant answers. " +
                "If the AM asks about a campaign by name or Slingshot ID, reference the data above.";
    } catch (e) {
      // DB not set up yet — continue without campaign context
      system += "\n\n(Campaign database not yet configured for this user.)";
    }
  }

  // Route to relevant KB sections
  var kbContent = _getRelevantKBContent(userMessage, billingData);
  if (kbContent) {
    system += "\n\n--- KNOWLEDGE BASE ---\n" + kbContent;
    system += "\n\nReference the knowledge base above when answering process questions. " +
              "Cite specific procedures, escalation paths, and SXM workflows.";
  }

  // Append any pasted billing/campaign data
  if (billingData && billingData.trim()) {
    var trimmed = billingData.trim();
    var MAX_CHARS = 25000;
    if (trimmed.length > MAX_CHARS) {
      trimmed = trimmed.substring(0, MAX_CHARS);
      system += "\n\n--- PASTED DATA (truncated) ---\n" + trimmed;
      system += "\n[Data was truncated. Ask the AM to paste remaining sections if needed.]";
    } else {
      system += "\n\n--- PASTED DATA ---\n" + trimmed;
    }
  }

  return system;
}

/**
 * Builds Stella's system prompt for a manager viewing their full team.
 * Called from Index.html via google.script.run when role === "manager".
 *
 * @param {string} userMessage   - The manager's message
 * @param {string} managerEmail  - Manager's email (used to load team campaigns)
 * @param {string} billingData   - Any pasted data
 * @returns {string} Full system prompt
 */
function buildManagerStellaSystemContent(userMessage, managerEmail, billingData) {
  var system = STELLA_IDENTITY;

  system += "\n\nCONTEXT: You are advising a Team Lead / Manager. " +
            "The campaign data below covers their full team roster across all Account Managers. " +
            "When flagging issues, reference the specific AM and campaign by name. " +
            "When asked for team-level insights (revenue, pacing health, billing issues), " +
            "synthesize across the full roster rather than limiting to one AM's book.";

  // Add full team campaign context
  try {
    var teamContext = getTeamCampaignContext(managerEmail);
    system += "\n\n--- TEAM CAMPAIGNS ---\n" + teamContext;
    system += "\n\nReference the team data above when answering questions. " +
              "Attribute issues to specific AMs when relevant.";
  } catch (e) {
    system += "\n\n(Team campaign data could not be loaded.)";
  }

  // KB routing — same as standard prompt
  var kbContent = _getRelevantKBContent(userMessage, billingData);
  if (kbContent) {
    system += "\n\n--- KNOWLEDGE BASE ---\n" + kbContent;
    system += "\n\nReference the knowledge base above when answering process questions.";
  }

  if (billingData && billingData.trim()) {
    var trimmed = billingData.trim();
    var MAX_CHARS = 25000;
    if (trimmed.length > MAX_CHARS) {
      trimmed = trimmed.substring(0, MAX_CHARS);
      system += "\n\n--- PASTED DATA (truncated) ---\n" + trimmed;
      system += "\n[Data was truncated.]";
    } else {
      system += "\n\n--- PASTED DATA ---\n" + trimmed;
    }
  }

  return system;
}

/**
 * Builds Stella's system prompt for OOO coverage mode.
 * The covering AM is loading a colleague's campaigns with full access.
 *
 * @param {string} userMessage   - The covering AM's message
 * @param {string} coveredEmail  - Email of the AM being covered
 * @param {string} coverageDoc   - Coverage document text (optional) + any pasted/detail context
 * @returns {string} Full system prompt
 */
function buildCoverageStellaSystemContent(userMessage, coveredEmail, coverageDoc) {
  var system = STELLA_IDENTITY;

  var covName = coveredEmail ? coveredEmail.split("@")[0].split(".").map(function(p){
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(" ") : "a colleague";

  system += "\n\nCONTEXT: You are in OOO COVERAGE MODE. " +
    "You are assisting an Account Manager who is temporarily covering " + covName + "'s accounts. " +
    "All campaign data below belongs to " + covName + ". " +
    "Treat questions as if you are the expert on " + covName + "'s book. " +
    "Reference specific campaigns by name and proactively flag anything that needs attention during the coverage period.";

  // Load the covered AM's campaigns
  if (coveredEmail) {
    try {
      var campaignContext = getCampaignContext(coveredEmail);
      system += "\n\n--- " + covName.toUpperCase() + "'s ACTIVE CAMPAIGNS ---\n" + campaignContext;
      system += "\n\nAnswer questions about the campaigns above. Attribute any issues to specific campaigns by name.";
    } catch (e) {
      system += "\n\n(Could not load campaigns for " + coveredEmail + ".)";
    }
  }

  // KB routing
  var kbContent = _getRelevantKBContent(userMessage, coverageDoc);
  if (kbContent) {
    system += "\n\n--- KNOWLEDGE BASE ---\n" + kbContent;
    system += "\n\nReference the knowledge base above when answering process questions.";
  }

  // Coverage document + any supplemental context
  if (coverageDoc && coverageDoc.trim()) {
    var trimmed = coverageDoc.trim();
    var MAX_CHARS = 25000;
    if (trimmed.length > MAX_CHARS) trimmed = trimmed.substring(0, MAX_CHARS);
    system += "\n\n--- COVERAGE NOTES ---\n" + trimmed;
    system += "\n\nUse the coverage notes above for transition context, pending items, and any specific instructions left by " + covName + ".";
  }

  return system;
}

/**
 * Reads the text content of a Google Doc by URL.
 * The Doc must be accessible by the script's Google account.
 * @param {string} url - Google Doc URL
 * @returns {string} Plain text body of the document
 */
function readGoogleDoc(url) {
  if (!url || !url.trim()) return "";
  try {
    var doc = DocumentApp.openByUrl(url.trim());
    return doc.getBody().getText();
  } catch (e) {
    throw new Error("Could not open Google Doc. Make sure it's shared with your SiriusXM account and the URL is correct. (" + e.message + ")");
  }
}

// ── Utility ───────────────────────────────────────────────

/**
 * Verifies configuration. Run manually in the editor.
 */
function testStellaConfig() {
  var props = PropertiesService.getScriptProperties();
  var apiKey  = props.getProperty("LITELLM_API_KEY");
  var baseUrl = props.getProperty("LITELLM_BASE_URL") || "https://litellm.example.com";
  var model   = props.getProperty("LITELLM_MODEL")    || "claude-sonnet-4-6";
  var dbId    = props.getProperty("STELLA_DB_SHEET_ID");

  Logger.log("=== Stella Config Check ===");
  Logger.log("Base URL    : " + baseUrl);
  Logger.log("Model       : " + model);
  Logger.log("API Key     : " + (apiKey ? "set (" + apiKey.substring(0, 8) + "...)" : "NOT SET ⚠️"));
  Logger.log("DB Sheet ID : " + (dbId ? dbId : "NOT SET — run setupStella() ⚠️"));
  Logger.log("");

  if (!apiKey) Logger.log("ACTION: Set LITELLM_API_KEY in Script Properties.");
  if (!dbId)   Logger.log("ACTION: Run setupStella() to initialize the campaign database.");
  if (apiKey && dbId) Logger.log("All config OK. Deploy and test.");
}
