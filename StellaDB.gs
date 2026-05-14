// ============================================================
// StellaDB.gs — Campaign Data Layer
// Google Sheets-backed per-AM campaign storage
//
// Setup:
//   Run setupStella() once from the Apps Script editor.
//   This creates the master Sheet and stores its ID in
//   Script Properties as STELLA_DB_SHEET_ID.
//
// Architecture:
//   One Google Sheet, one tab per AM (keyed to SXM email).
//   Each row = one campaign. Tabs are created automatically
//   on first login. AMs only ever read/write their own tab.
// ============================================================

// ── Column definitions ────────────────────────────────────
// Single source of truth — update here if columns change.

var DB_COLUMNS = [
  "Opportunity Name",   // A
  "Slingshot ID",       // B
  "OMS ID",             // C
  "Sales Rep",          // D
  "Start Date",         // E
  "End Date",           // F
  "Campaign Status",    // G  LIVE | UPCOMING | ENDING SOON | ENDED
  "Flight Status",      // H  LIVE | TRAFFICKED | PENDING | ENDED | DIF
  "Pacing %",           // I  numeric (107 = 107%)
  "Traffic Ticket",     // J  THRM-######
  "Reporting Ticket",   // K
  "Misc Ticket",        // L
  "Campaign Notes",     // M
  "Last Updated",       // N  auto-managed
  "Salesforce URL",     // O  full SF opportunity link
  "IO Case URL",        // P  SF IO Approval case link
  "Launch Date",        // Q  actual launch date
  "Additional Tickets", // R  JIRA IDs or URLs, one per line
  "Flight Notes",       // S  free-text flight date ranges (e.g. 5/1-5/9, 5/10-5/24)
  "DAM Folder URL",     // T  link to asset/creative folder
  "Ad Ops Castle URL",  // U  SF Ad Ops Castle link (randomized per campaign)
  "1P Billing",         // V  boolean — first-party billing applies
  "3P Billing",         // W  boolean — third-party billing applies
  "3P Pacing"           // X  JSON — 3P pacing data {flights:[{id,start,end,rows:[...]}]}
];

var COL = {};
DB_COLUMNS.forEach(function(name, i) {
  COL[name] = i; // zero-based index
});

// ── One-time setup ────────────────────────────────────────

/**
 * Run ONCE from the Apps Script editor to initialize Stella.
 * Creates the master Google Sheet and stores its ID.
 * Safe to re-run — skips creation if already configured.
 */
function setupStella() {
  var props = PropertiesService.getScriptProperties();

  // Check if already set up
  var existingId = props.getProperty("STELLA_DB_SHEET_ID");
  if (existingId) {
    try {
      SpreadsheetApp.openById(existingId);
      Logger.log("Stella DB already initialized. Sheet ID: " + existingId);
      return;
    } catch (e) {
      Logger.log("Stored Sheet ID no longer valid — recreating.");
    }
  }

  // Create the master spreadsheet
  var ss = SpreadsheetApp.create("Stella AI — Campaign Database");
  props.setProperty("STELLA_DB_SHEET_ID", ss.getId());

  // Remove the default blank sheet
  var defaultSheet = ss.getSheets()[0];
  defaultSheet.setName("_index");

  // Set up the index tab
  defaultSheet.getRange("A1").setValue("AM Email");
  defaultSheet.getRange("B1").setValue("Tab Name");
  defaultSheet.getRange("C1").setValue("First Login");

  Logger.log("Stella DB created successfully.");
  Logger.log("Sheet ID: " + ss.getId());
  Logger.log("Sheet URL: " + ss.getUrl());
  Logger.log("Next step: share this sheet with yourself and any AMs who need access.");
}

// ── Internal helpers ──────────────────────────────────────

function _getDB() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("STELLA_DB_SHEET_ID");
  if (!sheetId) {
    throw new Error("Stella DB not initialized. Run setupStella() first.");
  }
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Returns or creates the AM's campaign tab.
 * Tab name = first part of email before @, sanitized.
 * e.g. donnell.ray@siriusxm.com → "donnell.ray"
 */
function _getOrCreateAMTab(email) {
  var ss = _getDB();
  var tabName = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 30);

  var sheet = ss.getSheetByName(tabName);
  if (sheet) return sheet;

  // First login — create tab with headers
  sheet = ss.insertSheet(tabName);
  var headerRow = DB_COLUMNS.map(function(col) { return col; });
  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);

  // Style header row
  var headerRange = sheet.getRange(1, 1, 1, headerRow.length);
  headerRange.setBackground("#003087");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 250);  // Opportunity Name
  sheet.setColumnWidth(2, 100);  // Slingshot ID
  sheet.setColumnWidth(9, 80);   // Pacing %
  sheet.setColumnWidth(13, 250); // Campaign Notes

  // Log to index tab
  var index = ss.getSheetByName("_index");
  if (index) {
    index.appendRow([email, tabName, new Date()]);
  }

  Logger.log("Created new AM tab: " + tabName + " for " + email);
  return sheet;
}

