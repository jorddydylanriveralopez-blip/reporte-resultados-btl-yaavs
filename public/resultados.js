(() => {
  const statsEl = document.getElementById("stats");
  const detailEl = document.getElementById("detail");
  const liveStatus = document.getElementById("liveStatus");
  let items = [];
  let rawItems = [];
  let index = 0;

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

  function sum(key) {
    return items.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  }

  function renderStats() {
    statsEl.innerHTML = `
      <div class="stat"><span>Reportes</span><strong>${items.length}</strong></div>
      <div class="stat"><span>Última clave</span><strong style="font-size:1.05rem">${escapeHtml(
        items[0]?.claveYaavser || "—",
      )}</strong></div>
      <div class="stat"><span>Abordados (suma)</span><strong>${sum("abordados")}</strong></div>
      <div class="stat"><span>Ventas (suma)</span><strong>${sum("ventas")}</strong></div>
    `;
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
      return `<p class="empty-evidence">Sin evidencias fotográficas en este reporte.</p>`;
    }

    return `
      <div class="evidence-blocks">
        ${allBlocks
          .map((block) => {
            const files = Array.isArray(block.files) ? block.files : [];
            return `
            <div class="evidence-block">
              <h3>${escapeHtml(block.punto || "Evidencia")}</h3>
              <div class="evidence-gallery">
                ${files.map(fileTileHtml).join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>`;
  }

  function renderDetail() {
    if (!items.length) {
      detailEl.innerHTML = `<section class="card"><p class="empty">Aún no hay reportes.</p></section>`;
      return;
    }
    const r = items[index];
    const rows = Object.keys(LABELS)
      .map((key) => {
        const val = r[key];
        if (val == null || String(val).trim() === "") return "";
        return `<div class="row"><b>${LABELS[key]}</b><span>${escapeHtml(val)}</span></div>`;
      })
      .join("");

    detailEl.innerHTML = `
      <section class="card">
        <h2>Reporte ${index + 1} de ${items.length}</h2>
        <div class="nav">
          <button type="button" id="prevBtn">Anterior</button>
          <button type="button" id="nextBtn">Siguiente</button>
        </div>
        <p class="meta">${escapeHtml(r.receivedAt || r.timestamp || "")} · ${escapeHtml(
          r.id || "",
        )}</p>
        <div class="rows">${rows}</div>
        <div class="evidence-section">
          <h3 class="evidence-title">Evidencia fotográfica</h3>
          ${evidenceHtml(r.id)}
        </div>
      </section>
    `;

    document.getElementById("prevBtn").onclick = () => {
      index = (index - 1 + items.length) % items.length;
      renderDetail();
    };
    document.getElementById("nextBtn").onclick = () => {
      index = (index + 1) % items.length;
      renderDetail();
    };
  }

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

  async function load() {
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      items = Array.isArray(data.responses) ? data.responses : [];
      rawItems = Array.isArray(data.raw) ? data.raw : [];
      if (index >= items.length) index = 0;
      liveStatus.textContent = `En vivo · ${items.length} reporte${items.length === 1 ? "" : "s"}`;
      renderStats();
      renderDetail();
    } catch (_) {
      liveStatus.textContent = "Sin conexión";
    }
  }

  load();
  setInterval(load, 4000);
})();
