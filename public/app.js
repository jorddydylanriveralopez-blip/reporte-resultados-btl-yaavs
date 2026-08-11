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
    }, 3200);
  }

  function isBlank(v) {
    return v == null || String(v).trim() === "";
  }

  function clearInvalid() {
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    form.querySelectorAll(".evidence-card.is-invalid").forEach((el) =>
      el.classList.remove("is-invalid"),
    );
  }

  function markInvalid(el) {
    if (!el) return;
    el.classList.add("is-invalid");
    const card = el.closest(".evidence-card");
    if (card) card.classList.add("is-invalid");
  }

  function focusFirstInvalid() {
    const el =
      form.querySelector(".is-invalid input, .is-invalid textarea, input.is-invalid, textarea.is-invalid") ||
      form.querySelector(".evidence-card.is-invalid .evidence-pick-btn") ||
      form.querySelector(".is-invalid");
    if (!el) return;
    const target = el.closest(".card-section") || el;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch (_) {
        el.focus();
      }
    }
  }

  function fillComercial() {
    const tbody = document.querySelector("#comercialTable tbody");
    tbody.innerHTML = comerciales
      .map(
        (name) => `
      <tr data-servicio="${escapeAttr(name)}">
        <td class="row-label" data-label="Servicio">${escapeHtml(name)}</td>
        <td data-label="Interesados">
          <input type="number" min="0" inputmode="numeric" required data-k="interesados" aria-label="Interesados ${escapeAttr(name)}" />
        </td>
        <td data-label="Operaciones">
          <input type="number" min="0" inputmode="numeric" required data-k="operaciones" aria-label="Operaciones ${escapeAttr(name)}" />
        </td>
        <td data-label="Motivo de no cierre">
          <input type="text" required data-k="motivo" placeholder="Motivo" aria-label="Motivo ${escapeAttr(name)}" />
        </td>
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
        <td class="row-label" data-label="Material">${escapeHtml(name)}</td>
        <td data-label="¿Cuántas tenemos en este momento?">
          <input type="number" min="0" inputmode="numeric" required class="mat-cant" data-k="cantidad" aria-label="¿Cuántas tenemos en este momento? ${escapeAttr(name)}" />
        </td>
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
    const totalEl = document.getElementById("matCantTotal");
    if (totalEl) totalEl.textContent = String(sum(".mat-cant"));
  }

  function setIncidenciaDetalleOpen(open) {
    const panel = document.getElementById("incidenciaDetalle");
    if (!panel) return;
    panel.hidden = !open;
    panel.querySelectorAll("input, textarea").forEach((el) => {
      if (el.type === "file") return;
      if (open) el.setAttribute("required", "required");
      else {
        el.removeAttribute("required");
        el.classList.remove("is-invalid");
      }
    });
    if (!open) {
      panel.querySelectorAll(".yesno, .evidence-card").forEach((el) =>
        el.classList.remove("is-invalid"),
      );
    }
  }

  function bindHayIncidencia() {
    const radios = form.querySelectorAll('input[name="hayIncidencia"]');
    const sync = () => {
      const checked = form.querySelector('input[name="hayIncidencia"]:checked');
      const open = checked?.value === "Sí";
      setIncidenciaDetalleOpen(open);
    };
    radios.forEach((r) => r.addEventListener("change", sync));
    sync();
  }

  function fillIncidencias() {
    const tbody = document.querySelector("#incidenciaTable tbody");
    tbody.innerHTML = incidencias
      .map(
        (name, i) => `
      <tr data-incidencia="${escapeAttr(name)}">
        <td class="row-label" data-label="Incidencia">${escapeHtml(name)}</td>
        <td data-label="Sí / No">
          <div class="yesno" role="radiogroup" aria-label="${escapeAttr(name)}">
            <label><input type="radio" name="inc_${i}" value="Sí" required /> Sí</label>
            <label><input type="radio" name="inc_${i}" value="No" required /> No</label>
          </div>
        </td>
        <td data-label="Descripción breve">
          <input type="text" required data-k="descripcion" placeholder="Descripción breve" aria-label="Descripción ${escapeAttr(name)}" />
        </td>
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
          <strong>${escapeHtml(name)} <span class="req" aria-hidden="true">*</span></strong>
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
    const card = document.querySelector(`.evidence-card[data-idx="${idx}"]`);
    if (next.length) card?.classList.remove("is-invalid");
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
      cantidad: tr.querySelector('[data-k="cantidad"]').value,
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
      hayIncidencia: String(fd.get("hayIncidencia") || "").trim(),
      comerciales: collectComerciales(),
      materiales: collectMateriales(),
      incidencias: collectIncidencias(),
      evidenciaLabels: [...evidencia],
      observaciones: String(fd.get("observaciones") || "").trim(),
    };
  }

  function validate(answers) {
    clearInvalid();

    const requiredText = [
      ["fecha", "fecha", "Captura la fecha de la activación."],
      ["puntoDeVenta", "puntoDeVenta", "Captura el punto de venta."],
      ["claveYaavser", "claveYaavser", "Captura la clave YAAVSER."],
      ["responsable", "responsable", "Captura el responsable."],
      ["promotores", "promotores", "Captura el/los promotor(es)."],
      ["horarioInicio", "horarioInicio", "Captura la hora de inicio."],
      ["horarioFin", "horarioFin", "Captura la hora de fin."],
      ["ubicacion", "ubicacion", "Captura la ubicación."],
      ["promocionPrincipal", "promocionPrincipal", "Captura la promoción principal."],
      ["abordados", "abordados", "Captura el número de abordados (puedes poner 0)."],
      ["prospectos", "prospectos", "Captura el número de prospectos (puedes poner 0)."],
      ["ventas", "ventas", "Captura el número de ventas (puedes poner 0)."],
      ["dinamicas", "dinamicas", "Captura el número de dinámicas (puedes poner 0)."],
      ["participantes", "participantes", "Captura el número de participantes (puedes poner 0)."],
      ["promocionales", "promocionales", "Captura el número de promocionales (puedes poner 0)."],
      ["tasaInteres", "tasaInteres", "Captura la tasa de interés % (puedes poner 0)."],
      ["tasaConversion", "tasaConversion", "Captura la tasa de conversión % (puedes poner 0)."],
      ["promedioVentasHora", "promedioVentasHora", "Captura el promedio de ventas/hora (puedes poner 0)."],
      ["totalDinamicas", "totalDinamicas", "Captura el total de dinámicas (puedes poner 0)."],
      ["observaciones", "observaciones", "Captura las observaciones (si no hay, escribe “Ninguna”)."],
    ];

    for (const [key, name, msg] of requiredText) {
      if (isBlank(answers[key])) {
        const el = form.elements.namedItem(name);
        markInvalid(el);
        return msg;
      }
    }

    if (isBlank(answers.hayIncidencia)) {
      markInvalid(form.querySelector(".gate-yesno"));
      return "Indica si hay una incidencia (Sí o No).";
    }

    for (const row of answers.comerciales) {
      const tr = [...document.querySelectorAll("#comercialTable tbody tr")].find(
        (el) => el.dataset.servicio === row.servicio,
      );
      if (isBlank(row.interesados)) {
        markInvalid(tr?.querySelector('[data-k="interesados"]'));
        return `En resultados comerciales, captura interesados de “${row.servicio}” (puedes poner 0).`;
      }
      if (isBlank(row.operaciones)) {
        markInvalid(tr?.querySelector('[data-k="operaciones"]'));
        return `En resultados comerciales, captura operaciones de “${row.servicio}” (puedes poner 0).`;
      }
      if (isBlank(row.motivo)) {
        markInvalid(tr?.querySelector('[data-k="motivo"]'));
        return `En resultados comerciales, captura el motivo de “${row.servicio}”.`;
      }
    }

    for (const row of answers.materiales) {
      const tr = [...document.querySelectorAll("#materialTable tbody tr")].find(
        (el) => el.dataset.material === row.material,
      );
      if (isBlank(row.cantidad)) {
        markInvalid(tr?.querySelector('[data-k="cantidad"]'));
        return `En material promocional, indica cuántas “${row.material}” tienes ahora (puedes poner 0).`;
      }
    }

    if (answers.hayIncidencia === "Sí") {
      for (let i = 0; i < answers.incidencias.length; i++) {
        const row = answers.incidencias[i];
        const tr = document.querySelectorAll("#incidenciaTable tbody tr")[i];
        if (isBlank(row.siNo)) {
          markInvalid(tr?.querySelector(".yesno"));
          return `En incidencias, responde Sí/No en “${row.incidencia}”.`;
        }
        if (isBlank(row.descripcion)) {
          markInvalid(tr?.querySelector('[data-k="descripcion"]'));
          return `En incidencias, escribe la descripción de “${row.incidencia}” (si no aplica, “Ninguna”).`;
        }
      }
    } else {
      answers.incidencias = [];
    }

    for (let i = 0; i < evidencia.length; i++) {
      if (!(selectedFiles[i] || []).length) {
        markInvalid(document.querySelector(`.evidence-card[data-idx="${i}"]`));
        return `Sube al menos un archivo de evidencia en “${evidencia[i]}”.`;
      }
    }

    return "";
  }

  function resetEvidence() {
    evidencia.forEach((_, i) => {
      selectedFiles[i] = [];
      renderPreviews(i);
    });
  }

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t && t.classList) t.classList.remove("is-invalid");
    t?.closest?.(".yesno")?.classList.remove("is-invalid");
  });

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.classList) t.classList.remove("is-invalid");
    t?.closest?.(".yesno")?.classList.remove("is-invalid");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hint.textContent = "";
    const answers = collectAnswers();
    const err = validate(answers);
    if (err) {
      hint.textContent = err;
      showToast(err);
      focusFirstInvalid();
      return;
    }

    const payload = new FormData();
    const toSend = { ...answers };
    if (toSend.hayIncidencia !== "Sí") {
      toSend.incidencias = [];
    }
    payload.append("answers", JSON.stringify(toSend));
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
    clearInvalid();
    resetEvidence();
    setIncidenciaDetalleOpen(false);
    updateMaterialTotals();
    successPanel.hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  fillComercial();
  fillMaterial();
  fillIncidencias();
  fillEvidencia();
  bindHayIncidencia();
  updateMaterialTotals();
})();
