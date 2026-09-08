"use strict";

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cornerAverage(data, width, height, startX, startY, sampleSize) {
  let r = 0, g = 0, b = 0, count = 0;
  const endX = Math.min(width, startX + sampleSize);
  const endY = Math.min(height, startY + sampleSize);
  for (let y = Math.max(0, startY); y < endY; y += 1) {
    for (let x = Math.max(0, startX); x < endX; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 32) continue;
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
  }
  return count ? [r / count, g / count, b / count] : [255, 255, 255];
}

// eVIEW rendert das eigentliche Schaltplanblatt oft innerhalb einer deutlich
// größeren weißen/hellgrauen Viewer-Fläche. Diese ruhigen Außenränder werden
// erst in der Druckansicht abgeschnitten. Dadurch bleiben die Originalpixel
// erhalten und das Blatt nutzt A4 wesentlich besser aus, ohne ein künstliches
// Hochskalieren der Aufnahme vorzutäuschen.
function trimQuietMargins(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  if (width < 80 || height < 80) return sourceCanvas;

  const probeMax = 1200;
  const scale = Math.min(1, probeMax / Math.max(width, height));
  const probe = document.createElement("canvas");
  probe.width = Math.max(1, Math.round(width * scale));
  probe.height = Math.max(1, Math.round(height * scale));
  const probeContext = probe.getContext("2d", { willReadFrequently: true });
  probeContext.drawImage(sourceCanvas, 0, 0, probe.width, probe.height);
  const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;

  const sampleSize = Math.max(3, Math.round(Math.min(probe.width, probe.height) * 0.012));
  const corners = [
    cornerAverage(pixels, probe.width, probe.height, 0, 0, sampleSize),
    cornerAverage(pixels, probe.width, probe.height, probe.width - sampleSize, 0, sampleSize),
    cornerAverage(pixels, probe.width, probe.height, 0, probe.height - sampleSize, sampleSize),
    cornerAverage(pixels, probe.width, probe.height, probe.width - sampleSize, probe.height - sampleSize, sampleSize)
  ];
  const background = [
    median(corners.map((color) => color[0])),
    median(corners.map((color) => color[1])),
    median(corners.map((color) => color[2]))
  ];

  let minX = probe.width, minY = probe.height, maxX = -1, maxY = -1;
  const thresholdSquared = 26 * 26;
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      const index = (y * probe.width + x) * 4;
      if (pixels[index + 3] < 32) continue;
      const dr = pixels[index] - background[0];
      const dg = pixels[index + 1] - background[1];
      const db = pixels[index + 2] - background[2];
      if (dr * dr + dg * dg + db * db <= thresholdSquared) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return sourceCanvas;
  const detectedWidth = maxX - minX + 1;
  const detectedHeight = maxY - minY + 1;
  if (detectedWidth * detectedHeight < probe.width * probe.height * 0.18) return sourceCanvas;

  const sourceMinX = Math.floor(minX / scale);
  const sourceMinY = Math.floor(minY / scale);
  const sourceMaxX = Math.ceil((maxX + 1) / scale);
  const sourceMaxY = Math.ceil((maxY + 1) / scale);
  const safety = Math.max(10, Math.round(Math.min(width, height) * 0.008));
  const sx = Math.max(0, sourceMinX - safety);
  const sy = Math.max(0, sourceMinY - safety);
  const ex = Math.min(width, sourceMaxX + safety);
  const ey = Math.min(height, sourceMaxY + safety);
  const sw = ex - sx;
  const sh = ey - sy;

  // Ist praktisch kein Rand vorhanden, bleibt das verlustfreie Original bestehen.
  if (sw >= width * 0.985 && sh >= height * 0.985) return sourceCanvas;

  const trimmed = document.createElement("canvas");
  trimmed.width = Math.max(1, sw);
  trimmed.height = Math.max(1, sh);
  trimmed.getContext("2d").drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return trimmed;
}

function cropScreenshot(capture) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const viewport = capture.viewport || { width: image.naturalWidth, height: image.naturalHeight };
      const bounds = capture.bounds || { x: 0, y: 0, width: viewport.width, height: viewport.height };
      const scaleX = image.naturalWidth / viewport.width;
      const scaleY = image.naturalHeight / viewport.height;
      const sx = Math.max(0, Math.round(bounds.x * scaleX));
      const sy = Math.max(0, Math.round(bounds.y * scaleY));
      const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(bounds.width * scaleX)));
      const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(bounds.height * scaleY)));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(trimQuietMargins(canvas).toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = capture.dataUrl;
  });
}

(async () => {
  const printButton = document.getElementById("print");
  const stored = await chrome.storage.local.get("eviewPageCaptures");
  const captures = stored.eviewPageCaptures || [];
  document.getElementById("count").textContent = `${captures.length} Seite(n) – ein gemeinsamer Druckauftrag`;
  const pagesNode = document.getElementById("pages");
  if (!captures.length) {
    pagesNode.innerHTML = '<p class="empty">Keine Seiten erfasst.</p>';
    printButton.textContent = "Keine Seiten vorhanden";
    return;
  }

  for (const capture of captures) {
    const section = document.createElement("section");
    section.className = "sheet";
    const image = document.createElement("img");
    image.alt = capture.pageRef || "eVIEW-Seite";
    image.src = await cropScreenshot(capture);
    section.append(image);
    pagesNode.append(section);
    await image.decode().catch(() => {});
  }
  printButton.disabled = false;
  printButton.textContent = "Einmal drucken – A4 quer";
})();

document.getElementById("print").addEventListener("click", () => window.print());