function _rowToObject(row) {
  var obj = {};
  DB_COLUMNS.forEach(function(col, i) {
    var val = row[i];
    if (val instanceof Date) {
      obj[col] = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      obj[col] = val !== undefined && val !== null ? val : "";
    }
  });
  return obj;
}

// ── Schema Migration ──────────────────────────────────────

/**
 * Ensures the AM's tab has all current DB_COLUMNS.
 * Safe to call on every load — no-ops if schema is current.
 * New columns are appended to the right with matching header style.
 * Existing data is unaffected (positionally correct).
 */
function migrateAMTab(email) {
  var sheet = _getOrCreateAMTab(email);
  var currentCols = sheet.getLastColumn();
  if (currentCols >= DB_COLUMNS.length) return; // already up to date

  var headerRow = sheet.getRange(1, 1, 1, currentCols).getValues()[0];

  for (var i = currentCols; i < DB_COLUMNS.length; i++) {
    var cell = sheet.getRange(1, i + 1);
    cell.setValue(DB_COLUMNS[i]);
    cell.setBackground("#003087");
    cell.setFontColor("#ffffff");
    cell.setFontWeight("bold");
  }

  Logger.log("Migrated " + email + " tab: added " + (DB_COLUMNS.length - currentCols) + " column(s).");
}

// ── Public API ────────────────────────────────────────────

/**
 * Returns all campaigns for the given AM email.
 * Called from Index.html via google.script.run.
 * @returns {Array} Array of campaign objects + _row index
 */
function getCampaigns(email) {
  migrateAMTab(email); // ensure schema is current before reading
  var sheet = _getOrCreateAMTab(email);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, DB_COLUMNS.length).getValues();
  var campaigns = [];

  data.forEach(function(row, i) {
    // Skip fully empty rows
    if (row.every(function(cell) { return cell === "" || cell === null; })) return;
    var obj = _rowToObject(row);
    obj._row = i + 2; // 1-based sheet row
    campaigns.push(obj);
  });

  return campaigns;
}

/**
 * Saves a campaign (add or update).
 * @param {string} email - AM email
 * @param {Object} campaign - Campaign data object
 * @param {number|null} rowNum - Sheet row to update (null = new row)
 * @returns {Object} Saved campaign with _row
 */
function saveCampaign(email, campaign, rowNum) {
  var sheet = _getOrCreateAMTab(email);
  campaign["Last Updated"] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");

  var rowData = DB_COLUMNS.map(function(col) {
    return campaign[col] !== undefined ? campaign[col] : "";
  });

  if (rowNum) {
    sheet.getRange(rowNum, 1, 1, rowData.length).setValues([rowData]);
    campaign._row = rowNum;
  } else {
    sheet.appendRow(rowData);
    campaign._row = sheet.getLastRow();
  }

  return campaign;
}

/**
 * Deletes a campaign by sheet row number.
 * @param {string} email - AM email
 * @param {number} rowNum - Sheet row to delete
 */
function deleteCampaign(email, rowNum) {
  var sheet = _getOrCreateAMTab(email);
  sheet.deleteRow(rowNum);
}

/**
 * Returns a summary object for the dashboard header stats.
 * @param {string} email - AM email
 * @returns {Object} Stats: total, live, endingSoon, atRisk, billing
 */
function getCampaignStats(email) {
  var campaigns = getCampaigns(email);
  var stats = { total: 0, live: 0, endingSoon: 0, atRisk: 0 };

  campaigns.forEach(function(c) {
    var status = (c["Campaign Status"] || "").toUpperCase();
    var pacing = parseFloat(c["Pacing %"]) || 0;

    if (status === "ENDED") return; // skip ended
    stats.total++;
    if (status === "LIVE") stats.live++;
    if (status === "ENDING SOON") stats.endingSoon++;
    if (pacing > 0 && pacing < 80) stats.atRisk++;
  });

  return stats;
}

// ── Team Storage ─────────────────────────────────────────

/**
 * Returns or creates the hidden _teams tab.
 * Columns: Manager Email | AM Emails (JSON) | Last Updated
 */
