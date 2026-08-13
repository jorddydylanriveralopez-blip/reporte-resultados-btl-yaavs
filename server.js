const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");

(() => {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, "utf8")
      .split(/\n/)
      .forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
      });
  } catch (_) {}
})();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "responses.json");
const uploadsRoot = path.join(dataDir, "uploads");
const SHEETS_WEBHOOK_URL = String(process.env.SHEETS_WEBHOOK_URL || "").trim();
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 160;

function safeFilename(name) {
  const base = path.basename(String(name || "archivo"));
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "archivo";
}

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const tmp = path.join(uploadsRoot, "_tmp");
      fs.mkdirSync(tmp, { recursive: true });
      cb(null, tmp);
    },
    filename(_req, file, cb) {
      cb(
        null,
        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeFilename(file.originalname)}`,
      );
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES },
});

const FIELD_ORDER = [
  ["claveYaavser", "Clave YAAVSER"],
  ["receivedAt", "Fecha y hora envío"],
  ["fecha", "Fecha activación"],
  ["puntoDeVenta", "Punto de venta"],
  ["responsable", "Responsable"],
  ["promotores", "Promotor(es)"],
  ["horarioInicio", "Horario inicio"],
  ["horarioFin", "Horario fin"],
  ["ubicacion", "Ubicación"],
  ["promocionPrincipal", "Promoción principal"],
  ["abordados", "Abordados"],
  ["prospectos", "Prospectos"],
  ["ventas", "Ventas"],
  ["dinamicas", "Dinámicas"],
  ["participantes", "Participantes"],
  ["promocionales", "Promocionales"],
  ["tasaInteres", "Tasa de interés %"],
  ["tasaConversion", "Tasa de conversión %"],
  ["promedioVentasHora", "Promedio ventas/hora"],
  ["totalDinamicas", "Total dinámicas"],
  ["comerciales", "Resultados comerciales"],
  ["materiales", "Material promocional"],
  ["incidencias", "Incidencias"],
  ["hayIncidencia", "¿Hay incidencia?"],
  ["evidencia", "Evidencia"],
  ["observaciones", "Observaciones"],
  ["id", "ID interno"],
];

const COLUMN_WIDTHS = {
  claveYaavser: 18,
  receivedAt: 20,
  fecha: 14,
  puntoDeVenta: 24,
  responsable: 20,
  promotores: 22,
  horarioInicio: 12,
  horarioFin: 12,
  ubicacion: 24,
  promocionPrincipal: 24,
  abordados: 12,
  prospectos: 12,
  ventas: 10,
  dinamicas: 12,
  participantes: 14,
  promocionales: 14,
  tasaInteres: 14,
  tasaConversion: 16,
  promedioVentasHora: 16,
  totalDinamicas: 14,
  comerciales: 48,
  materiales: 48,
  incidencias: 48,
  hayIncidencia: 14,
  evidencia: 28,
  observaciones: 36,
  id: 28,
};

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");
}

function parseSubmitBody(req) {
  const body = { ...(req.body || {}) };
  if (typeof body.answers === "string") {
    try {
      body.answers = JSON.parse(body.answers);
    } catch (_) {
      body.answers = {};
    }
  }
  return body;
}

function moveUploadedFile(entryId, file, prefix, idx) {
  const dest = path.join(uploadsRoot, entryId);
  fs.mkdirSync(dest, { recursive: true });
  const fname = `${Date.now()}_${prefix}_${idx}_${safeFilename(file.originalname)}`;
  const target = path.join(dest, fname);
  if (file.path && fs.existsSync(file.path)) {
    fs.renameSync(file.path, target);
  } else if (file.buffer) {
    fs.writeFileSync(target, file.buffer);
  } else {
    return null;
  }
  return {
    name: file.originalname || fname,
    storedAs: fname,
    url: `/uploads/${entryId}/${fname}`,
    mime: file.mimetype || "application/octet-stream",
    size: file.size || 0,
  };
}

function saveEvidenceFiles(entryId, labels, files) {
  const byIndex = new Map();

  for (const file of files || []) {
    const m = /^ev_(\d+)$/.exec(file.fieldname || "");
    if (!m) continue;
    const idx = Number(m[1]);
    const punto =
      Array.isArray(labels) && labels[idx] != null
        ? String(labels[idx])
        : `Punto ${idx + 1}`;
    const item = moveUploadedFile(entryId, file, "ev", idx);
    if (!item) continue;
    if (!byIndex.has(idx)) byIndex.set(idx, { punto, files: [] });
    byIndex.get(idx).files.push(item);
  }

  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);
}

function attachMaterialEvidence(entryId, materiales, files) {
  const list = Array.isArray(materiales) ? materiales.map((row) => ({ ...row })) : [];
  const byIndex = new Map();

  for (const file of files || []) {
    const m = /^mat_ev_(\d+)$/.exec(file.fieldname || "");
    if (!m) continue;
    const idx = Number(m[1]);
    const item = moveUploadedFile(entryId, file, "mat", idx);
    if (!item) continue;
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx).push(item);
  }

  return list.map((row, idx) => {
    const evidencias = byIndex.get(idx) || [];
    const next = { ...row };
    if (evidencias.length) next.evidenciasMerma = evidencias;
    else delete next.evidenciasMerma;
    if (next.mermaDanio !== "Sí") {
      delete next.evidenciasMerma;
    }
    return next;
  });
}

function readResponses() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeResponses(list) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), "utf8");
}

function stringifyComplex(v) {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v
      .map((row) => {
        if (row && typeof row === "object") {
          return Object.entries(row)
            .map(([k, val]) => {
              if (k === "evidenciasMerma" && Array.isArray(val)) {
                const names = val
                  .map((f) => (f && typeof f === "object" ? f.name || f.url || "" : String(f)))
                  .filter(Boolean)
                  .join(", ");
                return names ? `evidenciasMerma: ${names}` : "";
              }
              if (val != null && typeof val === "object") return `${k}: ${JSON.stringify(val)}`;
              return `${k}: ${val}`;
            })
            .filter(Boolean)
            .join(" | ");
        }
        return String(row);
      })
      .join(" || ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function flatten(entry) {
  const a = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
  const out = {
    id: entry.id || "",
    receivedAt: entry.receivedAt || entry.timestamp || "",
    timestamp: entry.timestamp || entry.receivedAt || "",
  };
  for (const [key] of FIELD_ORDER) {
    if (key === "receivedAt" || key === "id") continue;
    const v = a[key];
    if (key === "comerciales" || key === "materiales" || key === "incidencias") {
      out[key] = stringifyComplex(v);
    } else if (key === "evidencia" && Array.isArray(v)) {
      out[key] = v
        .map((row) => {
          if (row && typeof row === "object") {
            const names = Array.isArray(row.files)
              ? row.files.map((f) => f.name || f.url || "").filter(Boolean).join(", ")
              : "";
            return names ? `${row.punto}: ${names}` : String(row.punto || "");
          }
          return String(row);
        })
        .filter(Boolean)
        .join(" || ");
    } else if (Array.isArray(v)) out[key] = v.join(", ");
    else if (v == null) out[key] = "";
    else out[key] = String(v);
  }
  return out;
}

function normalize(body) {
  const now = new Date().toISOString();
  const answers = body && typeof body.answers === "object" ? body.answers : body || {};
  const clean = { ...answers };
  delete clean.website;
  return {
    id: body?.id || `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: body?.receivedAt || body?.timestamp || now,
    timestamp: body?.timestamp || now,
    answers: clean,
  };
}

