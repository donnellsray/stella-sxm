// ============================================================
// BillingKB.gs — Billing Wiki Knowledge Base
// Chunked knowledge base for the Billing Review Agent
//
// Architecture:
//   The full Billing 101 wiki (~100K chars) is split into
//   topic sections. The router function matches user queries
//   to relevant sections so only what's needed gets sent
//   to the LLM — keeping token usage low.
//
//   To update: replace the content in any section function.
//   To add sections: create a new function and add it to
//   KB_SECTIONS and KB_KEYWORDS.
// ============================================================

// ── Section registry ──────────────────────────────────────────
// Each entry maps a section key to its retrieval function,
// a display name, and keywords for matching.

var KB_SECTIONS = {
  "finance_teams":       { fn: kb_financeTeams,       name: "Finance Teams & Roles" },
  "am_expectations":     { fn: kb_amExpectations,      name: "AM Expectations & Communication" },
  "pre_sale":            { fn: kb_preSale,             name: "Pre-Sale Checklist & Setup" },
  "oms_billing_options": { fn: kb_omsBillingOptions,   name: "OMS Billing Options" },
  "oms_addl_billing":    { fn: kb_omsAdditionalBilling,name: "OMS Additional Billing Requirements" },
  "oms_invoice_req":     { fn: kb_omsInvoiceReq,       name: "OMS Invoice Requirements" },
  "nuanced_products":    { fn: kb_nuancedProducts,     name: "Nuanced Product Billing" },
  "client_billing":      { fn: kb_clientBilling,       name: "Client Billing Needs & Payment" },
  "prepayment":          { fn: kb_prepayment,          name: "Prepayment Process" },
  "cbs":                 { fn: kb_cbs,                 name: "Custom Billing Schedule (CBS)" },
  "post_sale_pre_launch":{ fn: kb_postSalePreLaunch,   name: "Post-Sale / Pre-Launch" },
  "io_approval":         { fn: kb_ioApproval,          name: "IO Approval Cases" },
  "io_approver_sections":{ fn: kb_ioApproverSections,  name: "IO Approval Case Approver Sections" },
  "io_navigation":       { fn: kb_ioNavigation,        name: "Navigating IO Approval Cases" },
  "io_escalations":      { fn: kb_ioEscalations,       name: "IO Approval Case Escalations" },
  "approval_to_run":     { fn: kb_approvalToRun,       name: "Approval to Run (A2R)" },
  "post_launch":         { fn: kb_postLaunch,          name: "Post-Launch Checklist" },
  "third_party_creds":   { fn: kb_thirdPartyCreds,     name: "3rd Party Credentials" },
  "client_reporting":    { fn: kb_clientReporting,      name: "Client-Provided Reporting" },
  "reporting_practices": { fn: kb_reportingPractices,   name: "3P Reporting Best Practices" },
  "manual_overrides":    { fn: kb_manualOverrides,      name: "Manual Overrides" },
  "under_delivery":      { fn: kb_underDelivery,        name: "Managing Under-Delivery & Billing" },
  "invoice_delays":      { fn: kb_invoiceDelays,        name: "Managing Invoice Delays" },
  "billing_close":       { fn: kb_billingClose,         name: "Billing Close" },
  "quarter_year_close":  { fn: kb_quarterYearClose,     name: "Quarter & Year-End Close" },
  "case_workflow":        { fn: kb_caseWorkflow,        name: "Billing Case Workflow & Best Practices" },
  "case_billing_docs":   { fn: kb_caseBillingDocs,      name: "Billing Case: Billing Documents" },
  "case_credit_rebill":  { fn: kb_caseCreditRebill,     name: "Billing Case: Credit/Rebill Request" },
  "case_cbs":            { fn: kb_caseCBS,              name: "Billing Case: CBS Inquiry" },
  "case_non_standard":   { fn: kb_caseNonStandard,      name: "Billing Case: Non-Standard Invoice" },
  "case_order_setup":    { fn: kb_caseOrderSetup,       name: "Billing Case: Order Setup" },
  "case_system_issue":   { fn: kb_caseSystemIssue,      name: "Billing Case: System Issue" }
};

// ── Keyword index for matching ────────────────────────────────
// Maps common query terms to relevant section keys.

