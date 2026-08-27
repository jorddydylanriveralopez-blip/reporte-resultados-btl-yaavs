(() => {
  const cfg = window.YAAVS_TRADE_CONFIG || {};
  const opts = window.YAAVS_TRADE_OPTIONS || {};
  const form = document.getElementById("tradeForm");
  const successPanel = document.getElementById("successPanel");
  const toast = document.getElementById("toast");
  const hint = document.getElementById("formHint");
  const submitBtn = document.getElementById("submitBtn");

  if (!form) {
    console.error("[trade] No se encontró #tradeForm. ¿Se cargó /trade/app.js?");
    return;
  }
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

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearInvalid() {
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  }

  function markInvalid(el) {
    if (!el) return;
    el.classList.add("is-invalid");
  }

  function focusFirstInvalid() {
    const el =
      form.querySelector(".is-invalid input, .is-invalid textarea, input.is-invalid, textarea.is-invalid") ||
      form.querySelector(".is-invalid");
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    if (el && typeof el.focus === "function" && el.tagName !== "DIV") el.focus();
  }

  function fillNps() {
    const box = document.getElementById("npsScale");
    if (!box) return;
    box.innerHTML = Array.from({ length: 5 }, (_, i) => {
      const n = i + 1;
      return `<label><input type="radio" name="nps" value="${n}" required /><span>${n}</span></label>`;
    }).join("");
  }

  function fillChecks(boxId, name, items) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const list = Array.isArray(items) ? items : [];
    box.innerHTML = list
      .map(
        (label) =>
          `<label><input type="checkbox" name="${name}" value="${escapeHtml(label)}" /> <span>${escapeHtml(
            label,
          )}</span></label>`,
      )
      .join("");
  }

  function fillRadios(boxId, name, items, asObjects = false) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const list = Array.isArray(items) ? items : [];
    box.innerHTML = list
      .map((item) => {
        const value = asObjects ? item.value : item;
        const label = asObjects ? item.label : item;
        const badge = asObjects
          ? `<span class="scale-val">${escapeHtml(value)}</span>`
          : "";
        return `<label><input type="radio" name="${name}" value="${escapeHtml(value)}" required /> ${badge}<span>${escapeHtml(
          label,
        )}</span></label>`;
      })
      .join("");
  }

  function syncMaterialPopOtro() {
    const checked = [...form.querySelectorAll('input[name="materialPop"]:checked')].map((el) => el.value);
    const wrap = document.getElementById("materialPopOtroWrap");
    const input = form.elements.namedItem("materialPopOtro");
    const open = checked.includes("Otro");
    wrap.hidden = !open;
    if (!open) {
      input.value = "";
      input.removeAttribute("required");
      input.classList.remove("is-invalid");
    } else {
      input.setAttribute("required", "required");
    }
  }

  function syncRedesSociales() {
    const wrap = document.getElementById("redesSocialesWrap");
    const box = document.getElementById("redesSocialesBox");
    const sigue = form.querySelector('input[name="sigueRedes"]:checked')?.value || "";
    const open = sigue === "Sí";
    wrap.hidden = !open;
    if (!open) {
      box.querySelectorAll("input").forEach((el) => {
        el.checked = false;
      });
      box.classList.remove("is-invalid");
    }
  }

  function syncOtroDistribuidor() {
    const wrap = document.getElementById("otroDistribuidorWrap");
    const cual = form.elements.namedItem("otroDistribuidorCual");
    const beneficios = form.elements.namedItem("otroDistribuidorBeneficios");
    const val = form.querySelector('input[name="otroDistribuidor"]:checked')?.value || "";
    const open = val === "Sí";
    wrap.hidden = !open;
    if (!open) {
      cual.value = "";
      beneficios.value = "";
      cual.removeAttribute("required");
      beneficios.removeAttribute("required");
      cual.classList.remove("is-invalid");
      beneficios.classList.remove("is-invalid");
    } else {
      cual.setAttribute("required", "required");
      beneficios.setAttribute("required", "required");
    }
  }

  function collectAnswers() {
    const fd = new FormData(form);
    const productos = [...form.querySelectorAll('input[name="productos"]:checked')].map((el) => el.value);
    const materialPop = [...form.querySelectorAll('input[name="materialPop"]:checked')].map((el) => el.value);
    const sigueRedes = String(fd.get("sigueRedes") || "").trim();
    const otroDistribuidor = String(fd.get("otroDistribuidor") || "").trim();
    const redesSociales =
      sigueRedes === "Sí"
        ? [...form.querySelectorAll('input[name="redesSociales"]:checked')].map((el) => el.value)
        : [];
    return {
      claveYaavser: String(fd.get("claveYaavser") || "").trim(),
      satisfaccionGeneral: String(fd.get("satisfaccionGeneral") || "").trim(),
      nps: String(fd.get("nps") || "").trim(),
      npsPorque: String(fd.get("npsPorque") || "").trim(),
      productos,
      atencionEjecutivo: String(fd.get("atencionEjecutivo") || "").trim(),
      frecuenciaVisita: String(fd.get("frecuenciaVisita") || "").trim(),
      materialPop,
      materialPopOtro: String(fd.get("materialPopOtro") || "").trim(),
      calidadEjecutivo: String(fd.get("calidadEjecutivo") || "").trim(),
      conocimientoBeneficios: String(fd.get("conocimientoBeneficios") || "").trim(),
      sigueRedes,
      redesSociales,
      otroDistribuidor,
      otroDistribuidorCual: otroDistribuidor === "Sí" ? String(fd.get("otroDistribuidorCual") || "").trim() : "",
      otroDistribuidorBeneficios:
        otroDistribuidor === "Sí" ? String(fd.get("otroDistribuidorBeneficios") || "").trim() : "",
      comentarios: String(fd.get("comentarios") || "").trim(),
    };
  }

  function validate(a) {
    clearInvalid();
    if (isBlank(a.claveYaavser)) {
      markInvalid(form.elements.namedItem("claveYaavser"));
      return "Captura la clave YAAVSER.";
    }
    if (isBlank(a.satisfaccionGeneral)) {
      markInvalid(document.getElementById("satisfaccionGeneralBox"));
      return "Califica tu experiencia general con YAAVS.";
    }
    if (isBlank(a.nps)) {
      markInvalid(document.getElementById("npsScale"));
      return "Selecciona una calificación de 1 a 5.";
    }
    if (isBlank(a.npsPorque)) {
      markInvalid(form.elements.namedItem("npsPorque"));
      return "Cuéntanos por qué diste esa calificación.";
    }
    if (!a.productos.length) {
      markInvalid(document.getElementById("productosBox"));
      return "Marca al menos un producto o servicio.";
    }
    if (isBlank(a.atencionEjecutivo)) {
      markInvalid(document.getElementById("atencionBox"));
      return "Califica la atención del ejecutivo de ventas.";
    }
    if (isBlank(a.frecuenciaVisita)) {
      markInvalid(document.getElementById("frecuenciaBox"));
      return "Indica la frecuencia de visita.";
    }
    if (!a.materialPop.length) {
      markInvalid(document.getElementById("materialPopBox"));
      return "Marca al menos un material POP recibido.";
    }
    if (a.materialPop.includes("Otro") && isBlank(a.materialPopOtro)) {
      markInvalid(form.elements.namedItem("materialPopOtro"));
      return "Especifica el otro material POP.";
    }
    if (isBlank(a.calidadEjecutivo)) {
      markInvalid(document.getElementById("calidadEjecutivoBox"));
      return "Califica la calidad de la ejecución del Ejecutivo de Ventas.";
    }
    if (isBlank(a.conocimientoBeneficios)) {
      markInvalid(document.getElementById("beneficiosBox"));
      return "Indica qué tanto conoces los beneficios YAAVSER.";
    }
    if (isBlank(a.sigueRedes)) {
      markInvalid(document.getElementById("sigueRedesBox"));
      return "Indica si nos sigues en redes sociales.";
    }
    if (a.sigueRedes === "Sí" && !a.redesSociales.length) {
      markInvalid(document.getElementById("redesSocialesBox"));
      return "Marca al menos una red social.";
    }
    if (isBlank(a.otroDistribuidor)) {
      markInvalid(document.getElementById("otroDistribuidorBox"));
      return "Indica si trabajas con otro distribuidor.";
    }
    if (a.otroDistribuidor === "Sí" && isBlank(a.otroDistribuidorCual)) {
      markInvalid(form.elements.namedItem("otroDistribuidorCual"));
      return "Indica cuál es el otro distribuidor.";
    }
    if (a.otroDistribuidor === "Sí" && isBlank(a.otroDistribuidorBeneficios)) {
      markInvalid(form.elements.namedItem("otroDistribuidorBeneficios"));
      return "Indica qué beneficios te otorga el otro distribuidor.";
    }
    if (isBlank(a.comentarios)) {
      markInvalid(form.elements.namedItem("comentarios"));
      return "Escribe comentarios (si no hay, “Ninguna”).";
    }
    return "";
  }

  form.addEventListener("change", (e) => {
    const t = e.target;
    t?.classList?.remove("is-invalid");
    t?.closest?.(".nps-scale, .check-grid, .choice-list, .choice-scale, .field")?.classList.remove(
      "is-invalid",
    );
    if (t?.name === "materialPop") syncMaterialPopOtro();
    if (t?.name === "sigueRedes") syncRedesSociales();
    if (t?.name === "otroDistribuidor") syncOtroDistribuidor();
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

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      const res = await fetch(cfg.submitUrl || "/api/trade/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, website: form.website?.value || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar");
      form.hidden = true;
      successPanel.hidden = false;
      showToast("Encuesta enviada");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err2) {
      hint.textContent = err2.message || "Error de red";
      showToast(hint.textContent);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar encuesta";
    }
  });

  document.getElementById("anotherBtn")?.addEventListener("click", () => {
    form.reset();
    clearInvalid();
    syncMaterialPopOtro();
    syncRedesSociales();
    syncOtroDistribuidor();
    successPanel.hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  fillNps();
  fillRadios("satisfaccionGeneralBox", "satisfaccionGeneral", opts.satisfaccionGeneral || [], true);
  fillChecks("productosBox", "productos", opts.productos || []);
  fillRadios("atencionBox", "atencionEjecutivo", opts.atencion || [], true);
  fillRadios("frecuenciaBox", "frecuenciaVisita", opts.frecuencia || []);
  fillChecks("materialPopBox", "materialPop", opts.materialPop || []);
  fillRadios("calidadEjecutivoBox", "calidadEjecutivo", opts.calidadEjecutivo || [], true);
  fillRadios("beneficiosBox", "conocimientoBeneficios", opts.beneficios || []);
  fillRadios("sigueRedesBox", "sigueRedes", opts.sigueRedes || []);
  fillChecks("redesSocialesBox", "redesSociales", opts.redesSociales || []);
  fillRadios("otroDistribuidorBox", "otroDistribuidor", opts.otroDistribuidor || []);
  syncMaterialPopOtro();
  syncRedesSociales();
  syncOtroDistribuidor();
})();