function _getOrCreateTeamsTab() {
  var ss = _getDB();
  var sheet = ss.getSheetByName("_teams");
  if (sheet) return sheet;

  sheet = ss.insertSheet("_teams");
  sheet.hideSheet();
  var hdr = sheet.getRange(1, 1, 1, 3);
  hdr.setValues([["Manager Email", "AM Emails", "Last Updated"]]);
  hdr.setBackground("#003087");
  hdr.setFontColor("#ffffff");
  hdr.setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * Saves or updates the list of AM emails for a manager.
 * @param {string} managerEmail
 * @param {Array}  amEmails  — array of SXM email strings
 */
function saveManagerTeam(managerEmail, amEmails) {
  var sheet = _getOrCreateTeamsTab();
  var data  = sheet.getDataRange().getValues();
  var updated = false;

  for (var i = 1; i < data.length; i++) {
    if ((data[i][0] || "").toLowerCase() === managerEmail.toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue(JSON.stringify(amEmails || []));
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      updated = true;
      break;
    }
  }

  if (!updated) {
    sheet.appendRow([managerEmail, JSON.stringify(amEmails || []), new Date().toISOString()]);
  }
}

/**
 * Returns the AM email list for a manager.
 * @param {string} managerEmail
 * @returns {Object} { amEmails: [] }
 */
function getManagerTeam(managerEmail) {
  try {
    var sheet = _getOrCreateTeamsTab();
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if ((data[i][0] || "").toLowerCase() === managerEmail.toLowerCase()) {
        var emails = JSON.parse(data[i][1] || "[]");
        return { amEmails: emails };
      }
    }
  } catch (e) {}
  return { amEmails: [] };
}

/**
 * Returns all campaigns across a manager's team.
 * Each campaign gets an _am field with the AM's display name.
 * @param {string} managerEmail
 * @returns {Array}
 */
function getTeamCampaigns(managerEmail) {
  var team = getManagerTeam(managerEmail);
  var amEmails = team.amEmails || [];
  var all = [];

  amEmails.forEach(function(amEmail) {
    amEmail = amEmail.trim();
    if (!amEmail) return;
    try {
      var campaigns = getCampaigns(amEmail);
      var amName = amEmail.split("@")[0].split(".").map(function(p) {
        return p.charAt(0).toUpperCase() + p.slice(1);
      }).join(" ");
      campaigns.forEach(function(c) {
        c._am = amName;
        c._amEmail = amEmail;
        all.push(c);
      });
    } catch (e) {
      Logger.log("getTeamCampaigns: could not read tab for " + amEmail + " — " + e.message);
    }
  });

  // Sort: active statuses first, then by start date
  var order = { "LIVE": 0, "ENDING SOON": 1, "UPCOMING": 2, "ENDED": 3 };
  all.sort(function(a, b) {
    var sa = order[(a["Campaign Status"] || "").toUpperCase()] || 2;
    var sb = order[(b["Campaign Status"] || "").toUpperCase()] || 2;
    if (sa !== sb) return sa - sb;
    return (a["Start Date"] || "").localeCompare(b["Start Date"] || "");
  });

  return all;
}

/**
 * Returns campaigns across all AM tabs where Sales Rep matches the seller's name.
 * Seller name is derived from email prefix: alice.cooper@... → "Alice Cooper"
 * @param {string} sellerDisplayName  e.g. "Alice Cooper"
 * @returns {Array}
 */
function getCampaignsForSeller(sellerDisplayName) {
  var ss = _getDB();
  var index = ss.getSheetByName("_index");
  if (!index) return [];

  var nameNorm = (sellerDisplayName || "").trim().toLowerCase();
  var all = [];

  // Read index tab to get all registered AM emails
  var indexData = index.getDataRange().getValues();
  for (var i = 1; i < indexData.length; i++) {
    var amEmail = indexData[i][0];
    if (!amEmail) continue;
    try {
      var campaigns = getCampaigns(amEmail);
      var amName = amEmail.split("@")[0].split(".").map(function(p) {
        return p.charAt(0).toUpperCase() + p.slice(1);
      }).join(" ");
      campaigns.forEach(function(c) {
        var rep = (c["Sales Rep"] || "").trim().toLowerCase();
        if (rep === nameNorm) {
          c._am = amName;
          c._amEmail = amEmail;
          all.push(c);
        }
      });
    } catch (e) {
      Logger.log("getCampaignsForSeller: error reading " + amEmail + " — " + e.message);
    }
  }

  return all;
}

/**
 * Builds a compact team-wide campaign context string for Stella's system prompt.
 * Groups campaigns by AM name.
 * @param {string} managerEmail
 * @returns {string}
 */