var KB_KEYWORDS = {
  // Finance team structure
  "biller": ["finance_teams", "case_workflow"],
  "quality control": ["finance_teams", "io_approver_sections"],
  "qc": ["finance_teams", "io_approver_sections"],
  "credit collections": ["finance_teams", "io_approver_sections", "client_billing"],
  "c2": ["finance_teams", "io_approver_sections"],
  "3c": ["finance_teams"],
  "fvt": ["finance_teams", "am_expectations", "billing_close"],
  "finance virtual team": ["finance_teams", "am_expectations"],

  // AM workflow
  "expectation": ["am_expectations"],
  "communication": ["am_expectations", "case_workflow"],
  "transition": ["am_expectations"],
  "handoff": ["am_expectations"],
  "pto": ["am_expectations"],
  "coverage": ["am_expectations"],

  // Pre-sale
  "pre-sale": ["pre_sale"],
  "presale": ["pre_sale"],
  "checklist": ["pre_sale", "post_launch"],
  "before signing": ["pre_sale"],
  "net or gross": ["pre_sale", "oms_billing_options"],

  // OMS setup
  "oms": ["oms_billing_options", "oms_addl_billing", "oms_invoice_req"],
  "billing options": ["oms_billing_options"],
  "billing source": ["oms_billing_options"],
  "monthly budget breakout": ["oms_billing_options", "oms_addl_billing"],
  "mbb": ["oms_billing_options"],
  "isci": ["oms_billing_options", "oms_invoice_req"],
  "placement names": ["oms_billing_options"],
  "grouped invoices": ["oms_addl_billing"],
  "group invoices": ["oms_addl_billing"],
  "confirmation": ["oms_addl_billing", "case_billing_docs"],
  "confirm always": ["oms_addl_billing"],
  "confirm ud": ["oms_addl_billing"],
  "po number": ["oms_invoice_req"],
  "print on invoice": ["oms_invoice_req"],
  "edi": ["oms_invoice_req"],
  "prisma": ["oms_invoice_req"],

  // Products
  "fixed cost": ["nuanced_products"],
  "fixed rate": ["nuanced_products"],
  "flat rate": ["nuanced_products"],
  "flat fee": ["nuanced_products"],
  "podcast": ["nuanced_products"],
  "sponsorship": ["nuanced_products"],
  "satellite": ["nuanced_products"],
  "soundcloud": ["nuanced_products"],
  "programmatic": ["nuanced_products"],
  "admaker": ["nuanced_products", "client_billing"],
  "custom solutions": ["nuanced_products"],
  "cancellation": ["nuanced_products"],

  // Client billing
  "payment": ["client_billing", "prepayment"],
  "payment terms": ["client_billing"],
  "payment portal": ["client_billing"],
  "w9": ["client_billing"],
  "hold co": ["client_billing"],
  "agency": ["client_billing"],
  "prepay": ["prepayment"],
  "prepayment": ["prepayment"],
  "political": ["prepayment"],
  "pre-bill": ["client_billing"],
  "proforma": ["client_billing", "case_non_standard"],

  // CBS
  "cbs": ["cbs", "case_cbs"],
  "custom billing schedule": ["cbs", "case_cbs"],
  "custom billing": ["cbs", "case_cbs"],

  // IO Approval
  "io approval": ["io_approval", "io_approver_sections", "io_navigation"],
  "io case": ["io_approval", "io_navigation"],
  "pending planner": ["io_navigation"],
  "legal approval": ["io_approver_sections", "io_escalations"],
  "eoa": ["io_approver_sections"],
  "approval to run": ["approval_to_run"],
  "a2r": ["approval_to_run"],
  "atr": ["approval_to_run"],
  "escalation": ["io_escalations"],
  "1st party": ["post_sale_pre_launch"],
  "3rd party": ["post_sale_pre_launch", "third_party_creds", "reporting_practices"],
  "client paperwork": ["post_sale_pre_launch"],
  "rio": ["post_sale_pre_launch"],
  "revised io": ["post_sale_pre_launch"],

  // Post-launch
  "post-launch": ["post_launch"],
  "credentials": ["third_party_creds"],
  "dfa": ["third_party_creds", "reporting_practices"],
  "dcm": ["third_party_creds", "reporting_practices"],
  "flashtalking": ["third_party_creds"],
  "innovid": ["third_party_creds"],
  "adform": ["third_party_creds"],
  "extreme reach": ["third_party_creds"],
  "reporting": ["client_reporting", "reporting_practices", "case_billing_docs"],
  "3p reporting": ["reporting_practices"],
  "client provided": ["client_reporting"],

  // Manual overrides & UD
  "manual override": ["manual_overrides"],
  "override": ["manual_overrides"],
  "under delivery": ["under_delivery"],
  "under-delivery": ["under_delivery"],
  "ud": ["under_delivery", "oms_addl_billing"],
  "actualize": ["under_delivery", "manual_overrides"],
  "make good": ["under_delivery", "case_credit_rebill"],
  "makegood": ["under_delivery", "case_credit_rebill"],
  "make whole": ["under_delivery", "case_credit_rebill"],
  "incremental": ["under_delivery"],

  // Invoice delays
  "modified order": ["invoice_delays", "case_order_setup"],
  "invoice delay": ["invoice_delays"],
  "pending io": ["invoice_delays"],

  // Billing close
  "billing close": ["billing_close"],
  "close": ["billing_close", "quarter_year_close"],
  "invoice": ["billing_close", "oms_invoice_req"],
  "unbilled": ["billing_close"],
  "penny": ["under_delivery"],
  "rounding": ["under_delivery"],
  "quarter close": ["quarter_year_close"],
  "year end": ["quarter_year_close"],
  "year-end": ["quarter_year_close"],

  // Billing cases
  "case": ["case_workflow"],
  "billing case": ["case_workflow", "case_billing_docs", "case_credit_rebill"],
  "open a case": ["case_workflow"],
  "create a case": ["case_workflow"],
  "case type": ["case_workflow"],
  "credit rebill": ["case_credit_rebill"],
  "credit/rebill": ["case_credit_rebill"],
  "rebill": ["case_credit_rebill"],
  "credit": ["case_credit_rebill"],
  "short pay": ["case_credit_rebill"],
  "admin change": ["case_credit_rebill"],
  "billing documents": ["case_billing_docs"],
  "non-standard": ["case_non_standard"],
  "non standard": ["case_non_standard"],
  "order setup": ["case_order_setup"],
  "system issue": ["case_system_issue"],
  "bug": ["case_system_issue"],
  "dashboard": ["case_workflow", "billing_close"]
};

// ── Router: find relevant sections ────────────────────────────

/**
 * Given a user message + optional billing data, returns the
 * concatenated text of all relevant KB sections.
 * Falls back to a compact summary if no keywords match.
 *
 * @param {string} query - user message text
 * @param {string} [billingData] - pasted billing context
 * @returns {string} knowledge base content for the system prompt
 */
function getRelevantKB(query, billingData) {
  var combined = ((query || "") + " " + (billingData || "")).toLowerCase();
  var matchedKeys = {};

  // Score each section by keyword hits
  var keywords = Object.keys(KB_KEYWORDS);
  for (var i = 0; i < keywords.length; i++) {
    var kw = keywords[i];
    if (combined.indexOf(kw) !== -1) {
      var sections = KB_KEYWORDS[kw];
      for (var j = 0; j < sections.length; j++) {
        matchedKeys[sections[j]] = (matchedKeys[sections[j]] || 0) + 1;
      }
    }
  }

  // Sort by relevance score, take top 5 to stay within token budget
  var sorted = Object.keys(matchedKeys).sort(function(a, b) {
    return matchedKeys[b] - matchedKeys[a];
  });
  var topKeys = sorted.slice(0, 5);

  // If no keyword matches, return the case workflow + AM expectations as defaults
  if (topKeys.length === 0) {
    topKeys = ["case_workflow", "am_expectations"];
  }

  // Build output
  var parts = [];
  for (var k = 0; k < topKeys.length; k++) {
    var key = topKeys[k];
    var section = KB_SECTIONS[key];
    if (section && section.fn) {
      parts.push("=== " + section.name + " ===\n" + section.fn());
    }
  }

  return parts.join("\n\n");
}

/**
 * Returns a list of all available KB sections (for debugging/admin).
 */
function listKBSections() {
  var names = [];
  var keys = Object.keys(KB_SECTIONS);
  for (var i = 0; i < keys.length; i++) {
    names.push(keys[i] + ": " + KB_SECTIONS[keys[i]].name);
  }
  return names.join("\n");
}


// ============================================================
// SECTION CONTENT FUNCTIONS
// Each returns the wiki text for that topic.
// To update content: edit the return string below.
// ============================================================

