"use strict";

const statusNode = document.getElementById("status");
const detectedPagesNode = document.getElementById("detectedPages");
const capturesNode = document.getElementById("captures");
const printButton = document.getElementById("print");
const assignmentEnabledNode = document.getElementById("assignmentEnabled");
const assignmentFieldsNode = document.getElementById("assignmentFields");
const sourceNode = document.getElementById("sourceDepartment");
const targetNode = document.getElementById("targetDepartment");
const customPatternsNode = document.getElementById("customPatterns");
const timingModeNode = document.getElementById("timingMode");
const pendingSectionNode = document.getElementById("pendingSection");
const pendingListNode = document.getElementById("pendingList");
const pendingCountNode = document.getElementById("pendingCount");
let activeTab = null;
let lastScan = null;
let controlsInitialized = false;
let saveTimer = null;
document.getElementById("version").textContent = `Version ${chrome.runtime.getManifest().version}`;

const STATUS_LABELS = {
  draft: "Entwurf",
  review: "Überprüfung",
  confirmed: "Bestätigt",
  completed: "Erledigt",
  rejected: "Abgelehnt"
};

function setStatus(text, error) {
  statusNode.textContent = text;
  statusNode.classList.toggle("error", Boolean(error));
}

async function activeEviewTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = "";
  try { hostname = new URL(tab && tab.url || "").hostname; } catch (_) {}
  if (!tab || !tab.id || !["eview.eplan.com", "www.eview.eplan.com"].includes(hostname)) {
    throw new Error("Öffne zuerst ein Projekt auf eview.eplan.com.");
  }
  return tab;
}

function selectedStatuses() {
  return Array.from(document.querySelectorAll('input[name="status"]:checked')).map((node) => node.value);
}

function splitPatterns(value) {
  return String(value || "").split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
}

function currentFilters() {
  const statuses = selectedStatuses();
  if (!statuses.length) throw new Error("Wähle mindestens einen Redlining-Status aus.");
  return {
    statuses,
    assignment: {
      enabled: assignmentEnabledNode.checked,
      source: sourceNode.value,
      target: targetNode.value,
      customPatterns: splitPatterns(customPatternsNode.value)
    },
    timingMode: timingModeNode.value || "normal"
  };
}

function applyFilters(filters) {
  const selected = new Set(filters && filters.statuses || ["review"]);
  for (const node of document.querySelectorAll('input[name="status"]')) node.checked = selected.has(node.value);
  const assignment = filters && filters.assignment || {};
  assignmentEnabledNode.checked = Boolean(assignment.enabled);
  sourceNode.value = assignment.source || "ST";
  targetNode.value = assignment.target || "MOE";
  customPatternsNode.value = (assignment.customPatterns || []).join(", ");
  timingModeNode.value = ["fast", "normal", "slow"].includes(filters && filters.timingMode) ? filters.timingMode : "normal";
  updateAssignmentControls();
}

function updateAssignmentControls() {
  const disabled = !assignmentEnabledNode.checked;
  assignmentFieldsNode.classList.toggle("disabled", disabled);
  sourceNode.disabled = disabled;
  targetNode.disabled = disabled;
}

function scheduleFilterSave() {
  updateAssignmentControls();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await chrome.runtime.sendMessage({ type: "SAVE_FILTERS", filters: currentFilters() }); } catch (_) {}
  }, 180);
}

function renderCandidates(candidates) {
  pendingListNode.textContent = "";
  let entryCount = 0;
  for (const candidate of candidates || []) {
    const entries = candidate.entries && candidate.entries.length
      ? candidate.entries
      : [{ title: candidate.pageRef || candidate.pageKey || "Unklares Redlining", status: null, reason: "Nicht automatisch zugeordnet" }];
    for (const entry of entries) {
      entryCount += 1;
      const label = document.createElement("label");
      label.className = "pending-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = candidate.id;
      const text = document.createElement("span");
      const title = document.createElement("b");
      title.textContent = entry.title;
      title.title = entry.title;
      const detail = document.createElement("small");
      detail.textContent = `${STATUS_LABELS[entry.status] || entry.status || "Status unbekannt"} · ${entry.reason || "nicht zugeordnet"}`;
      text.append(title, detail);
      label.append(input, text);
      pendingListNode.append(label);
    }
  }
  pendingCountNode.textContent = String(entryCount);
  pendingSectionNode.hidden = entryCount === 0;
}

async function refreshState() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const captures = state.captures || [];
  lastScan = state.scan || null;
  if (!controlsInitialized) {
    applyFilters(state.filters);
    controlsInitialized = true;
  }
  capturesNode.textContent = String(captures.length);
  detectedPagesNode.textContent = String(lastScan && lastScan.pages ? lastScan.pages.length : 0);
  printButton.disabled = captures.length === 0;
  renderCandidates(state.candidates || []);
  return state;
}

