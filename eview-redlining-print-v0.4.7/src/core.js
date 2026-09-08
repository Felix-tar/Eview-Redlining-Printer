(function attachCore(root) {
  "use strict";

  const REDLINING_WORDS = ["redlining", "redline"];
  const PAGE_KEYS = [
    "pageid", "pageuuid", "pageguid", "pageidentifier", "pagenumber",
    "pagename", "pagepath", "page", "sheetid", "sheetnumber", "sheetname"
  ];
  const GENERIC_PAGE_WORDS = new Set(["page", "pages", "seite", "seiten", "sheet", "sheets", "blatt", "blätter"]);
  const STATUS_ALIASES = {
    draft: ["entwurf", "draft"],
    review: ["überprüfung", "ueberprüfung", "ueberpruefung", "review", "in review"],
    confirmed: ["bestätigt", "bestaetigt", "confirmed"],
    completed: ["erledigt", "completed", "done"],
    rejected: ["abgelehnt", "rejected"]
  };
  const DEPARTMENT_LABELS = {
    ST: "ST",
    MOE: "MoE",
    MOM: "MoM",
    MK: "MK",
    TPL: "TPL",
    SSB: "SSB",
    IB: "IB"
  };

  function normalizeKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function safeScalar(value) {
    if (typeof value === "string") return value.slice(0, 240);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeStatus(value) {
    const normalized = normalizeText(value).toLowerCase();
    for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
      if (aliases.some((alias) => normalizeText(alias).toLowerCase() === normalized)) return status;
    }
    return null;
  }

  function departmentsIn(value) {
    const normalized = normalizeText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const compactTokens = normalized.split(" ").filter(Boolean);
    const found = new Set();
    for (let index = 0; index < compactTokens.length; index += 1) {
      const token = compactTokens[index];
      const pair = `${token}${compactTokens[index + 1] || ""}`;
      if (/^MOE[A-Z0-9]{0,3}$/.test(token) || pair === "MOE") found.add("MOE");
      if (/^MOM[A-Z0-9]{0,3}$/.test(token) || pair === "MOM") found.add("MOM");
      if (token === "MK" || pair === "MK") found.add("MK");
      if (token === "ST") found.add("ST");
      if (token === "TPL") found.add("TPL");
      if (token === "SSB") found.add("SSB");
      if (token === "IB") found.add("IB");
    }
    return Array.from(found);
  }

  function parseAssignment(value) {
    const text = normalizeText(value).toUpperCase();
    const arrow = /(?:-{1,3}|={1,3})\s*>|[→⇒➜⟶]/.exec(text);
    if (arrow) {
      const sourceText = text.slice(0, arrow.index);
      const targetText = text.slice(arrow.index + arrow[0].length);
      return {
        hasDirection: true,
        source: departmentsIn(sourceText),
        target: departmentsIn(targetText),
        separator: arrow[0]
      };
    }

    // Häufige Kurzform ohne Pfeil, zum Beispiel "ST-MoE".
    const separators = Array.from(text.matchAll(/[-=:]+/g)).reverse();
    for (const separator of separators) {
      const source = departmentsIn(text.slice(0, separator.index));
      const target = departmentsIn(text.slice(separator.index + separator[0].length));
      if (source.length && target.length) {
        return { hasDirection: true, source, target, separator: separator[0] };
      }
    }
    return { hasDirection: false, source: [], target: [], separator: null };
  }

  function normalizePattern(value) {
    return normalizeText(value).toUpperCase().replace(/\s+/g, " ");
  }

  function matchAssignment(title, filter) {
    const settings = Object.assign({ enabled: false, source: "ST", target: "MOE", customPatterns: [] }, filter || {});
    if (!settings.enabled) return { matched: true, reason: "Auftragsfilter deaktiviert", parsed: parseAssignment(title) };

    const normalizedTitle = normalizePattern(title);
    const customMatch = (settings.customPatterns || [])
      .map(normalizePattern)
      .filter(Boolean)
      .find((pattern) => normalizedTitle.includes(pattern));
    if (customMatch) return { matched: true, reason: `Zusatzmuster: ${customMatch}`, parsed: parseAssignment(title) };

    const parsed = parseAssignment(title);
    const sourceMatches = settings.source === "ANY" || parsed.source.includes(settings.source);
    const targetMatches = settings.target === "ANY" || parsed.target.includes(settings.target);
    if (parsed.hasDirection && sourceMatches && targetMatches) {
      return { matched: true, reason: "Auftragsrichtung erkannt", parsed };
    }

    const readable = parsed.source.length || parsed.target.length
      ? `${parsed.source.map((item) => DEPARTMENT_LABELS[item] || item).join("/") || "?"} → ${parsed.target.map((item) => DEPARTMENT_LABELS[item] || item).join("/") || "?"}`
      : "keine eindeutige Richtung";
    return { matched: false, reason: `Nicht automatisch passend (${readable})`, parsed };
  }

  function containsRedlining(value) {
    const text = String(value || "").toLowerCase();
    return REDLINING_WORDS.some((word) => text.includes(word));
  }

  function objectHasRedliningSignal(object, parentKey) {
    if (containsRedlining(parentKey)) return true;
    for (const [key, value] of Object.entries(object)) {
      if (containsRedlining(key)) return true;
      const normalized = normalizeKey(key);
      if (["type", "kind", "category", "objecttype", "annotationtype"].includes(normalized)
          && safeScalar(value) !== null && containsRedlining(value)) {
        return true;
      }
    }
    return false;
  }

  function findField(object, candidates) {
    for (const [key, value] of Object.entries(object)) {
      const normalized = normalizeKey(key);
      if (candidates.includes(normalized)) {
        const scalar = safeScalar(value);
        if (scalar) return scalar;
        if (value && typeof value === "object") {
          for (const nestedValue of Object.values(value)) {
            const nestedScalar = safeScalar(nestedValue);
            if (nestedScalar) return nestedScalar;
          }
        }
      }
    }
    return null;
  }

  function nearbyPage(object) {
    const direct = findField(object, PAGE_KEYS);
    if (direct) return direct;

    for (const [key, value] of Object.entries(object)) {
      if (!value || typeof value !== "object") continue;
      if (!normalizeKey(key).includes("page") && !normalizeKey(key).includes("sheet")) continue;
      const nested = findField(value, PAGE_KEYS.concat(["id", "uuid", "guid", "number", "name", "path", "identifier"]));
      if (nested) return nested;
    }
    return null;
  }

  function extractCandidates(payload, options) {
    const settings = Object.assign({ maxDepth: 14, maxNodes: 50000 }, options || {});
    const records = [];
    const unresolved = [];
    let visited = 0;

    function walk(value, path, parentKey, inheritedPage, depth) {
      if (!value || typeof value !== "object" || depth > settings.maxDepth || visited >= settings.maxNodes) return;
      visited += 1;

      if (!Array.isArray(value)) {
        const pageRef = nearbyPage(value) || inheritedPage || null;
        if (objectHasRedliningSignal(value, parentKey)) {
          const redliningId = findField(value, ["redliningid", "redlineid", "annotationid", "markupid", "id", "uuid", "guid"]);
          const status = findField(value, ["status", "state", "workflowstatus"]);
          const record = {
            redliningId,
            pageRef,
            status,
            sourcePath: path.slice(0, 300)
          };
          const normalizedPage = String(pageRef || "").trim().toLowerCase();
          const hasSpecificIdentity = Boolean(redliningId) || containsRedlining(parentKey);
          if (pageRef && !GENERIC_PAGE_WORDS.has(normalizedPage) && hasSpecificIdentity) records.push(record);
          else unresolved.push(record);
        }

        for (const [key, child] of Object.entries(value)) {
          walk(child, `${path}.${key}`, key, pageRef, depth + 1);
        }
        return;
      }

      value.forEach((child, index) => walk(child, `${path}[${index}]`, parentKey, inheritedPage, depth + 1));
    }

    walk(payload, "$", "", null, 0);
    return { records: deduplicateRecords(records), unresolved, visited };
  }

  function deduplicateRecords(records) {
    const result = [];
    const seen = new Set();
    for (const record of records || []) {
      const key = `${record.redliningId || ""}|${record.pageRef || ""}|${record.sourcePath || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(record);
    }
    return result;
  }

  function uniquePages(records) {
    const pages = new Map();
    for (const record of records || []) {
      if (!record.pageRef) continue;
      if (!pages.has(record.pageRef)) pages.set(record.pageRef, []);
      pages.get(record.pageRef).push(record);
    }
    return Array.from(pages, ([pageRef, redlinings]) => ({ pageRef, redlinings }));
  }

  function endpointPath(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href);
      return url.origin === location.origin ? url.pathname : "cross-origin";
    } catch (_) {
      return "unknown";
    }
  }

  root.EviewRedliningCore = {
    extractCandidates,
    uniquePages,
    deduplicateRecords,
    endpointPath,
    normalizeStatus,
    parseAssignment,
    matchAssignment,
    STATUS_ALIASES
  };
})(typeof self !== "undefined" ? self : this);