function kb_financeTeams() {
  return [
    "FINANCE TEAMS:",
    "- Billing: Executes monthly billing decisions. Partners with CS to investigate discrepancies and produce invoices. Utilizes Slingshot to invoice campaigns. Invoicing happens every day, not just monthly.",
    "- Credit & Collections (C2): Works with sales to ensure credit is established. Reviews IOs and cases. Manages AR case types. Communicates with clients for payment.",
    "- Cash: Posts money, applies payments to invoices, processes refunds, reviews prepay IOs.",
    "- Cash + Credit & Collections = '3C' in Salesforce.",
    "- Quality Control (QC): Reviews IOs to ensure details match between contract and OMS. Performs pre and post-launch audits.",
    "",
    "FINANCE TEAM ALIGNMENTS:",
    "- Biller: Found in SF opportunity under 'Billing Coordinator' and IO Approval Case under 'Biller'.",
    "- Credit & Collections: Found in IO Approval Case under 'ERP Collector'.",
    "- Quality Control: Found in IO Approval Case under 'Quality Control Analyst'.",
    "",
    "FINANCE VIRTUAL TEAM (FVT):",
    "- Regional/segmentation-aligned CS Managers.",
    "- Oversee monthly/quarterly billing close for regions. Partner with Finance to improve processes.",
    "- Work as consultants for questions/concerns in their region.",
    "- FVT members found in SME / Virtual Team Directory."
  ].join("\n");
}

function kb_amExpectations() {
  return [
    "AM EXPECTATIONS FOR BILLING:",
    "- Jump on the phone: AR/Billing cases can cause confusion. Schedule 15-min calls for complicated issues.",
    "- Work with FVT: Finance Virtual Team CS Managers help with complicated issues/miscommunications.",
    "- CS Management Escalations: Work with CS Manager for confusion or problems during billing.",
    "- Billing Communication:",
    "  - Provide as much information as possible upfront in cases.",
    "  - Keep biller informed of situations impacting invoicing (e.g., UD on bill-in-full orders).",
    "  - Respond/update cases within 48 hours.",
    "  - Give billing team 48 hours for turnaround.",
    "  - Avoid slacking biller directly — use billing cases or email for initial outreach.",
    "- Pre-launch setup: Ensure OMS billing options, T&C, order identifiers, billing source all correct.",
    "- Live orders: Schedule weekly time to review outstanding billing items. Be proactive with UD.",
    "",
    "ACCOUNT TRANSITIONS:",
    "- Add new AM to existing billing cases.",
    "- Inform of current/previous specialty billing needs.",
    "",
    "PTO COVERAGE:",
    "- Inform coverage of outstanding items impacting billing close.",
    "- Set up Slack/Email OOO correctly so biller knows who to contact.",
    "- Keep CS Manager in loop of outstanding billing items."
  ].join("\n");
}

function kb_preSale() {
  return [
    "PRE-SALE CHECKLIST (before signing IO):",
    "- Bill on Net or Gross?",
    "- Calendar: Gregorian or Broadcast?",
    "- Bill-to Address, Bill-to Contact?",
    "- Pre-Pay? Was Pre-Pay IO sent?",
    "- Are ISCI Codes required?",
    "- Does client require specific Monthly Budget Breakout?",
    "- Does client require Grouped Invoices (by market, product, etc.)?",
    "- Does anything specific need to be printed on the invoice?",
    "- Are they using tags? Will they be billing off those? Confirm monthly budgets.",
    "- Any unique products on the campaign?",
    "- Confirm whether sales has credit established on the account.",
    "- Any special billing requirements impacting C2? (new client, specialty invoicing, IO/PO# on invoicing)",
    "- Ensure client has correct W-9 and payment information for the business unit of sale.",
    "- Client using a barter shop (Orion, Omnet)? Products broken out correctly?"
  ].join("\n");
}

function kb_omsBillingOptions() {
  return [
    "OMS BILLING OPTIONS:",
    "Keep billing in mind when setting up your order. Build the order the way the client expects to be billed.",
    "",
    "MONTHLY BUDGET BREAKOUT:",
    "- Whether product lines on IO should be broken out monthly.",
    "- YES = IO has flighting summary with specific monthly amounts. OMS lines should be broken out by month.",
    "- NO = No flighting summary, or client does not desire to follow monthly budgets exactly. Client confirmation needed if not following a flighting summary.",
    "",
    "ISCI CODE:",
    "- Used when client requests radio codes for audio spots on invoice (co-op/notarization).",
    "- YES = ISCI codes required. AM must enter ISCI codes in planner ISCI column in OMS.",
    "",
    "BILLING SOURCE:",
    "- Source of delivery for each line used for invoicing. Must align with client expectations.",
    "- If 3P billed: select appropriate vendor on each line in OMS.",
    "- If 1P billed: 'AudioServe' for audio, 'DFP' for display and video.",
    "- Engagement products: always 'Pandora'.",
    "- Non-guaranteed streaming: always 'AudioMatic'.",
    "- If wrong billing source selected, it prevents invoicing and causes credit/rebill.",
    "",
    "AD SERVER CREDENTIALS:",
    "- Filled out Post-Launch. Billing team needs account name/ID, profile name/ID, campaign name/ID to pull 3P reporting.",
    "",
    "PLACEMENT NAMES:",
    "- Input placement names into OMS that match 3P reporting and client IO.",
    "- Some clients require their own naming convention — use it to prevent billing issues."
  ].join("\n");
}

function kb_omsAdditionalBilling() {
  return [
    "OMS ADDITIONAL BILLING REQUIREMENTS (auto-pull into Slingshot and IO Approval Page):",
    "",
    "AGENCY DEADLINE: Communicate if agency has specific billing deadline (e.g., invoice by X day of month).",
    "",
    "MULTI-ORDER: Input all order links related to this IO.",
    "",
    "SYSTEM TICKET: Enter JIRA or ServiceNow links for system issues impacting invoicing.",
    "",
    "BARTER SHOP: Select Orion or OmNet if barter included.",
    "",
    "CONFIRMATION:",
    "- Do NOT initiate confirmations unless client requests on an order.",
    "- If confirmation needed for internal reasons (e.g., account setup error), must be approved by CS Manager.",
    "- Options:",
    "  - Confirm Always: Billing confirms delivered impressions/invoice amount before sending each month.",
    "  - Confirm UD Only: Billing confirms only when under-delivered.",
    "",
    "GROUP INVOICES: Invoices grouped by specific criteria.",
    "- Options: By Estimate, Market, Order Number, Placement, Publisher, Product, PCIDs, Other.",
    "",
    "REPORTING PROVIDED:",
    "- AM will provide reporting for invoicing (not automatic billing).",
    "- Options: Access not granted by Client, AM to Map Report, Brand Safety, Fraud, In-Demo, In-Geo, US Impressions Only, Viewability."
  ].join("\n");
}

