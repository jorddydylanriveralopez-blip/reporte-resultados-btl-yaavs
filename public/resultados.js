(() => {
  const statsEl = document.getElementById("stats");
  const detailEl = document.getElementById("detail");
  const liveStatus = document.getElementById("liveStatus");
  let items = [];
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
    incidencias: "Incidencias",
    evidencia: "Evidencia",
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

  async function load() {
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      items = Array.isArray(data.responses) ? data.responses : [];
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
