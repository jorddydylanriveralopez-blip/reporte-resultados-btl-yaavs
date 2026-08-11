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
        (name, i) => `
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

  function fillEvidencia() {
    const box = document.getElementById("evidenciaChecks");
    box.innerHTML = evidencia
      .map(
        (name) => `
      <label class="check-pill">
        <input type="checkbox" name="evidencia" value="${escapeAttr(name)}" />
        <span>${escapeHtml(name)}</span>
      </label>`,
      )
      .join("");
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
    const answers = {
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
      evidencia: [...form.querySelectorAll('input[name="evidencia"]:checked')].map(
        (el) => el.value,
      ),
      observaciones: String(fd.get("observaciones") || "").trim(),
    };
    return answers;
  }

  function validate(answers) {
    if (!answers.fecha) return "Captura la fecha de la activación.";
    if (!answers.puntoDeVenta) return "Captura el punto de venta.";
    if (!answers.claveYaavser) return "Captura la clave YAAVSER.";
    if (!answers.responsable) return "Captura el responsable.";
    return "";
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

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      const res = await fetch(cfg.submitUrl || "/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          website: form.website?.value || "",
        }),
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