function kb_omsInvoiceReq() {
  return [
    "OMS INVOICE REQUIREMENTS:",
    "",
    "PO NUMBER:",
    "- Defaults to Slingshot Order # for 1st Party Paperwork.",
    "- Blank default for 3rd Party Paperwork — replace with IO order number.",
    "",
    "PRINT ON INVOICE:",
    "- If client requires PO# or Order# printed on invoice, add to Print on Invoice field.",
    "- Multiple POs per month: add below the PO Number field.",
    "",
    "CALL LETTERS / MARKET / CLIENT / PRODUCT / ESTIMATE:",
    "- Used for EDI (electronic invoicing) — only for broadcast orders.",
    "- For non-EDI: place codes as Client:_/Product:_/Estimate:_/Other:_"
  ].join("\n");
}

function kb_nuancedProducts() {
  return [
    "NUANCED PRODUCT BILLING:",
    "",
    "FIXED COST PRODUCTS: Impressions not ingested, flat rate applied. Billed at start date.",
    "- Example: Production Fee.",
    "",
    "FIXED RATE PRODUCTS: Impressions ingested but flat rate applied. Billed at start date.",
    "- Example: Podcast Episode Sponsorship.",
    "- Built in OMS off CPM and forecasted impressions. Bill on forecast, not delivery.",
    "- CPM and impressions listed are for reference only.",
    "- Invoiced in full in month of start date after launch.",
    "- Rebills for extenuating circumstances require CS Leadership + Billing + QC approval.",
    "",
    "FLAT RATE/FLAT FEE PRODUCTS (e.g., Podcast Custom Solutions, Sponsored Stations):",
    "- Purchased and billed on contracted amounts, quantities not guaranteed.",
    "- Baked-in custom lines NOT included in end-of-month actualization.",
    "- IO/invoice shows CPM as total cost when impressions zeroed out.",
    "- Billed in-full regardless of whether trafficked in Slingshot.",
    "",
    "CANCELLATIONS & FLIGHT CHANGES:",
    "- AMs must zero out revenue and/or delete line prior to start date.",
    "- Notify biller before line is billed if cancellation/change is delayed.",
    "- Billers auto-invoice sponsorships in month of start date — communicate quickly if canceled.",
    "",
    "SIRIUSXM SATELLITE:",
    "- Booked in OMS but not served through ad server. Billing handled manually.",
    "- Campaigns bill off 1P numbers only. Run via spots, invoiced by impressions.",
    "- Note as 'client provided' ad server. Biller manually adds delivered impressions to Slingshot.",
    "- No billing cases needed to invoice.",
    "",
    "SOUNDCLOUD CUSTOM SOLUTIONS:",
    "- Not served through our ad servers. Monthly billing process required.",
    "- AM copies billing template, updates campaign details, uploads monthly delivery from SoundCloud.",
    "- Upload to SF opportunity first day of month. Open billing case to notify billing team.",
    "- Quarter close: must be completed on first of month even on weekends/holidays.",
    "",
    "PROGRAMMATIC: Billing done through DSP. Internal billing does not handle. Contact Programmatic Ops for issues."
  ].join("\n");
}

function kb_clientBilling() {
  return [
    "CLIENT BILLING NEEDS:",
    "",
    "PAYMENT PORTAL: SXM Media Customer Portal for ACH (preferred), credit card, invoice viewing, payment history.",
    "- Credit card payment requires pre-approval from Finance Leadership.",
    "- Clients can pre-pay if they meet criteria.",
    "",
    "ESTABLISHING CREDIT: Sales responsibility. IO Approval and launch held up without credit.",
    "",
    "HOLD CO BILLING: For WPP, OMG, Horizon, IPG, Publicis, Dentsu — ensure correct Upfront selection in SF opportunity. Use Agency Partnership Resources for billing requirements.",
    "",
    "PAYMENT TERMS:",
    "- Standard: Net 30 (N30).",
    "- Extended terms (N45/N60/N90) require finance approval from Bob Mello or Scott Almendarez.",
    "- N45: $1M+ previous spend, current on AR. N60: $2M+. N90: $3M+.",
    "- Submit via: Opportunity Case > AR Internal > Extended Payment Terms Request.",
    "",
    "PRE-BILL LETTERS (ProForma Invoice):",
    "- Should be avoided if possible. Explain client will receive monthly invoices first.",
    "- SLA: 2 business days when all info provided.",
    "- Request via Billing Case > Non-Standard Invoice type."
  ].join("\n");
}

function kb_prepayment() {
  return [
    "PREPAYMENT PROCESS:",
    "- Non-political: Must pay in full prior to launch, no exceptions.",
    "- Required for clients who don't pass credit check, and political clients.",
    "- Only political campaigns can have installments (max 3).",
    "- Any prepaid campaign can be paid via credit card.",
    "",
    "OMS/IO SETUP:",
    "- T&C: Select 'Pre-pay' under Additional Terms.",
    "- Select 'SiriusXM Media Paperwork with Changes'.",
    "- Payment Terms: Select 'Pre-Pay'.",
    "- Add payment schedule to Print on IO notes.",
    "",
    "SALESFORCE SETUP (Political only):",
    "- Input payment schedule in IO Approval Case tracker. Total must match OMS approved amount.",
    "- Select Pre-Payment Tracker button in IO Approval Case.",
    "",
    "CLIENT SETUP:",
    "- Preferred: Client portal payment. Send relevant info from Prepayment External Guide.",
    "- Sales responsible for portal username/password via AR Internal case (up to 3 business days).",
    "- Client must include Slingshot ID (P#) in payment remittance.",
    "",
    "AM TIP: Client needs portal access at least 10 business days before launch."
  ].join("\n");
}

