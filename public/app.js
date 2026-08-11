(() => {
  const cfg = window.YAAVS_REPORT_CONFIG || {};
  const opts = window.YAAVS_REPORT_OPTIONS || {};
  const form = document.getElementById("reportForm");
  const successPanel = document.getElementById("successPanel");
  const toast = document.getElementById("toast");
  const hint = document.getElementById("formHint");
  const submitBtn = document.getElementById("submitBtn");

  const comerciales = opts.comerciales || [];
  const materiales = opts.materiales || [];
  const incidencias = opts.incidencias || [];
  const evidencia = opts.evidencia || [];

  const MAX_FILES_PER_POINT = 10;
  const MAX_FILE_MB = 100;

  /** @type {Record<number, File[]>} */
  const selectedFiles = {};

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function fillComercial() {
    const tbody = document.querySelector("#comercialTable tbody");
    tbody.innerHTML = comerciales
      .map(
        (name) => `
      <tr data-servicio="${escapeAttr(name)}">
        <td class="row-label">${escapeHtml(name)}</td>
        <td><input type="number" min="0" data-k="interesados" aria-label="Interesados ${escapeAttr(name)}" /></td>
        <td><input type="number" min="0" data-k="operaciones" aria-label="Operaciones ${escapeAttr(name)}" /></td>
        <td><input type="text" data-k="motivo" placeholder="Motivo" aria-label="Motivo ${escapeAttr(name)}" /></td>
      </tr>`,
      )
      .join("");
  }

  function fillMaterial() {
    const tbody = document.querySelector("#materialTable tbody");
    tbody.innerHTML = materiales
      .map(
        (name) => `
      <tr data-material="${escapeAttr(name)}">
        <td class="row-label">${escapeHtml(name)}</td>
        <td><input type="number" min="0" class="mat-ini" data-k="inicial" /></td>
        <td><input type="number" min="0" class="mat-ent" data-k="entregado" /></td>
        <td><input type="number" min="0" class="mat-fin" data-k="final" /></td>
      </tr>`,
      )
      .join("");

    tbody.addEventListener("input", updateMaterialTotals);
  }

  function updateMaterialTotals() {
    const sum = (sel) =>
      [...document.querySelectorAll(sel)].reduce(
        (acc, el) => acc + (Number(el.value) || 0),
        0,
      );
    document.getElementById("matIniTotal").textContent = String(sum(".mat-ini"));
    document.getElementById("matEntTotal").textContent = String(sum(".mat-ent"));
    document.getElementById("matFinTotal").textContent = String(sum(".mat-fin"));
  }

  function fillIncidencias() {
    const tbody = document.querySelector("#incidenciaTable tbody");
    tbody.innerHTML = incidencias
      .map(
        (name, i) => `
      <tr data-incidencia="${escapeAttr(name)}">
        <td class="row-label">${escapeHtml(name)}</td>
        <td>
          <div class="yesno">
            <label><input type="radio" name="inc_${i}" value="Sí" /> Sí</label>
            <label><input type="radio" name="inc_${i}" value="No" /> No</label>
          </div>
        </td>
        <td><input type="text" data-k="descripcion" placeholder="Descripción breve" /></td>
      </tr>`,
      )
      .join("");
  }

  function fileExt(name) {
    const m = String(name || "").match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toUpperCase() : "FILE";
  }

  function fillEvidencia() {
    const box = document.getElementById("evidenciaUploads");
    box.innerHTML = evidencia
      .map((name, i) => {
        selectedFiles[i] = [];
        return `
      <div class="evidence-card" data-idx="${i}">
        <div class="evidence-card-head">
          <strong>${escapeHtml(name)}</strong>
          <span class="evidence-count" id="ev_count_${i}">0 archivos</span>
        </div>
        <label class="evidence-pick" for="ev_file_${i}">
          <input
            type="file"
            id="ev_file_${i}"
            accept="*/*"
            multiple
            hidden
          />
          <span class="evidence-pick-btn">Subir evidencia</span>
          <span class="evidence-pick-hint">Cualquier archivo · máx. ${MAX_FILES_PER_POINT} · ${MAX_FILE_MB} MB c/u</span>
        </label>
        <div class="evidence-previews" id="ev_prev_${i}"></div>
      </div>`;
      })
      .join("");

    evidencia.forEach((_, i) => {
      const input = document.getElementById(`ev_file_${i}`);
      input.addEventListener("change", () => onFilesChosen(i, input));
    });
  }

  function onFilesChosen(idx, input) {
    const incoming = [...(input.files || [])];
    input.value = "";
    const current = selectedFiles[idx] || [];
    const next = [...current];

    for (const file of incoming) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        showToast(`"${file.name}" supera ${MAX_FILE_MB} MB.`);
        continue;
      }
      if (next.length >= MAX_FILES_PER_POINT) {
        showToast(`Máximo ${MAX_FILES_PER_POINT} archivos por punto.`);
        break;
      }
      next.push(file);
    }

    selectedFiles[idx] = next;
    renderPreviews(idx);
  }

  function renderPreviews(idx) {
    const files = selectedFiles[idx] || [];
    const countEl = document.getElementById(`ev_count_${idx}`);
    const prev = document.getElementById(`ev_prev_${idx}`);
    if (countEl) {
      countEl.textContent =
        files.length === 1 ? "1 archivo" : `${files.length} archivos`;
    }
    if (!prev) return;

    prev.innerHTML = files
      .map((file, fi) => {
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        let media = `<div class="evidence-file-icon" aria-hidden="true">${escapeHtml(fileExt(file.name))}</div>`;
        if (isVideo) media = `<video src="${url}" muted playsinline></video>`;
        else if (isImage) media = `<img src="${url}" alt="${escapeAttr(file.name)}" />`;
        return `
        <div class="evidence-thumb" data-fi="${fi}">
          ${media}
          <button type="button" class="evidence-remove" aria-label="Quitar ${escapeAttr(file.name)}">×</button>
          <span class="evidence-name">${escapeHtml(file.name)}</span>
        </div>`;
      })
      .join("");

    prev.querySelectorAll(".evidence-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const thumb = btn.closest(".evidence-thumb");
        const fi = Number(thumb?.dataset.fi);
        if (Number.isNaN(fi)) return;
        selectedFiles[idx] = (selectedFiles[idx] || []).filter((_, j) => j !== fi);
        renderPreviews(idx);
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function collectComerciales() {
    return [...document.querySelectorAll("#comercialTable tbody tr")].map((tr) => ({
      servicio: tr.dataset.servicio,
      interesados: tr.querySelector('[data-k="interesados"]').value,
      operaciones: tr.querySelector('[data-k="operaciones"]').value,
      motivo: tr.querySelector('[data-k="motivo"]').value,
    }));
  }

  function collectMateriales() {
    return [...document.querySelectorAll("#materialTable tbody tr")].map((tr) => ({
      material: tr.dataset.material,
      inicial: tr.querySelector('[data-k="inicial"]').value,
      entregado: tr.querySelector('[data-k="entregado"]').value,
      final: tr.querySelector('[data-k="final"]').value,
    }));
  }

  function collectIncidencias() {
    return [...document.querySelectorAll("#incidenciaTable tbody tr")].map((tr, i) => {
      const checked = tr.querySelector(`input[name="inc_${i}"]:checked`);
      return {
        incidencia: tr.dataset.incidencia,
        siNo: checked ? checked.value : "",
        descripcion: tr.querySelector('[data-k="descripcion"]').value,
      };
    });
  }

  function collectAnswers() {
    const fd = new FormData(form);
    return {
      fecha: String(fd.get("fecha") || "").trim(),
      puntoDeVenta: String(fd.get("puntoDeVenta") || "").trim(),
      claveYaavser: String(fd.get("claveYaavser") || "").trim(),
      responsable: String(fd.get("responsable") || "").trim(),
      promotores: String(fd.get("promotores") || "").trim(),
      horarioInicio: String(fd.get("horarioInicio") || "").trim(),
      horarioFin: String(fd.get("horarioFin") || "").trim(),
      ubicacion: String(fd.get("ubicacion") || "").trim(),
      promocionPrincipal: String(fd.get("promocionPrincipal") || "").trim(),
      abordados: String(fd.get("abordados") || "").trim(),
      prospectos: String(fd.get("prospectos") || "").trim(),
      ventas: String(fd.get("ventas") || "").trim(),
      dinamicas: String(fd.get("dinamicas") || "").trim(),
      participantes: String(fd.get("participantes") || "").trim(),
      promocionales: String(fd.get("promocionales") || "").trim(),
      tasaInteres: String(fd.get("tasaInteres") || "").trim(),
      tasaConversion: String(fd.get("tasaConversion") || "").trim(),
      promedioVentasHora: String(fd.get("promedioVentasHora") || "").trim(),
      totalDinamicas: String(fd.get("totalDinamicas") || "").trim(),
      comerciales: collectComerciales(),
      materiales: collectMateriales(),
      incidencias: collectIncidencias(),
      evidenciaLabels: [...evidencia],
      observaciones: String(fd.get("observaciones") || "").trim(),
    };
  }

  function validate(answers) {
    if (!answers.fecha) return "Captura la fecha de la activación.";
    if (!answers.puntoDeVenta) return "Captura el punto de venta.";
    if (!answers.claveYaavser) return "Captura la clave YAAVSER.";
    if (!answers.responsable) return "Captura el responsable.";
    return "";
  }

  function resetEvidence() {
    evidencia.forEach((_, i) => {
      selectedFiles[i] = [];
      renderPreviews(i);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hint.textContent = "";
    const answers = collectAnswers();
    const err = validate(answers);
    if (err) {
      hint.textContent = err;
      showToast(err);
      return;
    }

    const payload = new FormData();
    payload.append("answers", JSON.stringify(answers));
    payload.append("website", form.website?.value || "");

    evidencia.forEach((_, i) => {
      (selectedFiles[i] || []).forEach((file) => {
        payload.append(`ev_${i}`, file, file.name);
      });
    });

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      const res = await fetch(cfg.submitUrl || "/api/submit", {
        method: "POST",
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo enviar");
      }
      form.hidden = true;
      successPanel.hidden = false;
      showToast("Reporte guardado");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err2) {
      hint.textContent = err2.message || "Error de red";
      showToast(hint.textContent);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar reporte";
    }
  });

  document.getElementById("anotherBtn")?.addEventListener("click", () => {
    form.reset();
    resetEvidence();
    updateMaterialTotals();
    successPanel.hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  fillComercial();
  fillMaterial();
  fillIncidencias();
  fillEvidencia();
  updateMaterialTotals();
})();
