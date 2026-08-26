const FILLOUT_APP = "sy3akaxkpf";
const FILLOUT_URL = `https://workflows.fillout.com/public/${FILLOUT_APP}/workflow/execute`;

const PDV_ALIASES = {
  cachiny: "kachili",
  ahorramovil: "ahorramovi",
  electronicabosques: "electronica bosques",
};

function normalizeClave(raw) {
  if (!raw) return "";
  const t = String(raw).trim().toUpperCase().replace(/[\s\-–—]+/g, "");
  const m = t.match(/([0-9]{2}[A-Z]{2}[A-Z0-9]{6,})/);
  if (m) return m[1].slice(0, 14);
  return t.split(/\s+-\s+/)[0]?.trim() || t;
}

function normKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function ratio(a, b) {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (!longer.length) return 1;
  let matches = 0;
  for (let i = 0; i < shorter.length; i += 1) {
    if (shorter[i] === longer[i]) matches += 1;
  }
  return matches / longer.length;
}

function formatFechaMx(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function horasFromReport(answers) {
  const ini = answers?.horarioInicio;
  const fin = answers?.horarioFin;
  if (!ini || !fin) return "";
  const parse = (t) => {
    const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const a = parse(ini);
  const b = parse(fin);
  if (a == null || b == null || b <= a) return "";
  const mins = b - a;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return String(h);
  if (m === 30) return `${h} hrs 30`;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function extractComerciales(answers) {
  const out = { portabilidad: "", recargas: "", pospago: "", esim: "", sim: "" };
  const rows = Array.isArray(answers?.comerciales) ? answers.comerciales : [];
  for (const row of rows) {
    const s = String(row?.servicio || "").toLowerCase();
    let v = Number.parseInt(String(row?.ventasPorProducto ?? ""), 10);
    if (!Number.isFinite(v) || v <= 0) continue;
    if (s.includes("portabil")) out.portabilidad = v;
    else if (s.includes("recarga")) out.recargas = v;
    else if (s.includes("pospago")) out.pospago = v;
    else if (s.includes("esim")) out.esim = v;
    else if (s.includes("línea nueva") || s.includes("linea nueva")) out.sim = v;
  }
  return out;
}

function findReportForSolicitud(sol, rawList) {
  const cb = normalizeClave(sol.claveYaavser);
  const nk = normKey(sol.puntoDeVenta);
  const alias = PDV_ALIASES[nk];
  let best = null;
  let bestScore = 0;

  for (const entry of rawList) {
    const a = entry?.answers || {};
    let score = 0;
    const rb = normalizeClave(a.claveYaavser);
    if (cb && rb && (cb.startsWith(rb.slice(0, 10)) || rb.startsWith(cb.slice(0, 10)))) score = 100;
    const rp = normKey(a.puntoDeVenta);
    if (alias && rp.includes(alias.replace(/\s+/g, ""))) score = Math.max(score, 90);
    else if (nk && (nk.includes(rp) || rp.includes(nk))) score = Math.max(score, 75);
    else if (nk && ratio(nk, rp) >= 0.72) score = Math.max(score, 60);
    if (a.fecha && sol.fechaBtl && a.fecha === sol.fechaBtl) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 60 ? best : null;
}

async function fetchSolicitudes() {
  const res = await fetch(FILLOUT_URL, {
    method: "POST",
    headers: { "content-type": "application/json;charset=UTF-8" },
    body: JSON.stringify({
      inputs: { limit: 500 },
      mode: "live",
      workflowId: "getSolicitudes",
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Fillout ${res.status}`);
  const data = await res.json();
  const records = Array.isArray(data?.records) ? data.records : [];
  return records
    .filter((s) => s?.fechaBtl && s?.puntoDeVenta)
    .sort((a, b) => String(a.fechaBtl).localeCompare(String(b.fechaBtl)));
}

function buildTableroRows(solicitudes, rawList) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return solicitudes.map((sol, idx) => {
    const report = findReportForSolicitud(sol, rawList);
    const answers = report?.answers || null;
    const metrics = answers ? extractComerciales(answers) : {
      portabilidad: "",
      recargas: "",
      pospago: "",
      esim: "",
      sim: "",
    };
    const horas = horasFromReport(answers) || "5";
    const fechaBtl = sol.fechaBtl ? new Date(`${sol.fechaBtl}T12:00:00`) : null;
    let estatus = "PROGRAMADA";
    if (report) estatus = "REALIZADA";
    else if (fechaBtl && fechaBtl < today) estatus = "REALIZADA";

    const flujo = String(sol.flujoDePersonas || "MEDIO").toUpperCase();
    const clave = normalizeClave(sol.claveYaavser) || String(sol.claveYaavser || "").trim();

    return {
      no: idx + 1,
      fecha: formatFechaMx(sol.fechaBtl),
      estado: String(sol.estado || "").toUpperCase(),
      municipio: sol.municipioAlcaldia || "",
      pdv: sol.puntoDeVenta || "",
      clave,
      nombre: sol.nombreYaavser || "",
      horas,
      flujo: flujo.includes("ALTO") ? "ALTO" : "MEDIO",
      estatus,
      metrics,
      tieneReporte: Boolean(report),
    };
  });
}

function sumMetrics(rows) {
  const keys = ["portabilidad", "recargas", "pospago", "esim", "sim"];
  const tot = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    for (const k of keys) {
      const v = row.metrics[k];
      if (v !== "" && v != null) tot[k] += Number(v) || 0;
    }
  }
  return tot;
}

module.exports = function createTableroActivacion({ ExcelJS }) {
  const NAVY = "FF1F4E79";
  const WHITE = "FFFFFFFF";
  const GREEN = "FFC6EFCE";
  const YELLOW = "FFFFEB9C";
  const ORANGE = "FFFCE4D6";
  const RED = "FFFFC7CE";

  async function buildTableroWorkbook(rawList) {
    const solicitudes = await fetchSolicitudes();
    const rows = buildTableroRows(solicitudes, rawList);
    const totals = sumMetrics(rows);

    const wb = new ExcelJS.Workbook();
    wb.creator = "YAAVS Reporte BTL";
    wb.created = new Date();
    const ws = wb.addWorksheet("ACTIVACION BTL", {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    ws.getCell("A1").value = "ACTIVACION BTL";
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };

    const metricLabels = ["PORTABILIDA", "RECARGAS", "POSPAG", "e-SIM", "SIM - LÍNEA NUEVA"];
    const metricKeys = ["portabilidad", "recargas", "pospago", "esim", "sim"];
    metricKeys.forEach((k, i) => {
      const col = 11 + i;
      const totalCell = ws.getCell(1, col);
      totalCell.value = totals[k] || 0;
      totalCell.alignment = { horizontal: "center", vertical: "middle" };
      totalCell.font = { bold: true, size: 12 };

      const head = ws.getCell(2, col);
      head.value = metricLabels[i];
      head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      head.font = { bold: true, color: { argb: WHITE }, size: 10 };
      head.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    const headers = [
      "NO",
      "FECHA",
      "ESTADO",
      "MUNICIPIO/ALCALDIA",
      "PDV",
      "CLAVE YAAVSER",
      "NOMBRE DEL YAAV",
      "HORAS",
      "FLUJO",
      "ESTATUS",
      ...metricLabels,
    ];
    headers.forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    rows.forEach((row, rIdx) => {
      const r = rIdx + 4;
      const vals = [
        row.no,
        row.fecha,
        row.estado,
        row.municipio,
        row.pdv,
        row.clave,
        row.nombre,
        row.horas,
        row.flujo,
        row.estatus,
        row.metrics.portabilidad,
        row.metrics.recargas,
        row.metrics.pospago,
        row.metrics.esim,
        row.metrics.sim,
      ];
      vals.forEach((v, cIdx) => {
        const cell = ws.getCell(r, cIdx + 1);
        cell.value = v === "" ? null : v;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });

      const estatusCell = ws.getCell(r, 10);
      if (row.estatus === "PROGRAMADA") {
        estatusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
      } else if (!row.tieneReporte) {
        estatusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
      } else {
        estatusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
      }

      if (String(row.horas) === "2") {
        ws.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
      }
    });

    ws.columns = [
      { width: 5 },
      { width: 12 },
      { width: 14 },
      { width: 22 },
      { width: 28 },
      { width: 16 },
      { width: 30 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 8 },
      { width: 16 },
    ];

    return { workbook: wb, rows, totals, solicitudesCount: solicitudes.length };
  }

  return { buildTableroWorkbook, buildTableroRows, fetchSolicitudes, findReportForSolicitud };
};