function kb_cbs() {
  return [
    "CUSTOM BILLING SCHEDULE (CBS):",
    "- Invoicing schedule based on specific client billing requirements, often different from delivery schedule.",
    "- Example: Client front-loads invoiced dollars but delivers evenly.",
    "- Highly recommended to AVOID CBS — heavy lift for CS and Billing. Treat as exception.",
    "",
    "WHAT CBS IS NOT:",
    "- If billing based on what's in Slingshot, that's standard — not CBS.",
    "- CBS cannot accommodate multiple orders. Only ONE order per CBS.",
    "",
    "CONSIDERATIONS:",
    "- CBS lines must be flighted to touch both billing month and running month.",
    "- Must have IO approved before setting up CBS. Must be set up before launch.",
    "- Submitting CBS after invoicing started = credit/rebill needed.",
    "",
    "UD RECONCILIATION WITH CBS:",
    "- Make-goods to cover UD (notate clearly).",
    "- One long flight with final invoice adjusted.",
    "- Actualized balance updates affecting monthly total.",
    "",
    "SETUP REQUIREMENTS:",
    "- Open 'Custom Billing Schedule Inquiry' case before launch.",
    "- Include: client request, Excel with campaign name/billing schedule by PCLID/monthly dollars, UD plan, client confirmation.",
    "- Requires Billing & CS Manager approvals.",
    "- No AM action needed in OMS for setup — Billing handles backend.",
    "",
    "ORDER REVISIONS WITH CBS:",
    "- Open NEW CBS case for changes to monthly dollars or payment schedule.",
    "- AM should NOT make OMS changes until reviewed by Billing."
  ].join("\n");
}

function kb_postSalePreLaunch() {
  return [
    "POST-SALE / PRE-LAUNCH:",
    "",
    "CHECKLIST: Submit IO for Approval. Manage Pending Planner items. Secure approval from all teams.",
    "",
    "1ST PARTY PAPERWORK (SXM Paperwork):",
    "- Without Changes: Auto-generated by OMS, uploaded to SF, sent via Adobe Sign. No AM approvals needed.",
    "- With Changes: Generated by OMS, sent via Adobe Sign. Mainly auto-approved but some changes need additional approvals.",
    "",
    "3RD PARTY PAPERWORK (Client Paperwork):",
    "- Not generated in OMS — manual IO approval process.",
    "- Upload to SF Content section as 'Insertion Order' type.",
    "- Navigate to OMS Approvals > Approve, verify T&C and Billing Options match IO.",
    "- Submit for CS Manager approval first, then routed to approver teams.",
    "- Do NOT countersign without final approval from all internal teams.",
    "- Once approved, counter-sign and update OMS signature status.",
    "",
    "REVISED IOs (RIOs):",
    "- Reference RIO Matrix to determine if RIO is needed.",
    "- 'Positive Email' = client email approval needed. 'Negative Email' = no client approval needed.",
    "- 1st Party: Push RIO through OMS for signature.",
    "- Client Paperwork: Upload new version via 'Upload New Version' button in SF Content section."
  ].join("\n");
}

function kb_ioApproval() {
  return [
    "IO APPROVAL CASES:",
    "- Auto-created when order approved by CS Manager in OMS. Linked to SF opportunity.",
    "- Find via: OMS (Order Sub-Status > IO Approval Status), Slingshot (Status section), SF Opportunity (IO Approvals tab).",
    "",
    "CREATING PENDING IO APPROVAL REPORT:",
    "- SF Homepage > IO Approval menu > New view.",
    "- Filter: All IO Approvals, Account Manager = your name, Status = pending/rejected.",
    "- Recommended columns: IO Detail Number, Opportunity, Contract Start Date, Status, Opportunity Amount, CQ Revenue at Risk, approval statuses."
  ].join("\n");
}

function kb_ioApproverSections() {
  return [
    "IO APPROVAL CASE APPROVER SECTIONS:",
    "",
    "LEGAL:",
    "- Approving team: Legal Sales Support.",
    "- Checks: T&C matching between IO and OMS.",
    "- Common rejections: Editorial adjacency, UGC terms, choice of law, brand safety/fraud/viewability terms.",
    "- Escalation: See Legal Escalation Coverage Wiki (business hours) or email legal-salessupport@pandora.com.",
    "",
    "IO AUDIT REVIEW:",
    "- Approving team: Quality Control.",
    "- Checks: Info matching between OMS and IO. Pre-launch and post-launch audits.",
    "- Escalation: #cs_finance_process. Afterhours POC in QC Wiki Calendar tab.",
    "",
    "CREDIT & COLLECTIONS:",
    "- Approving team: Credit & Collections.",
    "- Checks: Credit established, outstanding invoices, credit utilization.",
    "- May reject if unpaid invoices exist — Sales needs to work with client.",
    "- Escalation: #cs_finance_process. Reviews 3x/day, responds within 24 hours. Urgent same-day after 12pm PST/3pm EST only.",
    "",
    "EOA REVIEW:",
    "- Mainly auto-approved. QC approves if not auto-flipped.",
    "- 1P Paperwork: EOA auto-updates when co-signed in EchoSign.",
    "- Client Paperwork: CS manually updates signature status in OMS.",
    "- Will NOT auto-flip if: A2R from CS Manager, or rejection from another team.",
    "- EOA not required to launch, but co-signed signature status IS required."
  ].join("\n");
}

function kb_ioNavigation() {
  return [
    "NAVIGATING IO APPROVAL CASES:",
    "",
    "COMMUNICATION: IO approval page chatter for all approvers. Upload client confirmations to SF Opportunity Contents, NOT to case.",
    "",
    "IO APPROVAL CONTENT UPLOADS:",
    "- Insertion Orders: Content Type 'Insertion Orders'. One/most recent version only. RIOs use versioning.",
    "- Client Confirmations: Content Type 'Client Confirmation'.",
    "- Reports: Content Type 'Reports'.",
    "",
    "STATUS INDICATORS:",
    "- Thumbs up/down for launch, invoicing, revenue recognition.",
    "- Traffic lights: Green = approved, Red = pending AM or approver action.",
    "- 'Ok to greenlight' = fully approved and ready to traffic.",
    "- Note: Post-launch audit may still be pending even if 'Ok to greenlight'.",
    "",
    "PENDING PLANNER STATUS:",
    "- Means AM action required before approver team can proceed.",
    "- Review team comments, address action needed.",
    "- Once complete: click pencil > select 'Pending Team' > Save.",
    "- Add comments and tag approver.",
    "",
    "IO AUDIT CASES (sub-cases):",
    "- Access via 'Cases' tab within IO Approval Case.",
    "- Pre-Launch Audit: Order entry accuracy. Once approved, AM can greenlight.",
    "- Post-Launch Audit: Billing accuracy. Once approved, invoice can be processed.",
    "- If 'Pending Planner': review comments, address issues, flip to 'Pending Quality Control'.",
    "",
    "AM TIP: If Legal, C2, and Pre-Launch are green but launch still thumbs down — check: Opportunity is Closed Won, IO Signature Status updated to signed/countersigned."
  ].join("\n");
}

