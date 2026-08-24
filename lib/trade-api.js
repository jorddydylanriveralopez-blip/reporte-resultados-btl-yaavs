const path = require("path");
const fs = require("fs");

const TRADE_FIELDS = [
  ["claveYaavser", "Clave YAAVSER"],
  ["receivedAt", "Fecha y hora envío"],
  ["nps", "NPS recomendación (0-10)"],
  ["productos", "Productos / servicios"],
  ["atencionEjecutivo", "Atención ejecutivo (1-5)"],
  ["frecuenciaVisita", "Frecuencia de visita"],
  ["actualizacionPop", "Actualización POP"],
  ["satisfaccionPop", "Satisfacción POP (1-5)"],
  ["calidadTrade", "Calidad Trade (1-5)"],
  ["mejorarPop", "Aspectos a mejorar POP"],
  ["mejorarPopOtro", "Otro (POP)"],
  ["satisfaccionGeneral", "Satisfacción general (1-5)"],
  ["conocimientoBeneficios", "Beneficios YAAVSER"],
  ["sigueRedes", "¿Sigue en redes?"],
  ["redesSociales", "Redes sociales"],
  ["comentarios", "Comentarios"],
  ["id", "ID interno"],
];

function createTradeApi({ app, ExcelJS, dataDir, resetKeyEnv }) {
  const dataFile = path.join(dataDir, "trade-responses.json");

  function ensureStore() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");
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

  function normalize(body) {
    const now = new Date().toISOString();
    const answers = body && typeof body.answers === "object" ? body.answers : body || {};
    const clean = { ...answers };
    delete clean.website;
    return {
      id: body?.id || `trd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: body?.receivedAt || body?.timestamp || now,
      timestamp: body?.timestamp || now,
      answers: clean,
    };
  }

  function flatten(entry) {
    const a = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
    const out = {
      id: entry.id || "",
      receivedAt: entry.receivedAt || entry.timestamp || "",
      timestamp: entry.timestamp || entry.receivedAt || "",
    };
    for (const [key] of TRADE_FIELDS) {
      if (key === "receivedAt" || key === "id") continue;
      const v = a[key];
      if (Array.isArray(v)) out[key] = v.join(", ");
      else if (v == null) out[key] = "";
      else out[key] = String(v);
    }
    return out;
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

  function authKey(req) {
    const key = String(req.body?.key || req.query?.key || "").trim();
    const expected = String(resetKeyEnv || process.env.RESET_KEY || "yaavs-reset").trim();
    return key && key === expected;
  }

  app.post("/api/trade/submit", (req, res) => {
    try {
      const body = req.body || {};
      if (body.website || body.answers?.website) {
        return res.status(200).json({ ok: true, honeypot: true });
      }
      const entry = normalize(body);
      const list = readResponses();
      list.unshift(entry);
      writeResponses(list);
      res.status(201).json({ ok: true, id: entry.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "No se pudo guardar la encuesta." });
    }
  });

  app.get("/api/trade/responses", (_req, res) => {
    const raw = readResponses();
    const items = raw.map(flatten);
    res.json({ ok: true, count: items.length, responses: items, items, raw });
  });

  app.get("/api/trade/health", (_req, res) => {
    res.json({ ok: true, count: readResponses().length });
  });

  app.get("/api/trade/export.xlsx", async (_req, res) => {
    try {
      const items = readResponses()
        .map(flatten)
        .sort((a, b) => {
          const ta = new Date(a.receivedAt || 0).getTime();
          const tb = new Date(b.receivedAt || 0).getTime();
          return ta - tb;
        });
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "YAAVS";
      const sheet = workbook.addWorksheet("Encuesta Trade");
      sheet.addRow(["#", ...TRADE_FIELDS.map(([, label]) => label)]);
      items.forEach((row, idx) => {
        sheet.addRow([
          idx + 1,
          ...TRADE_FIELDS.map(([key]) =>
            key === "receivedAt" ? formatDateMx(row.receivedAt || row.timestamp) : row[key] ?? "",
          ),
        ]);
      });
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((col) => {
        col.width = 22;
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `Encuesta_Trade_Marketing_YAAVS_${stamp}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      res.setHeader("Cache-Control", "no-store");
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "No se pudo generar el Excel" });
    }
  });

  app.post("/api/trade/reset", (req, res) => {
    try {
      if (!authKey(req)) return res.status(403).json({ ok: false, error: "No autorizado" });
      writeResponses([]);
      res.json({ ok: true, count: 0 });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "No se pudo reiniciar" });
    }
  });

  app.post("/api/trade/import", (req, res) => {
    try {
      if (!authKey(req)) return res.status(403).json({ ok: false, error: "No autorizado" });
      const incoming = Array.isArray(req.body?.responses)
        ? req.body.responses
        : Array.isArray(req.body?.raw)
          ? req.body.raw
          : Array.isArray(req.body?.items)
            ? req.body.items
            : [];
      const mode = String(req.body?.mode || "merge").trim();
      const normalized = incoming.map((row) => {
        if (row && row.answers && typeof row.answers === "object") return normalize(row);
        const { id, receivedAt, timestamp, website, ...answers } = row || {};
        return normalize({ id, receivedAt, timestamp, answers });
      });
      let list = mode === "replace" ? [] : readResponses();
      const byId = new Map(list.map((r) => [r.id, r]));
      normalized.forEach((entry) => byId.set(entry.id, entry));
      list = [...byId.values()].sort((a, b) => {
        const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
        const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
        return tb - ta;
      });
      writeResponses(list);
      res.json({ ok: true, count: list.length, imported: normalized.length, mode });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "No se pudo importar" });
    }
  });

  function sendTradeHtml(res, fileName) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "..", "public", fileName));
  }

  // Never redirect between /trade and /trade/ — Hostinger CDN cached those 301s into a loop.
  app.get(["/trade", "/trade/"], (_req, res) => {
    sendTradeHtml(res, "trade-form.html");
  });

  app.get(["/trade/resultados", "/trade/resultados/"], (_req, res) => {
    sendTradeHtml(res, "trade-resultados.html");
  });

  // Alias without slash ambiguity (safe if CDN still has bad /trade cache)
  app.get(["/encuesta-trade", "/encuesta-trade/"], (_req, res) => {
    sendTradeHtml(res, "trade-form.html");
  });

  app.get(["/encuesta-trade/resultados", "/encuesta-trade/resultados/"], (_req, res) => {
    sendTradeHtml(res, "trade-resultados.html");
  });

  ensureStore();
}

module.exports = createTradeApi;
