"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const context = { self: {}, URL, location: { href: "https://www.eview.eplan.com/project", origin: "https://www.eview.eplan.com" } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/core.js"), "utf8"), context);
const core = context.self.EviewRedliningCore;

const sample = {
  data: {
    redlinings: [
      { id: "r-1", status: "Review", page: { id: "p-10", number: "10" } },
      { id: "r-2", status: "Done", pageId: "p-10" },
      { id: "r-3", status: "Draft", pageIdentifier: "=A1+S1/20" }
    ]
  }
};

const result = core.extractCandidates(sample);
assert.ok(result.records.length >= 3, "Redlining records should be found");
const pages = core.uniquePages(result.records).map((item) => item.pageRef);
assert.ok(pages.includes("p-10"));
assert.ok(pages.includes("=A1+S1/20"));

const translations = {
  Redlining: "Redlining",
  Page: "Page",
  Status: "Status"
};
const germanTranslations = {
  Redlining: "Redlining",
  Page: "Seite",
  Status: "Status"
};
assert.equal(core.extractCandidates(translations).records.length, 0, "English translation labels are not pages");
assert.equal(core.extractCandidates(germanTranslations).records.length, 0, "German translation labels are not pages");

assert.equal(core.normalizeStatus("Überprüfung"), "review");
assert.equal(core.normalizeStatus("Erledigt"), "completed");
assert.equal(core.normalizeStatus("Abgelehnt"), "rejected");

const stToMoe = { enabled: true, source: "ST", target: "MOE", customPatterns: [] };
for (const title of [
  "ST->MoE: Adapter ändern",
  "ST H --> MoE: neue Klemme",
  "ST H => MoES: neue Klemme",
  "ST-Rei->MoE Baugruppe prüfen",
  "ST-MoE: Kurzform"
]) {
  assert.equal(core.matchAssignment(title, stToMoe).matched, true, `Expected ST to MoE match: ${title}`);
}
assert.equal(core.matchAssignment("MoE_FFE->ST: Rückfrage", stToMoe).matched, false);
assert.equal(core.matchAssignment("MoE_FFE-ST Kabel", stToMoe).matched, false);
assert.equal(core.matchAssignment("MoE_FFE-ST Kabel", { ...stToMoe, source: "MOE", target: "ST" }).matched, true);
assert.equal(core.matchAssignment("ST_KWE->MoE: 026 RK250", stToMoe).matched, true);
assert.equal(core.matchAssignment("ST->M0E: Schreibfehler", stToMoe).matched, false, "Typos must remain available for manual selection");
assert.equal(core.matchAssignment("Sonderfall Parkbremse", { ...stToMoe, customPatterns: ["Sonderfall"] }).matched, true);

const screenshotDirections = [
  ["ST_STM-> MOM: Sicherheit", "ST", "MOM"],
  ["ST_STM-->MOM Zwischenprüfung", "ST", "MOM"],
  ["ST_SCH -> MoE: -KF101", "ST", "MOE"],
  ["ST_CSR->MoE: Kabelbelegung", "ST", "MOE"],
  ["TPL-ST-H: Einstellwerte", "TPL", "ST"],
  ["ST_EEI -> MoE: Zusätzliche", "ST", "MOE"],
  ["ST-EEI -> ST SW Rückmeldung", "ST", "ST"],
  ["ST_EEI -> SSB Läpple", "ST", "SSB"],
  ["ST_SCH-> SSB: Versorgung", "ST", "SSB"],
  ["MoE_APE->ST Kabelbezeichnung", "MOE", "ST"],
  ["MoE_FFE->ST überflüssige", "MOE", "ST"],
  ["MoE_FFE-ST Kabelschilder", "MOE", "ST"],
  ["MoE_BRI->ST P", "MOE", "ST"],
  ["ST-H-->MoE War Rückmeldung", "ST", "MOE"],
  ["ST-H--MoE", "ST", "MOE"],
  ["ST-EEI --> MOE PN Leitung", "ST", "MOE"],
  ["ST_MAME->MoE: Druckregler", "ST", "MOE"],
  ["MoE_ZTO->ST Stecker", "MOE", "ST"],
  ["MoM MMR --> ST Welche DN", "MOM", "ST"]
];
for (const [title, source, target] of screenshotDirections) {
  const parsed = core.parseAssignment(title);
  assert.equal(parsed.hasDirection, true, `Expected direction: ${title}`);
  assert.ok(parsed.source.includes(source), `Expected source ${source}: ${title}`);
  assert.ok(parsed.target.includes(target), `Expected target ${target}: ${title}`);
  assert.equal(core.matchAssignment(title, { enabled: true, source, target, customPatterns: [] }).matched, true, `Expected filter match: ${title}`);
}
console.log(`OK: ${result.records.length} records, ${pages.length} unique pages`);