function kb_ioEscalations() {
  return [
    "IO APPROVAL CASE ESCALATIONS:",
    "",
    "LEGAL: See Legal Escalation Coverage Wiki (business hours). Email legal-salessupport@pandora.com (after hours).",
    "IO AUDIT: #cs_finance_process. Mon-Thu afterhours POC in QC Wiki Calendar. Friday POC in #cs_finance_process.",
    "CREDIT & COLLECTIONS: #cs_finance_process. 24hr response SLA. Urgent same-day after 12pm PST/3pm EST only. Summer Fridays: one collector, urgent only.",
    "EOA: None (automated)."
  ].join("\n");
}

function kb_approvalToRun() {
  return [
    "APPROVAL TO RUN (A2R):",
    "- Override in IO Approval Case to launch without all approvals. NOT a way to skip approvals.",
    "- Only for business-critical launches held up by IO Approval delays.",
    "- Starting a campaign = 'acceptance of terms' per IAB — use sparingly.",
    "- AM should NOT sign IO or agree to terms until all internal approvals are in.",
    "",
    "WHEN TO SEEK A2R:",
    "- Campaign must launch ASAP (inevitable UD, short/1-day flights).",
    "- All IO approvers contacted via chatter and unable to provide approvals.",
    "- Credit section MUST be approved. No A2R without credit, no exceptions.",
    "",
    "HOW TO REQUEST:",
    "- IO Approval Case > Activity tab > create new Task > assign to CS Manager.",
    "- Include: need for A2R, tentative timeline, next steps.",
    "",
    "CS MANAGER REVIEW:",
    "- Confirms AM has chattered appropriate teams.",
    "- Confirms business-critical need.",
    "- Pending Credit? No A2R, no exceptions.",
    "- Pending Legal? Manager checks with Legal via chatter.",
    "- Pending QC? OK to approve A2R.",
    "",
    "AFTER A2R APPROVED: AM can launch but must continue resolving pending items. Set calendar reminders."
  ].join("\n");
}

function kb_postLaunch() {
  return [
    "POST-LAUNCH CHECKLIST:",
    "- Input/update 3P credentials if needed.",
    "- Set expectations for 3P reporting format and timing.",
    "- Upload scripts for notarization if needed.",
    "- Input/update ISCI codes if needed.",
    "- Check on UD and optimize/shift prior to end of period.",
    "- Utilize Billing Close reporting to identify and troubleshoot billing obstacles.",
    "- Monitor and manage open billing cases."
  ].join("\n");
}

function kb_thirdPartyCreds() {
  return [
    "3RD PARTY CREDENTIALS:",
    "- Must be added in OMS for billing to access delivery data. Ideally within a week of launch.",
    "- Path: OMS > Approvals > Approve > Billing Options.",
    "",
    "DFA/DCM: Select DFA as billing source. Add login credentials from client/tagsheet. Input Profile ID, Advertiser ID, Campaign ID.",
    "FLASHTALKING: Select FlashTalking. Credentials from 1Password. Input Username, Password, Campaign Name.",
    "INNOVID: Select Innovid. Credentials from client/tagsheet. Input Username, Password, Campaign Name.",
    "ADFORM & EXTREME REACH: Reporting always provided by AM.",
    "",
    "IF ACCESS NOT GRANTED:",
    "- Still select appropriate billing source based on IO.",
    "- OMS Billing Options: Select 'Reporting Provided' > 'Access not granted by Client'.",
    "- Optionally enter 'Access not Granted' in credentials field.",
    "",
    "3P LOGINS: Found in 1Password under 'Campaign Reporting - 3P Logins' vault."
  ].join("\n");
}

function kb_clientReporting() {
  return [
    "CLIENT-PROVIDED REPORTING:",
    "- 'Client Provided' should NEVER be selected as Billing Source for streaming/podcast products.",
    "- Billing source must always align with IO's billing source with the 3P vendor.",
    "- If using DFA/DCM without access: still select 'DFA' as billing source, then select 'Reporting Provided' > 'Access not granted by Client'.",
    "- If no access to 3P: AM provides monthly billing reports from client.",
    "- Adform and Extreme Reach reporting always provided by AM.",
    "- AMs need to format client-provided reporting for billing team."
  ].join("\n");
}

function kb_reportingPractices() {
  return [
    "3P REPORTING BEST PRACTICES:",
    "",
    "OMS SETUP: Placement names match IO/3P reporting. 3P credentials entered. Note if billing US impressions only.",
    "",
    "WHO PROVIDES 3P REPORTING:",
    "- With proper credentials: Billing team pulls reports.",
    "- Missing credentials: Billing opens case requesting credentials/reporting from AM.",
    "- AM TIP: Test credentials in the server directly before billing.",
    "",
    "3P REPORTING REQUIREMENTS (when AM provides):",
    "- Excel with 2 tabs: 'Raw Data' (daily delivery from 3P) + 'Date Range' (pivot table with dates/placement/impressions).",
    "- Include: delivered impressions (unmodified), placement names, date range in tab label, SUM of impressions.",
    "- Add column mapping lines to PC LIDs.",
    "- Naming: SlingshotOrderID_3P_Delivery_Report_MonthYear.",
    "- Upload to 'Files' of billing case for corresponding month.",
    "",
    "GUIDELINES:",
    "- No manipulated or client-provided reports.",
    "- Submit within 5 business days post-flight via Billing Case.",
    "- ARIA is NOT valid reporting.",
    "- Delivered impressions must match PCLIDs.",
    "- Include Added Value lines in reporting.",
    "- Keep biller updated on reporting delays during close."
  ].join("\n");
}

function kb_manualOverrides() {
  return [
    "MANUAL OVERRIDES:",
    "- Used when lines need changes in OMS after line ends or when editing would change billable total of past month.",
    "- CS Manager makes the change in OMS.",
    "- Commonly used to actualize delivery so UD dollars shift to future flights.",
    "",
    "EMAIL TEMPLATE:",
    "- Subject: Manual Override",
    "- Include: OMS Link, SS Link, LID to update, Revised Dollars, Revised Imps, Line CPM, New Order Total.",
    "",
    "TIPS:",
    "- Must submit for approval after override. Manager can't do override and approval simultaneously.",
    "- Orders at 75%+: cannot shift audio line start dates from past to future — line must be rebooked.",
    "- If overriding an already-invoiced line: OMS will warn. Open credit/rebill case with biller."
  ].join("\n");
}

