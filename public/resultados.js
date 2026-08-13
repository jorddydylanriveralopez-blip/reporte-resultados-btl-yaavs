(() => {
  const boardEl = document.getElementById("board");
  const emptyEl = document.getElementById("empty");
  const metricsEl = document.getElementById("metrics");
  const liveCount = document.getElementById("liveCount");
  const groupCount = document.getElementById("groupCount");
  const groupTitle = document.getElementById("groupTitle");
  const fPunto = document.getElementById("fPunto");
  const fIncidencia = document.getElementById("fIncidencia");
  const qEl = document.getElementById("q");
  const desdeEl = document.getElementById("desde");
  const hastaEl = document.getElementById("hasta");
  const ordenEl = document.getElementById("orden");
  const modal = document.getElementById("modal");
  const modalHero = document.getElementById("modalHero");
  const modalBody = document.getElementById("modalBody");
  const modalActions = document.getElementById("modalActions");

  let items = [];
  let rawItems = [];
  let view = "grid";
  let lastSync = null;
  let optionsFilled = false;
  let lastBoardKey = "";
  let lastMetricsKey = "";
  let lastChartsKey = "";
  let animateCards = true;
  const charts = {
    incidencia: null,
    punto: null,
    ventas: null,
  };

  const PIE_COLORS = [
    "#00a0c8",
    "#002b44",
    "#34c4e8",
    "#e8c547",
    "#c83048",
    "#28785a",
    "#6b8296",
    "#014866",
  ];

  const LABELS = {
    claveYaavser: "Clave YAAVSER",
    fecha: "Fecha activación",
    puntoDeVenta: "Punto de venta",
    responsable: "Responsable",
    promotores: "Promotor(es)",
    horarioInicio: "Horario inicio",
    horarioFin: "Horario fin",
    ubicacion: "Ubicación",
    promocionPrincipal: "Promoción principal",
    abordados: "Abordados",
    prospectos: "Prospectos",
    ventas: "Ventas",
    dinamicas: "Dinámicas",
    participantes: "Participantes",
    promocionales: "Promocionales",
    tasaInteres: "Tasa de interés %",
    tasaConversion: "Tasa de conversión %",
    promedioVentasHora: "Promedio ventas/hora",
    totalDinamicas: "Total dinámicas",
    comerciales: "Resultados comerciales",
    materiales: "Material promocional",
    hayIncidencia: "¿Hay incidencia?",
    incidencias: "Incidencias",
    observaciones: "Observaciones",
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
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

  function formatTime(iso) {
    const d = parseDate(iso) || new Date();
    return new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  }

  function sum(list, key) {
    return list.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  }

  function incidenciaLevel(v) {
    const s = String(v || "").trim().toLowerCase();
    if (s === "sí" || s === "si") return { label: "Con incidencia", cls: "badge-alto" };
    if (s === "no") return { label: "Sin incidencia", cls: "badge-bajo" };
    return { label: "Sin dato", cls: "badge-medio" };
  }

  function ventasBucket(n) {
    const v = Number(n) || 0;
    if (v <= 0) return "0";
    if (v <= 2) return "1–2";
    if (v <= 5) return "3–5";
    if (v <= 10) return "6–10";
    return "11+";
  }

  function countEvidence(entryId) {
    const full = rawItems.find((x) => x.id === entryId);
    let n = 0;
    const blocks = Array.isArray(full?.answers?.evidencia) ? full.answers.evidencia : [];
    blocks.forEach((b) => {
      n += Array.isArray(b?.files) ? b.files.length : 0;
    });
    const mats = Array.isArray(full?.answers?.materiales) ? full.answers.materiales : [];
    mats.forEach((row) => {
      n += Array.isArray(row?.evidenciasMerma) ? row.evidenciasMerma.length : 0;
    });
    return n;
  }

  function fillPuntoOptions(list) {
    if (optionsFilled) return;
    const set = new Set();
    list.forEach((r) => {
      const v = String(r.puntoDeVenta || "").trim();
      if (v) set.add(v);
    });
    [...set].sort((a, b) => a.localeCompare(b, "es")).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      fPunto.appendChild(opt);
    });
    optionsFilled = true;
  }

  function filtered() {
    const q = qEl.value.trim().toLowerCase();
    const punto = fPunto.value;
    const inc = fIncidencia.value;
    const desde = desdeEl.value ? new Date(`${desdeEl.value}T00:00:00`) : null;
    const hasta = hastaEl.value ? new Date(`${hastaEl.value}T23:59:59`) : null;

    let list = items.filter((r) => {
      if (punto && r.puntoDeVenta !== punto) return false;
      if (inc && r.hayIncidencia !== inc) return false;
      const d = parseDate(r.receivedAt || r.timestamp);
      if (desde && d && d < desde) return false;
      if (hasta && d && d > hasta) return false;
      if (q) {
        const hay = [
          r.claveYaavser,
          r.puntoDeVenta,
          r.responsable,
          r.promotores,
          r.ubicacion,
          r.promocionPrincipal,
          r.observaciones,
          r.comerciales,
          r.materiales,
          r.incidencias,
          r.id,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const orden = ordenEl.value;
    list.sort((a, b) => {
      const da = parseDate(a.receivedAt || a.timestamp)?.getTime() || 0;
      const db = parseDate(b.receivedAt || b.timestamp)?.getTime() || 0;
      if (orden === "fecha-asc") return da - db;
      if (orden === "ventas-desc") return Number(b.ventas || 0) - Number(a.ventas || 0);
      if (orden === "clave-asc") {
        return String(a.claveYaavser || "").localeCompare(String(b.claveYaavser || ""), "es");
      }
      return db - da;
    });

    return list;
  }

  function renderMetrics(list) {
    metricsEl.innerHTML = `
      <div class="metric"><span>Total</span><strong>${list.length}</strong></div>
      <div class="metric"><span>Abordados</span><strong>${sum(list, "abordados")}</strong></div>
      <div class="metric"><span>Prospectos</span><strong>${sum(list, "prospectos")}</strong></div>
      <div class="metric"><span>Ventas</span><strong>${sum(list, "ventas")}</strong></div>
      <div class="metric"><span>Con incidencia</span><strong>${
        list.filter((r) => String(r.hayIncidencia).toLowerCase() === "sí").length
      }</strong></div>
      <div class="metric metric-time"><span>Última sync</span><strong>${
        lastSync ? formatTime(lastSync) : "—"
      }</strong></div>
    `;
  }

  function tally(list, key, order) {
    const map = new Map();
    list.forEach((r) => {
      const v = String(r[key] || "").trim();
      if (!v) return;
      map.set(v, (map.get(v) || 0) + 1);
    });
    const keys = order
      ? order.filter((k) => map.has(k)).concat([...map.keys()].filter((k) => !order.includes(k)))
      : [...map.keys()].sort((a, b) => map.get(b) - map.get(a) || a.localeCompare(b, "es"));
    return {
      labels: keys,
      values: keys.map((k) => map.get(k)),
    };
  }

  function tallyBuckets(list) {
    const order = ["0", "1–2", "3–5", "6–10", "11+"];
    const map = new Map(order.map((k) => [k, 0]));
    list.forEach((r) => {
      const b = ventasBucket(r.ventas);
      map.set(b, (map.get(b) || 0) + 1);
    });
    const keys = order.filter((k) => map.get(k) > 0);
    return { labels: keys, values: keys.map((k) => map.get(k)) };
  }

  function upsertPie(name, canvasId, emptyId, labels, values) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    if (!canvas || typeof Chart === "undefined") return;

    const hasData = values.some((n) => n > 0);
    empty.hidden = hasData;
    canvas.style.display = hasData ? "block" : "none";
    if (!hasData) {
      if (charts[name]) {
        charts[name].destroy();
        charts[name] = null;
      }
      return;
    }

    const colors = labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);
    if (charts[name]) {
      charts[name].data.labels = labels;
      charts[name].data.datasets[0].data = values;
      charts[name].data.datasets[0].backgroundColor = colors;
      charts[name].update("none");
      return;
    }

    charts[name] = new Chart(canvas, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "#fff",
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 12,
              color: "#3d5568",
              font: { family: "Outfit", size: 11, weight: "600" },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const n = ctx.raw || 0;
                const pct = Math.round((n / total) * 100);
                return ` ${ctx.label}: ${n} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function renderCharts(list) {
    const inc = tally(list, "hayIncidencia", ["Sí", "No"]);
    const punto = tally(list, "puntoDeVenta");
    if (punto.labels.length > 8) {
      const topLabels = punto.labels.slice(0, 7);
      const topValues = punto.values.slice(0, 7);
      const rest = punto.values.slice(7).reduce((a, n) => a + n, 0);
      punto.labels = [...topLabels, "Otros"];
      punto.values = [...topValues, rest];
    }
    const ventas = tallyBuckets(list);

    const chartsKey = JSON.stringify({ inc, punto, ventas });
    if (chartsKey === lastChartsKey) return;
    lastChartsKey = chartsKey;

    upsertPie("incidencia", "chartIncidencia", "emptyIncidencia", inc.labels, inc.values);
    upsertPie("punto", "chartPunto", "emptyPunto", punto.labels, punto.values);
    upsertPie("ventas", "chartVentas", "emptyVentas", ventas.labels, ventas.values);
  }

  function cardHtml(r, i) {
    const lvl = incidenciaLevel(r.hayIncidencia);
    const ev = countEvidence(r.id);
    const animClass = animateCards ? "item item-enter" : "item";
    const delay = animateCards ? Math.min(i * 0.04, 0.35) : 0;
    return `
      <li class="${animClass}" style="animation-delay:${delay}s" data-id="${escapeHtml(r.id)}">
        <button type="button" class="item-hit" data-open="${escapeHtml(r.id)}">
          <div class="item-media">
            <div class="item-media-glow" aria-hidden="true"></div>
            <div class="badge-stack">
              <span class="badge ${lvl.cls}">${lvl.label}</span>
            </div>
            <span class="item-stars">${escapeHtml(r.ventas || "0")} ventas</span>
          </div>
          <div class="item-body">
            <h2>${escapeHtml(r.claveYaavser || "Sin clave")}</h2>
            <p class="item-line">${escapeHtml(r.puntoDeVenta || "—")} · ${escapeHtml(
              r.responsable || "—",
            )}</p>
            <p class="item-meta">Abordados ${escapeHtml(r.abordados || "0")} · Prospectos ${escapeHtml(
              r.prospectos || "0",
            )}${ev ? ` · ${ev} evidencia${ev === 1 ? "" : "s"}` : ""}</p>
            <p class="item-date">${formatDate(r.receivedAt || r.timestamp)}</p>
          </div>
        </button>
        <div class="item-actions">
          <button type="button" class="btn btn-soft" data-open="${escapeHtml(r.id)}">Ver</button>
          <button type="button" class="btn btn-soft" data-csv="${escapeHtml(r.id)}">CSV</button>
        </div>
      </li>
    `;
  }

  function boardKey(list) {
    return `${view}|${list.map((r) => r.id).join(",")}|${qEl.value}|${fPunto.value}|${
      fIncidencia.value
    }|${desdeEl.value}|${hastaEl.value}|${ordenEl.value}`;
  }

  function metricsKey(list) {
    return [
      list.length,
      sum(list, "abordados"),
      sum(list, "prospectos"),
      sum(list, "ventas"),
      list.filter((r) => String(r.hayIncidencia).toLowerCase() === "sí").length,
      formatTime(lastSync),
    ].join("|");
  }

  function renderBoard(forceCards = false) {
    const list = filtered();
    liveCount.textContent = String(items.length);
    groupCount.textContent = `${list.length}`;
    groupTitle.textContent = list.length === 1 ? "Reporte" : "Reportes";

    const mKey = metricsKey(list);
    if (mKey !== lastMetricsKey) {
      lastMetricsKey = mKey;
      renderMetrics(list);
    } else if (lastSync) {
      const syncEl = metricsEl.querySelector(".metric-time strong");
      if (syncEl) syncEl.textContent = formatTime(lastSync);
    }

    renderCharts(list);

    const bKey = boardKey(list);
    if (!forceCards && bKey === lastBoardKey) return;
    lastBoardKey = bKey;

    boardEl.className = `board board-${view === "list" ? "list" : "grid"}`;

    if (!list.length) {
      boardEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.querySelector("h2").textContent = items.length
        ? "Sin coincidencias"
        : "Sin reportes aún";
      emptyEl.querySelector("p").textContent = items.length
        ? "Prueba limpiar filtros o cambiar la búsqueda."
        : "Cuando alguien envíe un reporte, aparecerá aquí en tiempo real.";
      animateCards = false;
      return;
    }

    emptyEl.hidden = true;
    boardEl.innerHTML = list.map((r, i) => cardHtml(r, i)).join("");
    animateCards = false;
  }

  function findById(id) {
    return items.find((r) => r.id === id);
  }

  function fileTileHtml(f) {
    const url = escapeAttr(f.url || "");
    const name = escapeHtml(f.name || "archivo");
    const mime = String(f.mime || "");
    if (mime.startsWith("video/")) {
      return `<a class="evidence-item video" href="${url}" target="_blank" rel="noopener">
        <video src="${url}" muted playsinline></video>
        <span>${name}</span>
      </a>`;
    }
    if (mime.startsWith("image/")) {
      return `<a class="evidence-item" href="${url}" target="_blank" rel="noopener">
        <img src="${url}" alt="${name}" loading="lazy" />
        <span>${name}</span>
      </a>`;
    }
    const ext = String(f.name || "")
      .split(".")
      .pop()
      ?.toUpperCase() || "FILE";
    return `<a class="evidence-item file" href="${url}" target="_blank" rel="noopener" download>
      <div class="evidence-file-tile">${escapeHtml(ext)}</div>
      <span>${name}</span>
    </a>`;
  }

  function evidenceHtml(entryId) {
    const full = rawItems.find((x) => x.id === entryId);
    const blocks = Array.isArray(full?.answers?.evidencia) ? full.answers.evidencia : [];
    const materiales = Array.isArray(full?.answers?.materiales) ? full.answers.materiales : [];
    const mermaBlocks = materiales
      .filter((row) => Array.isArray(row?.evidenciasMerma) && row.evidenciasMerma.length)
      .map((row) => ({
        punto: `Merma/daño · ${row.material || "Material"}`,
        files: row.evidenciasMerma,
      }));
    const allBlocks = [...blocks, ...mermaBlocks];

    if (!allBlocks.length) {
      return `<p class="empty-evidence">Sin evidencias en este reporte.</p>`;
    }

    return `
      <div class="modal-evidence">
        <h3>Evidencias</h3>
        ${allBlocks
          .map((block) => {
            const files = Array.isArray(block.files) ? block.files : [];
            return `
            <div class="evidence-block">
              <h4>${escapeHtml(block.punto || "Evidencia")}</h4>
              <div class="evidence-gallery">${files.map(fileTileHtml).join("")}</div>
            </div>`;
          })
          .join("")}
      </div>`;
  }

  function openModal(id) {
    const r = findById(id);
    if (!r) return;
    const lvl = incidenciaLevel(r.hayIncidencia);
    modalHero.innerHTML = `
      <span class="badge ${lvl.cls}">${lvl.label}</span>
      <h2>${escapeHtml(r.claveYaavser || "Sin clave")}</h2>
      <p>${formatDate(r.receivedAt || r.timestamp)} · ${escapeHtml(r.puntoDeVenta || "")}</p>
    `;
    modalBody.innerHTML =
      Object.keys(LABELS)
        .map((key) => {
          const val = r[key];
          if (val == null || String(val).trim() === "") return "";
          return `<div class="modal-row"><b>${LABELS[key]}</b><span>${escapeHtml(val)}</span></div>`;
        })
        .join("") + evidenceHtml(r.id);
    modalActions.innerHTML = `
      <button type="button" class="btn btn-soft" data-csv="${escapeHtml(r.id)}">CSV de este reporte</button>
      <a class="btn btn-soft" href="./api/export.xlsx" data-excel>Excel completo</a>
    `;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function downloadCsvOne(id) {
    const r = findById(id);
    if (!r) return;
    const headers = ["#", ...Object.values(LABELS), "Fecha", "ID"];
    const values = [
      "1",
      ...Object.keys(LABELS).map((k) => String(r[k] ?? "")),
      formatDate(r.receivedAt || r.timestamp),
      r.id || "",
    ];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + [headers.map(esc).join(","), values.map(esc).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_${r.claveYaavser || r.id || "btl"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    qEl.value = "";
    fPunto.value = "";
    fIncidencia.value = "";
    desdeEl.value = "";
    hastaEl.value = "";
    ordenEl.value = "fecha-desc";
    lastBoardKey = "";
    renderBoard(true);
  }

  async function load() {
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      const next = Array.isArray(data.responses) ? data.responses : [];
      const nextRaw = Array.isArray(data.raw) ? data.raw : [];
      const prevSig = items.map((r) => r.id).join(",");
      const nextSig = next.map((r) => r.id).join(",");
      items = next;
      rawItems = nextRaw;
      lastSync = new Date().toISOString();
      fillPuntoOptions(items);
      if (prevSig !== nextSig) {
        animateCards = prevSig === "" ? true : false;
        lastBoardKey = "";
        lastChartsKey = "";
        lastMetricsKey = "";
      }
      renderBoard();
    } catch (_) {
      liveCount.textContent = "!";
    }
  }

  boardEl.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open]");
    const csvBtn = e.target.closest("[data-csv]");
    if (csvBtn) {
      e.preventDefault();
      downloadCsvOne(csvBtn.getAttribute("data-csv"));
      return;
    }
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.getAttribute("data-open"));
    }
  });

  modalActions.addEventListener("click", (e) => {
    const csvBtn = e.target.closest("[data-csv]");
    if (csvBtn) downloadCsvOne(csvBtn.getAttribute("data-csv"));
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

  document.getElementById("btnRefresh").addEventListener("click", load);
  document.getElementById("btnClear").addEventListener("click", clearFilters);

  document.getElementById("btnExcel").addEventListener("click", async () => {
    const btn = document.getElementById("btnExcel");
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando…";
    try {
      const url = `./api/export.xlsx?ts=${Date.now()}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `Reporte_Resultados_BTL_YAAVS_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (_) {
      window.location.href = `./api/export.xlsx?ts=${Date.now()}`;
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  [qEl, fPunto, fIncidencia, desdeEl, hastaEl, ordenEl].forEach((el) => {
    el.addEventListener("input", () => {
      lastBoardKey = "";
      lastChartsKey = "";
      lastMetricsKey = "";
      renderBoard(true);
    });
    el.addEventListener("change", () => {
      lastBoardKey = "";
      lastChartsKey = "";
      lastMetricsKey = "";
      renderBoard(true);
    });
  });

  document.getElementById("viewGrid").addEventListener("click", () => {
    view = "grid";
    document.getElementById("viewGrid").classList.add("on");
    document.getElementById("viewList").classList.remove("on");
    lastBoardKey = "";
    renderBoard(true);
  });

  document.getElementById("viewList").addEventListener("click", () => {
    view = "list";
    document.getElementById("viewList").classList.add("on");
    document.getElementById("viewGrid").classList.remove("on");
    lastBoardKey = "";
    renderBoard(true);
  });

  function boot() {
    if (typeof Chart === "undefined") {
      setTimeout(boot, 40);
      return;
    }
    load();
    setInterval(load, 4000);
  }

  boot();
})();
