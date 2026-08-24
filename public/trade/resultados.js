(() => {
  const cfg = window.YAAVS_TRADE_CONFIG || {};
  const boardEl = document.getElementById("board");
  const emptyEl = document.getElementById("empty");
  const metricsEl = document.getElementById("metrics");
  const liveCount = document.getElementById("liveCount");
  const groupCount = document.getElementById("groupCount");
  const groupTitle = document.getElementById("groupTitle");
  const qEl = document.getElementById("q");
  const desdeEl = document.getElementById("desde");
  const hastaEl = document.getElementById("hasta");
  const modal = document.getElementById("modal");
  const modalHero = document.getElementById("modalHero");
  const modalBody = document.getElementById("modalBody");
  const modalActions = document.getElementById("modalActions");

  let items = [];
  let lastSync = null;
  const charts = { nps: null, sat: null, prod: null };

  const LABELS = {
    claveYaavser: "Clave YAAVSER",
    nps: "NPS (0–10)",
    productos: "Productos / servicios",
    atencionEjecutivo: "Atención ejecutivo",
    frecuenciaVisita: "Frecuencia de visita",
    actualizacionPop: "Actualización POP",
    satisfaccionPop: "Satisfacción POP",
    calidadTrade: "Calidad Trade Marketing",
    mejorarPop: "Mejorar POP",
    mejorarPopOtro: "Otro (POP)",
    satisfaccionGeneral: "Satisfacción general",
    conocimientoBeneficios: "Beneficios YAAVSER",
    comentarios: "Comentarios",
  };

  const PIE_COLORS = ["#00a0c8", "#002b44", "#34c4e8", "#e8c547", "#c83048", "#28785a", "#6b8296", "#014866"];

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseDate(iso) {
    const d = new Date(iso || "");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(iso) {
    const d = parseDate(iso);
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }

  function formatTime(d) {
    return new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  }

  function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function avg(list, key) {
    if (!list.length) return 0;
    const sum = list.reduce((a, r) => a + toNum(r[key]), 0);
    return Math.round((sum / list.length) * 10) / 10;
  }

  function npsScore(list) {
    if (!list.length) return "—";
    let promoters = 0;
    let detractors = 0;
    list.forEach((r) => {
      const n = toNum(r.nps);
      if (n >= 9) promoters += 1;
      else if (n <= 6) detractors += 1;
    });
    return Math.round(((promoters - detractors) / list.length) * 100);
  }

  function filtered() {
    const q = String(qEl.value || "").trim().toLowerCase();
    const desde = desdeEl.value ? new Date(`${desdeEl.value}T00:00:00`) : null;
    const hasta = hastaEl.value ? new Date(`${hastaEl.value}T23:59:59`) : null;
    return items
      .filter((r) => {
        const d = parseDate(r.receivedAt || r.timestamp);
        if (desde && (!d || d < desde)) return false;
        if (hasta && (!d || d > hasta)) return false;
        if (!q) return true;
        const blob = [
          r.claveYaavser,
          r.comentarios,
          r.productos,
          r.frecuenciaVisita,
          r.mejorarPop,
          r.mejorarPopOtro,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        const da = parseDate(a.receivedAt || a.timestamp)?.getTime() || 0;
        const db = parseDate(b.receivedAt || b.timestamp)?.getTime() || 0;
        return db - da;
      });
  }

  function renderMetrics(list) {
    metricsEl.innerHTML = `
      <div class="metric"><span>Total</span><strong>${list.length}</strong></div>
      <div class="metric"><span>NPS</span><strong>${npsScore(list)}</strong></div>
      <div class="metric"><span>Prom. recomendación</span><strong>${avg(list, "nps")}</strong></div>
      <div class="metric"><span>Prom. atención</span><strong>${avg(list, "atencionEjecutivo")}</strong></div>
      <div class="metric"><span>Prom. POP</span><strong>${avg(list, "satisfaccionPop")}</strong></div>
      <div class="metric"><span>Prom. Trade</span><strong>${avg(list, "calidadTrade")}</strong></div>
      <div class="metric"><span>Prom. general</span><strong>${avg(list, "satisfaccionGeneral")}</strong></div>
      <div class="metric metric-time"><span>Última sync</span><strong>${
        lastSync ? formatTime(lastSync) : "—"
      }</strong></div>
    `;
  }

  function tallyValues(list, key) {
    const map = new Map();
    list.forEach((r) => {
      let vals = r[key];
      if (typeof vals === "string") {
        vals = vals
          .split(/\s*\|\|\s*|\s*,\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (!Array.isArray(vals)) vals = [vals];
      vals.forEach((v) => {
        const s = String(v || "").trim();
        if (!s) return;
        map.set(s, (map.get(s) || 0) + 1);
      });
    });
    const labels = [...map.keys()].sort((a, b) => map.get(b) - map.get(a) || a.localeCompare(b, "es"));
    return { labels, values: labels.map((k) => map.get(k)) };
  }

  function upsertPie(name, canvasId, emptyId, labels, values) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    if (!canvas || typeof Chart === "undefined") return;
    const hasData = labels.length > 0;
    empty.hidden = hasData;
    canvas.hidden = !hasData;
    if (!hasData) {
      if (charts[name]) {
        charts[name].destroy();
        charts[name] = null;
      }
      return;
    }
    const data = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
          borderWidth: 0,
        },
      ],
    };
    if (charts[name]) {
      charts[name].data = data;
      charts[name].update();
      return;
    }
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    charts[name] = new Chart(canvas, {
      type: "doughnut",
      data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: narrow ? 10 : 12,
              font: { size: narrow ? 10 : 11 },
              padding: narrow ? 8 : 12,
            },
          },
        },
        cutout: "58%",
      },
    });
  }

  function renderCharts(list) {
    const npsMap = new Map();
    for (let i = 0; i <= 10; i++) npsMap.set(String(i), 0);
    list.forEach((r) => {
      const k = String(r.nps ?? "");
      if (npsMap.has(k)) npsMap.set(k, npsMap.get(k) + 1);
    });
    const npsLabels = [...npsMap.keys()].filter((k) => npsMap.get(k) > 0);
    const npsValues = npsLabels.map((k) => npsMap.get(k));
    const sat = tallyValues(list, "satisfaccionGeneral");
    const prod = tallyValues(list, "productos");
    upsertPie("nps", "chartNps", "emptyNps", npsLabels, npsValues);
    upsertPie("sat", "chartSat", "emptySat", sat.labels, sat.values);
    upsertPie("prod", "chartProd", "emptyProd", prod.labels.slice(0, 8), prod.values.slice(0, 8));
  }

  function cardHtml(r) {
    return `
      <li class="item" data-id="${escapeHtml(r.id)}">
        <button type="button" class="item-hit" data-open="${escapeHtml(r.id)}">
          <div class="item-media">
            <div class="item-media-glow" aria-hidden="true"></div>
            <span class="item-nps">NPS ${escapeHtml(r.nps ?? "—")}</span>
          </div>
          <div class="item-body">
            <h2>${escapeHtml(r.claveYaavser || "Sin clave")}</h2>
            <p class="item-line">Atención ${escapeHtml(r.atencionEjecutivo || "—")} · POP ${escapeHtml(
              r.satisfaccionPop || "—",
            )} · General ${escapeHtml(r.satisfaccionGeneral || "—")}</p>
            <p class="item-meta">${escapeHtml(r.frecuenciaVisita || "—")}</p>
            <p class="item-date">${formatDate(r.receivedAt || r.timestamp)}</p>
          </div>
        </button>
        <div class="item-actions">
          <button type="button" class="btn btn-soft" data-open="${escapeHtml(r.id)}">Ver</button>
        </div>
      </li>`;
  }

  function openModal(id) {
    const r = items.find((x) => x.id === id);
    if (!r) return;
    modalHero.innerHTML = `
      <h2>${escapeHtml(r.claveYaavser || "Sin clave")}</h2>
      <p>${formatDate(r.receivedAt || r.timestamp)} · NPS ${escapeHtml(r.nps ?? "—")}</p>
    `;
    modalBody.innerHTML = Object.keys(LABELS)
      .map((key) => {
        let val = r[key];
        if (Array.isArray(val)) val = val.join(", ");
        if (val == null || String(val).trim() === "") return "";
        return `<div class="modal-row"><b>${LABELS[key]}</b><span>${escapeHtml(val)}</span></div>`;
      })
      .join("");
    modalActions.innerHTML = `<a class="btn btn-soft" href="${cfg.exportUrl || "./api/trade/export.xlsx"}">Excel completo</a>`;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function renderBoard() {
    const list = filtered();
    liveCount.textContent = String(items.length);
    groupCount.textContent = String(list.length);
    groupTitle.textContent = list.length === 1 ? "Respuesta" : "Respuestas";
    renderMetrics(list);
    renderCharts(list);
    if (!list.length) {
      boardEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    boardEl.innerHTML = list.map(cardHtml).join("");
  }

  async function load() {
    try {
      const res = await fetch(cfg.responsesUrl || "/api/trade/responses", { cache: "no-store" });
      const data = await res.json();
      items = data.items || data.responses || [];
      lastSync = new Date();
      renderBoard();
    } catch (_) {
      /* keep previous */
    }
  }

  boardEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (!btn) return;
    e.preventDefault();
    openModal(btn.getAttribute("data-open"));
  });

  document.getElementById("modalClose").addEventListener("click", () => {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  });

  ["input", "change"].forEach((ev) => {
    qEl.addEventListener(ev, renderBoard);
    desdeEl.addEventListener(ev, renderBoard);
    hastaEl.addEventListener(ev, renderBoard);
  });
  document.getElementById("btnClear").addEventListener("click", () => {
    qEl.value = "";
    desdeEl.value = "";
    hastaEl.value = "";
    renderBoard();
  });
  document.getElementById("btnRefresh").addEventListener("click", load);
  document.getElementById("btnExcel").addEventListener("click", async () => {
    const btn = document.getElementById("btnExcel");
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando…";
    try {
      const url = `${cfg.exportUrl || "/api/trade/export.xlsx"}?ts=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `Encuesta_Trade_Marketing_YAAVS_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (_) {
      window.alert("No se pudo generar el Excel.");
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  load();
  window.setInterval(load, 15000);
})();