function kb_underDelivery() {
  return [
    "MANAGING UNDER-DELIVERY & BILLING:",
    "",
    "SHIFTING UD BETWEEN PERIODS:",
    "- Actualize based on 1P or 3P delivery, shift impressions to future flight.",
    "- Manual override may be needed.",
    "- If line already billed: billable amount must match invoice.",
    "- Client email confirmation needed — upload to SF Opportunity Contents as 'Client Confirmation'.",
    "",
    "BILLING IN FULL DESPITE UD:",
    "- Must have client email requesting to bill in full.",
    "- Reach out to biller for next steps (varies by product/setup).",
    "- Open billing case per established next steps.",
    "- Upload client confirmation to SF.",
    "- TIP: Orders bill day after impressions ingest on last flight end date. Reach out ASAP to avoid rebill.",
    "",
    "ADDING INCREMENTAL:",
    "- Check if period already invoiced (see 'How do I know if invoice was pushed').",
    "- If no invoice: proceed.",
    "- If invoice exists: open Credit/Rebill case. Ask biller to void or rebill.",
    "",
    "PENNY ROUNDING:",
    "- Options: Manual override to correct CPM, ask client to revise IO, client agrees to shortpay by a penny.",
    "- Upload client confirmation of shortpay.",
    "- If adjusting CPM on already-billed line: work with biller to protect past billing."
  ].join("\n");
}

function kb_invoiceDelays() {
  return [
    "MANAGING INVOICE DELAYS:",
    "",
    "MODIFIED ORDER: Recent changes need to push to ad server. Cannot invoice in modified state.",
    "- Resolve: Push changes, submit RIO, or delete added lines until invoice generated.",
    "- Biller may open case to alert AM.",
    "",
    "PENDING IO APPROVAL CASE: Address pending sections. Check rejection reasons in drop-down.",
    "- Flip pending planner status to correct party once addressed.",
    "",
    "OPEN FINANCE CASES:",
    "- Billing Documents: Provide report, troubleshoot 1P vs 3P discrepancies, provide mapping.",
    "- Order Setup: Credentials, ISCI codes, EDI, budget breakout, modified status.",
    "- Credit/Rebill: Order needs rebill or credit.",
    "- System Issue: Confirm totals, troubleshoot.",
    "- CBS: Provide info to execute schedule.",
    "",
    "INCORRECT BILLING OPTIONS: Correct in OMS.",
    "MISSING ISCI CODES: Add to Slingshot fields. If too long, add to placement names.",
    "MISSING 3P CREDENTIALS: Input into OMS.",
    "MONTHLY BILLING BREAKOUT: Ensure laid out clearly with client confirmation."
  ].join("\n");
}

function kb_billingClose() {
  return [
    "BILLING CLOSE:",
    "",
    "WHEN INVOICES GENERATED: Month-end or campaign end (whichever first). Generated Mon-Fri (except holidays).",
    "",
    "BILLING CLOSE TIMELINE (first 5 days after billing period):",
    "- Day 1: All billable 1P orders reviewed and billed or case opened.",
    "- Day 2-3: DFA bot generates invoices for 3P/DFA campaigns. Troubleshooting begins.",
    "- Day 4: Focus on problematic orders.",
    "- Day 5: Focus on all other 3P orders.",
    "",
    "HOW TO CHECK IF INVOICE WAS PUSHED:",
    "- Slingshot > 'BILLER' view > 'INVOICES' tab > look for corresponding month in 'SENT TO ORACLE ERP'.",
    "",
    "AM BILLING CLOSE RESPONSIBILITIES:",
    "- Unbilled invoices from prior months.",
    "- Pending IO Approval Cases (including A2R campaigns).",
    "- Open Billing Cases.",
    "- Ad Server/Network credentials.",
    "- ISCI codes, notarized scripts (if applicable).",
    "",
    "BILLING CLOSE REPORTS (sent by FVT):",
    "- Pre-close Activities Report: Missing ISCI, billing breakout confirmation, 3P credentials.",
    "- Billing Close Email includes:",
    "  - Unbilled Campaigns (National): Delivering = no action. Modified = action needed. Case # = AM action.",
    "  - IO Approval Cases Pending CS.",
    "  - Open Cases: AR & IO Audit.",
    "  - Campaigns Missing Additional Billing Requirements."
  ].join("\n");
}

function kb_quarterYearClose() {
  return [
    "QUARTER & YEAR-END CLOSE:",
    "",
    "CHECKLIST:",
    "- Bill in Full: Get explicit client confirmation. Open case for manual override.",
    "- CBS: Follow reconciliation process per client agreement.",
    "- Rebilling: Up to 2 periods = standard process. 3+ periods = escalate to billing management.",
    "- Check personal finance dashboards. Address pending items. Answer open cases every 2 business days.",
    "- Keep billers informed of modified orders post-invoicing.",
    "- Pay attention to FVT Quarter Close emails.",
    "- PTO: Alert biller on coverage.",
    "- Use #cs-finance-process for urgent IO Approval escalations.",
    "",
    "PREPARING FOR NEXT YEAR:",
    "- Revisit client confirmations/billing notes.",
    "- Ensure 3P server access for new campaigns.",
    "- Review annually: Remove outdated requirements. Align billing notations.",
    "- Optimization: Consider 'Confirm if UD' instead of 'Confirm Always'. Request variance tolerance.",
    "",
    "CLIENT PAYMENT DELAYS:",
    "- Automated notices: 10 days before due, 1/15/30/45 days past due.",
    "- C2 contacts clients via notices, email, phone.",
    "- C2 enlists Sales if no response, CS if order/delivery/billing questions.",
    "- Last resort: outside collections or legal."
  ].join("\n");
}

