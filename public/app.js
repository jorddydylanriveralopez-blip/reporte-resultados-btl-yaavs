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
  const IMAGE_MAX_EDGE = 1600;
  const IMAGE_JPEG_QUALITY = 0.72;

  /** @type {Record<number, File[]>} */
  const selectedFiles = {};
  /** @type {Record<number, File[]>} */
  const materialMermaFiles = {};

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
    form.querySelectorAll(".evidence-card.is-invalid, .material-card.is-invalid").forEach((el) =>
      el.classList.remove("is-invalid"),
    );
  }

  function markInvalid(el) {
    if (!el) return;
    el.classList.add("is-invalid");
    const card = el.closest(".evidence-card, .material-card");
    if (card) card.classList.add("is-invalid");
  }

  function focusFirstInvalid() {
    const el =
      form.querySelector(".is-invalid input, .is-invalid textarea, input.is-invalid, textarea.is-invalid") ||
      form.querySelector(".evidence-card.is-invalid .evidence-pick-btn") ||
      form.querySelector(".material-card.is-invalid .evidence-pick-btn") ||
      form.querySelector(".is-invalid");
    if (!el) return;
    const target = el.closest(".card-section, .material-card") || el;
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
        <td data-label="Ventas por producto">
          <input type="number" min="0" inputmode="numeric" required data-k="ventasPorProducto" aria-label="Ventas por producto ${escapeAttr(name)}" />
        </td>
      </tr>`,
      )
      .join("");
  }

  function setMaterialMermaOpen(idx, open) {
    const panel = document.getElementById(`mat_merma_upload_${idx}`);
    if (!panel) return;
    panel.hidden = !open;
    if (!open) {
      panel.classList.remove("is-invalid");
      materialMermaFiles[idx] = [];
      renderMaterialMermaPreviews(idx);
    }
  }

  function fillMaterial() {
    const box = document.getElementById("materialList");
    box.innerHTML = materiales
      .map((name, i) => {
        materialMermaFiles[i] = [];
        return `
      <article class="material-card" data-idx="${i}" data-material="${escapeAttr(name)}">
        <div class="material-card-head">
          <strong>${escapeHtml(name)}</strong>
        </div>
        <div class="material-fields">
          <label class="field">
            <span>Fecha de entrega <span class="req">*</span></span>
            <input type="date" required data-k="fechaEntrega" aria-label="Fecha de entrega ${escapeAttr(name)}" />
          </label>
          <label class="field">
            <span>Cantidad entregada <span class="req">*</span></span>
            <input
              type="number"
              min="0"
              inputmode="numeric"
              required
              class="mat-ent"
              data-k="cantidadEntregada"
              placeholder="Cantidad del día"
              aria-label="Cantidad entregada ${escapeAttr(name)}"
            />
          </label>
          <label class="field">
            <span>Cantidad devuelta <span class="req">*</span></span>
            <input type="number" min="0" inputmode="numeric" required class="mat-dev" data-k="cantidadDevuelta" aria-label="Cantidad devuelta ${escapeAttr(name)}" />
          </label>
          <label class="field field-computed">
            <span>Cantidad utilizada <span class="req">*</span></span>
            <input
              type="number"
              min="0"
              inputmode="numeric"
              required
              class="mat-uti"
              data-k="cantidadUtilizada"
              value="0"
              readonly
              tabindex="-1"
              aria-readonly="true"
              aria-label="Cantidad utilizada ${escapeAttr(name)}"
            />
            <small class="field-hint">Se calcula sola: entregada − devuelta</small>
          </label>
        </div>
        <fieldset class="material-merma">
          <legend>¿Hay merma o daño? <span class="req">*</span></legend>
          <div class="yesno" role="radiogroup" aria-label="Merma o daño ${escapeAttr(name)}">
            <label><input type="radio" name="mat_merma_${i}" value="Sí" required /> Sí</label>
            <label><input type="radio" name="mat_merma_${i}" value="No" required /> No</label>
          </div>
          <div class="material-merma-upload evidence-card" id="mat_merma_upload_${i}" hidden>
            <div class="evidence-card-head">
              <strong>Evidencias de merma/daño <span class="req" aria-hidden="true">*</span></strong>
              <span class="evidence-count" id="mat_ev_count_${i}">0 archivos</span>
            </div>
            <label class="evidence-pick" for="mat_ev_file_${i}">
              <input
                type="file"
                id="mat_ev_file_${i}"
                accept="image/*,video/*"
                multiple
                hidden
              />
              <span class="evidence-pick-btn">Subir fotos o videos</span>
              <span class="evidence-pick-hint">Fotos o videos · las fotos se comprimen al enviar · máx. ${MAX_FILES_PER_POINT} · ${MAX_FILE_MB} MB c/u</span>
            </label>
            <div class="evidence-previews" id="mat_ev_prev_${i}">
              <p class="evidence-preview-empty">Aquí verás la previsualización de lo que subas.</p>
            </div>
          </div>
        </fieldset>
      </article>`;
      })
      .join("");

    box.addEventListener("input", (e) => {
      if (e.target?.matches?.(".mat-ent, .mat-dev")) {
        const card = e.target.closest(".material-card");
        if (card) calcMaterialUtilizada(card);
        updateMaterialTotals();
      }
    });

    materiales.forEach((_, i) => {
      const radios = box.querySelectorAll(`input[name="mat_merma_${i}"]`);
      radios.forEach((r) =>
        r.addEventListener("change", () => {
          setMaterialMermaOpen(i, r.value === "Sí" && r.checked);
          const card = box.querySelector(`.material-card[data-idx="${i}"]`);
          card?.querySelector(".yesno")?.classList.remove("is-invalid");
          card?.classList.remove("is-invalid");
        }),
      );
      const input = document.getElementById(`mat_ev_file_${i}`);
      input?.addEventListener("change", () => onMaterialMermaFilesChosen(i, input));
      const card = box.querySelector(`.material-card[data-idx="${i}"]`);
      if (card) calcMaterialUtilizada(card);
    });
    updateMaterialTotals();
  }

  function calcMaterialUtilizada(card) {
    const entEl = card.querySelector(".mat-ent");
    const devEl = card.querySelector(".mat-dev");
    const utiEl = card.querySelector(".mat-uti");
    if (!entEl || !devEl || !utiEl) return;
    const ent = Number(entEl.value);
    const dev = Number(devEl.value);
    if (!Number.isFinite(ent) || !Number.isFinite(dev) || isBlank(devEl.value)) {
      utiEl.value = "";
      return;
    }
    const used = Math.max(0, ent - dev);
    utiEl.value = String(used);
  }

  function updateMaterialTotals() {
    const sum = (sel) =>
      [...document.querySelectorAll(sel)].reduce(
        (acc, el) => acc + (Number(el.value) || 0),
        0,
      );
    const set = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(n);
    };
    set("matEntTotal", sum(".mat-ent"));
    set("matUtiTotal", sum(".mat-uti"));
    set("matDevTotal", sum(".mat-dev"));
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
          <span class="evidence-pick-hint">Cualquier archivo · máx. ${MAX_FILES_PER_POINT} · ${MAX_FILE_MB} MB c/u · verás previsualización abajo</span>
        </label>
        <div class="evidence-previews" id="ev_prev_${i}">
          <p class="evidence-preview-empty">Aquí verás la previsualización de lo que subas.</p>
        </div>
      </div>`;
      })
      .join("");

    evidencia.forEach((_, i) => {
      const input = document.getElementById(`ev_file_${i}`);
      input.addEventListener("change", () => onFilesChosen(i, input));
    });
  }

  function appendIncomingFiles(current, incoming, opts = {}) {
    const next = [...current];
    const acceptMediaOnly = Boolean(opts.acceptMediaOnly);

    for (const file of incoming) {
      if (acceptMediaOnly) {
        const ok =
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          /\.(jpe?g|png|gif|webp|heic|heif|mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name);
        if (!ok) {
          showToast(`"${file.name}" no es foto ni video.`);
          continue;
        }
      }
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
    return next;
  }

  function onFilesChosen(idx, input) {
    const incoming = [...(input.files || [])];
    input.value = "";
    selectedFiles[idx] = appendIncomingFiles(selectedFiles[idx] || [], incoming);
    const card = document.querySelector(`.evidence-card[data-idx="${idx}"]`);
    if (selectedFiles[idx].length) card?.classList.remove("is-invalid");
    renderPreviews(idx);
  }

  function onMaterialMermaFilesChosen(idx, input) {
    const incoming = [...(input.files || [])];
    input.value = "";
    materialMermaFiles[idx] = appendIncomingFiles(materialMermaFiles[idx] || [], incoming, {
      acceptMediaOnly: true,
    });
    const panel = document.getElementById(`mat_merma_upload_${idx}`);
    if (materialMermaFiles[idx].length) {
      panel?.classList.remove("is-invalid");
      panel?.closest(".material-card")?.classList.remove("is-invalid");
    }
    renderMaterialMermaPreviews(idx);
  }

  function formatFileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isImageFile(file) {
    return (
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name || "")
    );
  }

  function isVideoFile(file) {
    return (
      file.type.startsWith("video/") ||
      /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name || "")
    );
  }

  function revokePreviewUrls(prevEl) {
    if (!prevEl) return;
    prevEl.querySelectorAll("img[src^='blob:'], video[src^='blob:']").forEach((el) => {
      try {
        URL.revokeObjectURL(el.src);
      } catch (_) {}
    });
  }

  function renderFilePreviews(files, countEl, prevEl, onRemove) {
    if (countEl) {
      countEl.textContent =
        files.length === 1 ? "1 archivo" : `${files.length} archivos`;
      countEl.classList.toggle("has-files", files.length > 0);
    }
    if (!prevEl) return;

    revokePreviewUrls(prevEl);

    if (!files.length) {
      prevEl.innerHTML = `<p class="evidence-preview-empty">Aquí verás la previsualización de lo que subas.</p>`;
      prevEl.classList.remove("has-files");
      return;
    }

    prevEl.classList.add("has-files");
    prevEl.innerHTML = `
      <p class="evidence-preview-label">Previsualización · toca × para quitar</p>
      <div class="evidence-preview-grid">
        ${files
          .map((file, fi) => {
            const url = URL.createObjectURL(file);
            const isVideo = isVideoFile(file);
            const isImage = isImageFile(file);
            let media = `<div class="evidence-file-icon" aria-hidden="true">${escapeHtml(
              fileExt(file.name),
            )}</div>`;
            if (isVideo) {
              media = `<video src="${url}" muted playsinline preload="metadata"></video>`;
            } else if (isImage) {
              media = `<img src="${url}" alt="${escapeAttr(file.name)}" />`;
            }
            return `
            <div class="evidence-thumb" data-fi="${fi}">
              <div class="evidence-thumb-media">
                ${media}
                <button type="button" class="evidence-remove" aria-label="Quitar ${escapeAttr(
                  file.name,
                )}">×</button>
              </div>
              <div class="evidence-thumb-meta">
                <span class="evidence-name" title="${escapeAttr(file.name)}">${escapeHtml(
                  file.name,
                )}</span>
                <span class="evidence-size">${escapeHtml(formatFileSize(file.size))}</span>
              </div>
            </div>`;
          })
          .join("")}
      </div>`;

    prevEl.querySelectorAll(".evidence-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const thumb = btn.closest(".evidence-thumb");
        const fi = Number(thumb?.dataset.fi);
        if (Number.isNaN(fi)) return;
        onRemove(fi);
      });
    });
  }

  function renderPreviews(idx) {
    renderFilePreviews(
      selectedFiles[idx] || [],
      document.getElementById(`ev_count_${idx}`),
      document.getElementById(`ev_prev_${idx}`),
      (fi) => {
        selectedFiles[idx] = (selectedFiles[idx] || []).filter((_, j) => j !== fi);
        renderPreviews(idx);
      },
    );
  }

  function renderMaterialMermaPreviews(idx) {
    renderFilePreviews(
      materialMermaFiles[idx] || [],
      document.getElementById(`mat_ev_count_${idx}`),
      document.getElementById(`mat_ev_prev_${idx}`),
      (fi) => {
        materialMermaFiles[idx] = (materialMermaFiles[idx] || []).filter((_, j) => j !== fi);
        renderMaterialMermaPreviews(idx);
      },
    );
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
      ventasPorProducto: tr.querySelector('[data-k="ventasPorProducto"]').value,
    }));
  }

  function collectMateriales() {
    return [...document.querySelectorAll("#materialList .material-card")].map((card, i) => {
      const merma = card.querySelector(`input[name="mat_merma_${i}"]:checked`);
      return {
        material: card.dataset.material,
        fechaEntrega: card.querySelector('[data-k="fechaEntrega"]').value,
        cantidadEntregada: card.querySelector('[data-k="cantidadEntregada"]').value,
        cantidadUtilizada: card.querySelector('[data-k="cantidadUtilizada"]').value,
        cantidadDevuelta: card.querySelector('[data-k="cantidadDevuelta"]').value,
        mermaDanio: merma ? merma.value : "",
      };
    });
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

  function numField(name) {
    const el = form.elements.namedItem(name);
    const v = Number(el && el.value !== "" ? el.value : NaN);
    return Number.isFinite(v) ? v : 0;
  }

  function hoursFromSchedule() {
    const start = String(form.elements.namedItem("horarioInicio")?.value || "").trim();
    const end = String(form.elements.namedItem("horarioFin")?.value || "").trim();
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return 0;
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins / 60;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function setComputed(name, value) {
    const el = form.elements.namedItem(name);
    if (!el) return;
    el.value = String(value);
  }

  /** Indicadores (pregunta 3) a partir del resumen (pregunta 2) + horario. */
  function calcIndicadores() {
    const abordados = numField("abordados");
    const prospectos = numField("prospectos");
    const ventas = numField("ventas");
    const dinamicas = numField("dinamicas");
    const hours = hoursFromSchedule();

    const tasaInteres = abordados > 0 ? (prospectos / abordados) * 100 : 0;
    const tasaConversion = prospectos > 0 ? (ventas / prospectos) * 100 : 0;
    const promedioVentasHora = hours > 0 ? ventas / hours : 0;

    setComputed("tasaInteres", round1(tasaInteres));
    setComputed("tasaConversion", round1(tasaConversion));
    setComputed("promedioVentasHora", round1(promedioVentasHora));
    setComputed("totalDinamicas", Math.round(dinamicas));
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
      ["horarioInicio", "horarioInicio", "Captura el horario inicial."],
      ["horarioFin", "horarioFin", "Captura el horario final."],
      ["ubicacion", "ubicacion", "Captura la ubicación."],
      ["promocionPrincipal", "promocionPrincipal", "Captura la promoción principal."],
      ["abordados", "abordados", "Captura el número de interesados (puedes poner 0)."],
      ["prospectos", "prospectos", "Captura el número de prospectos (puedes poner 0)."],
      ["ventas", "ventas", "Captura el número de ventas (puedes poner 0)."],
      ["dinamicas", "dinamicas", "Captura el número de dinámicas (puedes poner 0)."],
      ["participantes", "participantes", "Captura el número de participantes (puedes poner 0)."],
      ["promocionales", "promocionales", "Captura el número de promocionales (puedes poner 0)."],
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
      if (isBlank(row.ventasPorProducto)) {
        markInvalid(tr?.querySelector('[data-k="ventasPorProducto"]'));
        return `En resultados comerciales, captura ventas por producto de “${row.servicio}” (puedes poner 0).`;
      }
    }

    for (let i = 0; i < answers.materiales.length; i++) {
      const row = answers.materiales[i];
      const card = document.querySelector(`#materialList .material-card[data-idx="${i}"]`);
      if (card) calcMaterialUtilizada(card);
      row.cantidadUtilizada = card?.querySelector('[data-k="cantidadUtilizada"]')?.value ?? row.cantidadUtilizada;
      if (isBlank(row.fechaEntrega)) {
        markInvalid(card?.querySelector('[data-k="fechaEntrega"]'));
        return `En material promocional, captura la fecha de entrega de “${row.material}”.`;
      }
      if (isBlank(row.cantidadEntregada)) {
        markInvalid(card?.querySelector('[data-k="cantidadEntregada"]'));
        return `En material promocional, captura la cantidad entregada de “${row.material}” (puedes poner 0).`;
      }
      if (isBlank(row.cantidadDevuelta)) {
        markInvalid(card?.querySelector('[data-k="cantidadDevuelta"]'));
        return `En material promocional, captura la cantidad devuelta de “${row.material}” (puedes poner 0).`;
      }
      const ent = Number(row.cantidadEntregada);
      const dev = Number(row.cantidadDevuelta);
      if (Number.isFinite(ent) && Number.isFinite(dev) && dev > ent) {
        markInvalid(card?.querySelector('[data-k="cantidadDevuelta"]'));
        return `En “${row.material}”, la cantidad devuelta no puede ser mayor que la entregada.`;
      }
      if (isBlank(row.cantidadUtilizada)) {
        markInvalid(card?.querySelector('[data-k="cantidadUtilizada"]'));
        return `En material promocional, no se pudo calcular la cantidad utilizada de “${row.material}”.`;
      }
      if (isBlank(row.mermaDanio)) {
        markInvalid(card?.querySelector(".yesno"));
        return `En material promocional, indica si hay merma o daño en “${row.material}”.`;
      }
      if (row.mermaDanio === "Sí" && !(materialMermaFiles[i] || []).length) {
        markInvalid(document.getElementById(`mat_merma_upload_${i}`));
        return `Sube al menos una foto o video de merma/daño de “${row.material}”.`;
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

  function resetMaterialMerma() {
    materiales.forEach((_, i) => {
      materialMermaFiles[i] = [];
      setMaterialMermaOpen(i, false);
      renderMaterialMermaPreviews(i);
    });
  }

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t && t.classList) t.classList.remove("is-invalid");
    t?.closest?.(".yesno")?.classList.remove("is-invalid");
    t?.closest?.(".material-card")?.classList.remove("is-invalid");
  });

  form.addEventListener("input", (e) => {
    const name = e.target?.name;
    if (
      name === "abordados" ||
      name === "prospectos" ||
      name === "ventas" ||
      name === "dinamicas" ||
      name === "horarioInicio" ||
      name === "horarioFin"
    ) {
      calcIndicadores();
    }
  });

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.classList) t.classList.remove("is-invalid");
    t?.closest?.(".yesno")?.classList.remove("is-invalid");
    t?.closest?.(".material-card")?.classList.remove("is-invalid");
    const name = t?.name;
    if (name === "horarioInicio" || name === "horarioFin") calcIndicadores();
  });

  function isCompressibleImage(file) {
    if (!file || file.type.startsWith("video/")) return false;
    if (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp") {
      return true;
    }
    return /\.(jpe?g|png|webp)$/i.test(file.name || "");
  }

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen"));
      };
      img.src = url;
    });
  }

  async function compressImageFile(file) {
    if (!isCompressibleImage(file)) return file;
    // Ya es chica: no gastar tiempo recomprimiendo
    if (file.size <= 350 * 1024) return file;
    try {
      const img = await loadImageElement(file);
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return file;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY),
      );
      if (!blob || blob.size >= file.size * 0.95) return file;
      const base = String(file.name || "foto").replace(/\.[^.]+$/, "") || "foto";
      return new File([blob], `${base}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } catch (_) {
      return file;
    }
  }

  async function prepareUploadFile(file, onStep) {
    if (onStep) onStep();
    return compressImageFile(file);
  }

  function postFormDataWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.responseType = "json";
      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable || !onProgress) return;
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      };
      xhr.onload = () => {
        const data =
          xhr.response && typeof xhr.response === "object"
            ? xhr.response
            : (() => {
                try {
                  return JSON.parse(xhr.responseText || "{}");
                } catch (_) {
                  return {};
                }
              })();
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          if (onProgress) onProgress(100);
          resolve(data);
          return;
        }
        reject(new Error(data.error || `No se pudo enviar (${xhr.status || "red"})`));
      };
      xhr.onerror = () => reject(new Error("Error de red al subir. Revisa tu conexión e intenta de nuevo."));
      xhr.ontimeout = () => reject(new Error("La subida tardó demasiado. Intenta con fotos más ligeras o menos videos."));
      xhr.timeout = 10 * 60 * 1000;
      xhr.send(formData);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hint.textContent = "";
    calcIndicadores();
    document.querySelectorAll("#materialList .material-card").forEach((card) => {
      calcMaterialUtilizada(card);
    });
    updateMaterialTotals();
    const answers = collectAnswers();
    const err = validate(answers);
    if (err) {
      hint.textContent = err;
      showToast(err);
      focusFirstInvalid();
      return;
    }

    const evEntries = [];
    evidencia.forEach((_, i) => {
      (selectedFiles[i] || []).forEach((file) => evEntries.push({ field: `ev_${i}`, file }));
    });
    const matEntries = [];
    materiales.forEach((_, i) => {
      (materialMermaFiles[i] || []).forEach((file) =>
        matEntries.push({ field: `mat_ev_${i}`, file }),
      );
    });
    const allEntries = [...evEntries, ...matEntries];
    const totalSteps = Math.max(1, allEntries.length);

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparando fotos…";
    hint.textContent = "Comprimiendo fotos para enviar más rápido…";

    try {
      let done = 0;
      const prepared = [];
      for (const entry of allEntries) {
        const file = await prepareUploadFile(entry.file, () => {
          done += 1;
          const pct = Math.round((done / totalSteps) * 100);
          submitBtn.textContent = `Preparando… ${pct}%`;
        });
        prepared.push({ field: entry.field, file });
      }

      const payload = new FormData();
      const toSend = { ...answers };
      if (toSend.hayIncidencia !== "Sí") {
        toSend.incidencias = [];
      }
      payload.append("answers", JSON.stringify(toSend));
      payload.append("website", form.website?.value || "");
      prepared.forEach(({ field, file }) => {
        payload.append(field, file, file.name);
      });

      hint.textContent = "Subiendo reporte…";
      submitBtn.textContent = "Subiendo… 0%";
      await postFormDataWithProgress(cfg.submitUrl || "/api/submit", payload, (pct) => {
        submitBtn.textContent = `Subiendo… ${pct}%`;
        hint.textContent = pct >= 100 ? "Guardando…" : `Subiendo archivos… ${pct}%`;
      });

      form.hidden = true;
      successPanel.hidden = false;
      hint.textContent = "";
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
    resetMaterialMerma();
    setIncidenciaDetalleOpen(false);
    document.querySelectorAll(".mat-ent, .mat-dev").forEach((el) => {
      el.value = "";
    });
    document.querySelectorAll("#materialList .material-card").forEach((card) => {
      calcMaterialUtilizada(card);
    });
    updateMaterialTotals();
    calcIndicadores();
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
  calcIndicadores();
})();