function getTeamCampaignContext(managerEmail) {
  var campaigns = getTeamCampaigns(managerEmail);
  if (!campaigns.length) return "No campaigns on record for this team.";

  var active = campaigns.filter(function(c) {
    return (c["Campaign Status"] || "").toUpperCase() !== "ENDED";
  });

  if (!active.length) return "No active campaigns currently across the team.";

  // Group by AM
  var byAM = {};
  var amOrder = [];
  active.forEach(function(c) {
    var am = c._am || "Unknown AM";
    if (!byAM[am]) { byAM[am] = []; amOrder.push(am); }
    byAM[am].push(c);
  });

  var sections = amOrder.map(function(am) {
    var lines = ["[" + am + "]"];
    byAM[am].forEach(function(c) {
      var pacing = c["Pacing %"] ? c["Pacing %"] + "%" : "N/A";
      lines.push([
        "- " + (c["Opportunity Name"] || "Unnamed"),
        "  SS: " + (c["Slingshot ID"] || "—") + (c["OMS ID"] ? " | OMS: " + c["OMS ID"] : ""),
        "  Dates: " + (c["Start Date"] || "?") + " → " + (c["End Date"] || "?"),
        "  Status: " + (c["Campaign Status"] || "?") + " | Flight: " + (c["Flight Status"] || "?") + " | Pacing: " + pacing,
        c["Campaign Notes"] ? "  Notes: " + c["Campaign Notes"] : null
      ].filter(Boolean).join("\n"));
    });
    return lines.join("\n");
  });

  return sections.join("\n\n");
}

// ── Calendar Storage ──────────────────────────────────────

/**
 * Returns or creates the AM's hidden calendar tab.
 * Tab name = [campaignTabName]_cal  (e.g. "donnell.ray_cal")
 */
function _getOrCreateCalTab(email) {
  var ss = _getDB();
  var baseName = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 26);
  var tabName  = baseName + "_cal";

  var sheet = ss.getSheetByName(tabName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(tabName);
  sheet.hideSheet();
  sheet.getRange("A1").setValue("[]");     // empty events JSON
  sheet.getRange("A2").setValue("");       // last synced timestamp
  return sheet;
}

/**
 * Persists calendar events for the given AM.
 * Called from doPost() after validating the sync secret.
 * @param {string} email      - AM email address
 * @param {Array}  events     - Array of event objects from Microsoft Graph
 */
function saveCalendarEvents(email, events) {
  var sheet = _getOrCreateCalTab(email);
  sheet.getRange("A1").setValue(JSON.stringify(events || []));
  sheet.getRange("A2").setValue(new Date().toISOString());
}

/**
 * Returns calendar events for the given AM.
 * Called from Index.html via google.script.run.
 * @param {string} email - AM email
 * @returns {Object} { events: Array, syncedAt: string }
 */
function getCalendarEvents(email) {
  try {
    var sheet = _getOrCreateCalTab(email);
    var raw  = sheet.getRange("A1").getValue();
    var time = sheet.getRange("A2").getValue();
    return {
      events:   raw  ? JSON.parse(raw)  : [],
      syncedAt: time ? time.toString()  : ""
    };
  } catch (e) {
    return { events: [], syncedAt: "" };
  }
}

// ── Campaign Context ──────────────────────────────────────

/**
 * Returns a compact campaign context string for Stella's system prompt.
 * Keeps it tight — just what Stella needs to give relevant answers.
 * @param {string} email - AM email
 * @returns {string}
 */
function getCampaignContext(email) {
  var campaigns = getCampaigns(email);
  if (!campaigns.length) return "No campaigns on record yet.";

  var active = campaigns.filter(function(c) {
    return (c["Campaign Status"] || "").toUpperCase() !== "ENDED";
  });

  if (!active.length) return "No active campaigns currently.";

  var lines = active.map(function(c) {
    var pacing = c["Pacing %"] ? c["Pacing %"] + "%" : "N/A";
    return [
      "- " + (c["Opportunity Name"] || "Unnamed"),
      "  Rep: " + (c["Sales Rep"] || "—"),
      "  SS: " + (c["Slingshot ID"] || "—") + (c["OMS ID"] ? " | OMS: " + c["OMS ID"] : ""),
      "  Dates: " + (c["Start Date"] || "?") + " → " + (c["End Date"] || "?") + (c["Launch Date"] ? " | Launched: " + c["Launch Date"] : ""),
      "  Status: " + (c["Campaign Status"] || "?") + " | Flight: " + (c["Flight Status"] || "?") + " | Pacing: " + pacing,
      c["Traffic Ticket"]    ? "  Traffic: " + c["Traffic Ticket"] : null,
      c["Reporting Ticket"]  ? "  Reporting: " + c["Reporting Ticket"] : null,
      c["Additional Tickets"] ? "  Other Tickets: " + c["Additional Tickets"].replace(/\n/g, ", ") : null,
      c["Campaign Notes"]    ? "  Notes: " + c["Campaign Notes"] : null
    ].filter(Boolean).join("\n");
  });

  return lines.join("\n\n");
}