function kb_caseWorkflow() {
  return [
    "BILLING CASE WORKFLOW & BEST PRACTICES:",
    "",
    "Billers open cases when auditing or when more info needed. Most around Billing Close. CS can also open cases from opportunity.",
    "",
    "CREATING A CASE: SF Opportunity > New Case > Billing Case.",
    "",
    "CASE FIELDS:",
    "- Priority: Based on urgency.",
    "- Type: AdMaker Billing Inquiry, Billing Documents, Credit/Rebill Request, Custom Billing Schedule Inquiry, Non Standard Invoice, Order Setup, System Issue.",
    "- Case Reason: Varies by type.",
    "- Status: New.",
    "- Subject: Overview + service month/year (e.g., 'Rebill for July 2025').",
    "- Internal Comments: Fill per case type template.",
    "",
    "BEST PRACTICES:",
    "- Keep related issues in ONE case. Don't open multiples.",
    "- All communications in case comments (NOT chatter).",
    "- Respond within 2 business days.",
    "- Day 4 with no response: Billing escalates to CS Manager.",
    "- Day 5: Billing escalates to Billing Supervisor.",
    "- Upload relevant files to case 'Files' section.",
    "- After responding: change case owner back to biller's name.",
    "",
    "CLIENT CONFIRMATION REQUIRED FOR:",
    "- Billing source/server modifications.",
    "- Significant under-delivery.",
    "- Custom billing schedule.",
    "- Credit/rebill (if client-requested).",
    "- Confirmation billing requirements.",
    "- Special instructions or billing agreements.",
    "- Order deviations from IO.",
    "",
    "PERSONAL FINANCE DASHBOARD: Check actively throughout week. Use SF Dashboard Template to create."
  ].join("\n");
}

function kb_caseBillingDocs() {
  return [
    "BILLING CASE TYPE: BILLING DOCUMENTS",
    "- When to use: Client confirmation requests, UD confirmations, reporting requests.",
    "- Case Reasons: Billing Confirmation, Delivery Report.",
    "",
    "BILLING CONFIRMATION:",
    "- Client requests confirmation of billable total before invoice issued.",
    "- Should have 'Confirmation' selected in OMS Additional Billing Requirements.",
    "- Do NOT initiate unless client requests. If needed internally, partner with manager.",
    "- ALWAYS get billable amount from biller before confirming with client.",
    "- Have client confirm within 48 hours.",
    "- Upload confirmation to SF Opportunity Contents as 'Billing Documents'.",
    "",
    "TO AVOID CONFIRMATION DISCREPANCIES:",
    "- If billing aligns consistently: consider removing requirement.",
    "- Suggest 'Confirm UD Only' instead of 'Confirm Always'.",
    "- Ask if client accepts variance tolerance (e.g., up to $1).",
    "",
    "DELIVERY REPORT:",
    "- See 3P Reporting Best Practices.",
    "- Attach report to case 'Files' tab.",
    "- PC IDs mapped to correct lines. Correct date selections. Pivoted + raw data."
  ].join("\n");
}

function kb_caseCreditRebill() {
  return [
    "BILLING CASE TYPE: CREDIT/REBILL REQUEST",
    "- When to use: Any time an already-created invoice needs revision or credits applied.",
    "",
    "BEFORE SUBMITTING:",
    "- Align with client but DO NOT agree to credit/rebill or make OMS changes without CS Manager + Billing approval.",
    "- Check if invoice already paid: SF Opportunity > Invoices tab > Payment Amount column.",
    "- If seeking credit: Sales + CS get Sales Director email approval.",
    "",
    "EXPLORE ALTERNATIVES FIRST:",
    "- Short Pay: Client pays less than invoiced (e.g., $0.01 over).",
    "- Admin Change: For non-dollar updates (client/product/estimate, PO#, print on invoice, call letters, bill-to, campaign name, adjustments <$1). Submit as Credit/Rebill case type for review.",
    "- End of Campaign Adjustment: Penny rounding, round up on final invoice.",
    "- Make Good / Make Whole: Offer AV impressions at $0 (with PYM approval) instead of rebill.",
    "- Addition to Future Campaign.",
    "",
    "HOW TO SUBMIT:",
    "- SF Opportunity > Cases tab > New > Billing Case > Credit/Rebill Request.",
    "- Fill in case reason, subject, internal comments with template.",
    "- Attach: Client confirmation on payment, Sales Director approval (credits only).",
    "- Assign to CS Manager for review and approval.",
    "",
    "REBILL CASE TEMPLATE:",
    "- Invoice Month/Number, Current Amount, New Requested Amount.",
    "- Summary of request (root cause, why no alternative accepted).",
    "- Sales Director approval (credits only).",
    "- Origination: SXM or Client caused.",
    "- Prevention: Steps to prevent future rebills.",
    "- For admin changes: specify lines/amounts changing, list previous admin changes.",
    "",
    "CS MANAGER REVIEWS: Alternate solutions explored, correct reconciliation, template/documentation complete, client confirmations.",
    "If approved: Manager approves in case comments, changes owner to Biller.",
    "",
    "AFTER APPROVAL: Biller confirms and submits. Revised invoice processed and sent to client.",
    "",
    "CREDIT/REBILL CASE REASONS:",
    "- Account Setup, Actualization, Additional Invoice Requirement, Ad Server Changed, Association Error, Billed in Error, Billing Contact, Billing Option, Bug, Canceled or Paused, Delivery, Fixed Line Change, Insertion Order, Report Preparation Error."
  ].join("\n");
}

function kb_caseCBS() {
  return [
    "BILLING CASE TYPE: CUSTOM BILLING SCHEDULE INQUIRY",
    "- When to use: Open before campaign starts to set up billing schedule different from order build.",
    "- Before submitting: Get client request email + agreement on UD handling. Create billing schedule Excel with all LIDs and monthly amounts.",
    "- Template: Client request, CBS detail Excel, Under-delivery plan.",
    "- See Custom Billing Schedule section for full details."
  ].join("\n");
}

function kb_caseNonStandard() {
  return [
    "BILLING CASE TYPE: NON-STANDARD INVOICE",
    "- When to use: Request non-standard invoice.",
    "- Types: Ad Network, Manual invoice from spreadsheet, Proforma Invoice (pre-bill letter), SXM Media manual invoices (e.g., Roku).",
    "- Template: Campaign start/end dates, campaign total, billing period total (if specific), specified lines and amounts."
  ].join("\n");
}

function kb_caseOrderSetup() {
  return [
    "BILLING CASE TYPE: ORDER SETUP",
    "- When to use: Finance opens regarding order setup affecting invoicing.",
    "- Types: Billing Server, EDI, Grouped Invoices, Missing Credentials, Missing ISCI Codes, Modified Order, Monthly Budget Breakout, Order Audit.",
    "- Template: Upload confirmation as 'Billing Document' to SF Opportunity Contents. Include request detail."
  ].join("\n");
}

function kb_caseSystemIssue() {
  return [
    "BILLING CASE TYPE: SYSTEM ISSUE",
    "- When to use: System issue arises affecting billing.",
    "- Types: Auto Audit, Bug, Ingestion Error.",
    "- Template: System issue detail, periods impacted, JIRA ticket link."
  ].join("\n");
}