async function forwardToSheets(entry) {
  if (!SHEETS_WEBHOOK_URL) return { skipped: true };
  try {
    const flat = flatten(entry);
    const res = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...flat, answers: entry.answers }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("Sheets webhook error:", err.message);
    return { ok: false, error: err.message };
  }
}

function formatDateMx(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function sortedItems() {
  return readResponses()
    .map(flatten)
    .sort((a, b) => {
      const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
      const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
      return ta - tb;
    });
}

async function buildWorkbook(items) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "YAAVS";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Reportes BTL", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });

  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);

  sheet.columns = [
    { key: "_n", width: 6 },
    ...FIELD_ORDER.map(([key]) => ({
      key,
      width: COLUMN_WIDTHS[key] || 22,
    })),
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F2440" },
    };
    cell.font = {
      name: "Calibri",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  items.forEach((row, idx) => {
    const values = [
      idx + 1,
      ...keys.map((k) => {
        if (k === "receivedAt") return formatDateMx(row.receivedAt || row.timestamp);
        return row[k] == null || row[k] === "" ? "—" : String(row[k]);
      }),
    ];
    const excelRow = sheet.addRow(values);
    excelRow.height = 22;
    const alt = idx % 2 === 1;
    excelRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F2440" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber <= 2 ? "center" : "left",
        wrapText: true,
      };
      if (alt) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4F8FC" },
        };
      }
    });
  });

  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [
    { key: "metric", width: 40 },
    { key: "value", width: 28 },
  ];
  const title = summary.addRow(["Reporte de Resultados – Activación BTL YAAVS", ""]);
  title.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF0F2440" } };
  summary.mergeCells(1, 1, 1, 2);
  summary.addRow([]);
  summary.addRow(["Total de reportes", items.length]).font = { bold: true };
  summary.addRow(["Generado", formatDateMx(new Date().toISOString())]);

  const sum = (key) =>
    items.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  summary.addRow([]);
  summary.addRow(["Suma abordados", sum("abordados")]);
  summary.addRow(["Suma prospectos", sum("prospectos")]);
  summary.addRow(["Suma ventas", sum("ventas")]);
  summary.addRow(["Suma dinámicas", sum("dinamicas")]);

  return workbook;
}