async function scan() {
  activeTab = await activeEviewTab();
  let response;
  try { response = await chrome.tabs.sendMessage(activeTab.id, { type: "SCAN" }); }
  catch (_) { throw new Error("Die Verbindung zu eVIEW fehlt. Lade den eVIEW-Tab nach dem Erweiterungsupdate einmal neu."); }
  if (!response || !response.ok) throw new Error("eVIEW antwortet nicht. Seite nach Installation neu laden.");
  lastScan = response.scan;
  await chrome.runtime.sendMessage({ type: "SAVE_SCAN", scan: lastScan });
  await refreshState();
  setStatus(lastScan.pages.length
    ? `${lastScan.pages.length} eindeutige Seite(n) aus den geladenen Redlining-Daten erkannt.`
    : "Noch keine Seitendaten erkannt. Öffne die Redlining-Übersicht, warte kurz und starte die Suche erneut.");
}

async function autoCaptureAll() {
  activeTab = await activeEviewTab();
  const filters = currentFilters();
  await chrome.runtime.sendMessage({ type: "SAVE_FILTERS", filters });
  setStatus("eVIEW wartet auf den bestätigten Vollbild-Start …");
  const response = await chrome.tabs.sendMessage(activeTab.id, { type: "REQUEST_TRUSTED_START", filters });
  if (!response || !response.ok) throw new Error(response && response.error || "Der Startdialog konnte in eVIEW nicht geöffnet werden.");
  window.close();
}


for (const node of document.querySelectorAll('input[name="status"], #assignmentEnabled, #sourceDepartment, #targetDepartment, #customPatterns, #timingMode')) {
  node.addEventListener("change", scheduleFilterSave);
}
customPatternsNode.addEventListener("input", scheduleFilterSave);

document.getElementById("scan").addEventListener("click", () => autoCaptureAll().catch((error) => setStatus(error.message, true)));

document.getElementById("addPending").addEventListener("click", async () => {
  const candidateIds = Array.from(pendingListNode.querySelectorAll('input[type="checkbox"]:checked')).map((node) => node.value);
  if (!candidateIds.length) {
    setStatus("Markiere zuerst mindestens ein unklares Redlining.", true);
    return;
  }
  const response = await chrome.runtime.sendMessage({ type: "PROMOTE_CANDIDATES", candidateIds: Array.from(new Set(candidateIds)) });
  if (!response.ok) {
    setStatus(response.error || "Die Auswahl konnte nicht hinzugefügt werden.", true);
    return;
  }
  await refreshState();
  setStatus(`${response.added} zusätzliche eindeutige Seite(n) zum Druckauftrag hinzugefügt.`);
});

document.getElementById("capture").addEventListener("click", async () => {
  try {
    activeTab = await activeEviewTab();
    const response = await chrome.runtime.sendMessage({ type: "CAPTURE_CURRENT" });
    if (!response.ok) throw new Error(response.error);
    await refreshState();
    setStatus(response.alreadyCaptured
      ? `Diese Seite war bereits erfasst. Insgesamt ${response.count} eindeutige Seite(n).`
      : `Aktuelle Seite erfasst. Insgesamt ${response.count} eindeutige Seite(n).`);
  } catch (error) { setStatus(error.message, true); }
});

printButton.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "OPEN_PRINT_VIEW" });
  if (!response.ok) setStatus(response.error, true);
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_CAPTURES" });
  await refreshState();
  setStatus("Erfasste und vorgemerkte Seiten wurden geleert.");
});

document.getElementById("export").addEventListener("click", async () => {
  try {
    if (!lastScan) await scan();
    const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    const diagnostic = {
      extensionVersion: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      filters: state.filters,
      scan: lastScan,
      automation: state.automation || null,
      pendingRedlinings: state.candidates || [],
      capturedPages: (state.captures || []).map(({ pageKey, pageRef, bounds, viewport, capturedAt }) => ({ pageKey, pageRef, bounds, viewport, capturedAt }))
    };
    const json = JSON.stringify(diagnostic, null, 2);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    await chrome.downloads.download({
      url: `data:application/json;base64,${btoa(binary)}`,
      filename: "eview-redlining-diagnose.json",
      saveAs: true
    });
    setStatus("Diagnose-Datei gespeichert. Sie enthält keine Zugangsdaten oder Antwortinhalte.");
  } catch (error) { setStatus(error.message, true); }
});

(async () => {
  try {
    activeTab = await activeEviewTab();
    const state = await refreshState();
    if (state.automation && state.automation.running) {
      setStatus(`${state.automation.message || "Suchlauf läuft …"} – ${state.automation.uniquePages || 0} Seite(n)`);
    } else if (state.automation && state.automation.failed) {
      setStatus(`Letzter Lauf: ${state.automation.uniquePages || 0} Seite(n) erfasst, ${state.automation.failed} Eintrag/Einträge konnten nicht geladen werden. Bei Bedarf „Langsam / instabil“ wählen.`, true);
    } else if (state.automation && state.automation.uniquePages) {
      setStatus(`Letzter Lauf abgeschlossen: ${state.automation.uniquePages} Seite(n) erfasst.`);
    } else {
      setStatus("Bereit. Standardmäßig wird nur „Überprüfung“ durchsucht.");
    }
  } catch (error) {
    await refreshState();
    setStatus(error.message, true);
  }
})();