app.post("/api/submit", (req, res) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      const msg =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? `Cada archivo debe pesar máximo ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`
            : "No se pudieron subir los archivos."
          : err.message || "No se pudieron subir los archivos.";
      return res.status(400).json({ ok: false, error: msg });
    }

    try {
      const body = parseSubmitBody(req);
      if (body.website || body.answers?.website) {
        return res.status(200).json({ ok: true, honeypot: true });
      }

      const entry = normalize(body);
      const labels = entry.answers?.evidenciaLabels;
      entry.answers.evidencia = saveEvidenceFiles(entry.id, labels, req.files);
      entry.answers.materiales = attachMaterialEvidence(
        entry.id,
        entry.answers.materiales,
        req.files,
      );
      delete entry.answers.evidenciaLabels;

      const list = readResponses();
      list.unshift(entry);
      writeResponses(list);
      const sheets = await forwardToSheets(entry);
      res.status(201).json({ ok: true, id: entry.id, sheets });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "No se pudo guardar el reporte." });
    }
  });
});

app.get("/api/responses", (_req, res) => {
  const items = readResponses().map(flatten);
  res.json({
    ok: true,
    count: items.length,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
    responses: items,
    items,
    raw: readResponses(),
  });
});

app.get("/api/export.xlsx", async (_req, res) => {
  try {
    const items = sortedItems();
    const workbook = await buildWorkbook(items);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `Reporte_Resultados_BTL_YAAVS_${stamp}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "No se pudo generar el Excel" });
  }
});

app.get("/api/export.csv", (_req, res) => {
  const items = sortedItems();
  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  items.forEach((row, idx) => {
    lines.push(
      [
        idx + 1,
        ...keys.map((k) =>
          k === "receivedAt"
            ? formatDateMx(row.receivedAt || row.timestamp)
            : row[k] ?? "",
        ),
      ]
        .map(escape)
        .join(","),
    );
  });
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Reporte_Resultados_BTL_YAAVS_${stamp}.csv"`,
  );
  res.send("\uFEFF" + lines.join("\n"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    count: readResponses().length,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
  });
});

app.post("/api/reset", (req, res) => {
  try {
    const key = String(req.body?.key || req.query?.key || "").trim();
    const expected = String(process.env.RESET_KEY || "yaavs-reset").trim();
    if (!key || key !== expected) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }
    writeResponses([]);
    res.json({ ok: true, count: 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "No se pudo reiniciar" });
  }
});

app.get("/resultados", (_req, res) => {
  res.sendFile(path.join(publicDir, "resultados.html"));
});

app.use(
  "/uploads",
  express.static(uploadsRoot, {
    fallthrough: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }),
);

app.use(
  express.static(publicDir, {
    extensions: ["html"],
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
      else if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  }),
);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

ensureStore();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Reporte BTL YAAVS on http://localhost:${PORT}`);
  console.log(`Resultados: http://localhost:${PORT}/resultados`);
});
