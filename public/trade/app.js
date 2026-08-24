(() => {
  const cfg = window.YAAVS_TRADE_CONFIG || {};
  const opts = window.YAAVS_TRADE_OPTIONS || {};
  const form = document.getElementById("tradeForm");
  const successPanel = document.getElementById("successPanel");
  const toast = document.getElementById("toast");
  const hint = document.getElementById("formHint");
  const submitBtn = document.getElementById("submitBtn");

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
    box.innerHTML = Array.from({ length: 11 }, (_, i) => {
      return `<label><input type="radio" name="nps" value="${i}" required /><span>${i}</span></label>`;
    }).join("");
  }

  function fillChecks(boxId, name, items) {
    const box = document.getElementById(boxId);
    box.innerHTML = items
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
    box.innerHTML = items
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

  function syncMejorarOtro() {
    const checked = [...form.querySelectorAll('input[name="mejorarPop"]:checked')].map((el) => el.value);
    const wrap = document.getElementById("mejorarPopOtroWrap");
    const input = form.elements.namedItem("mejorarPopOtro");
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

  function collectAnswers() {
    const fd = new FormData(form);
    const productos = [...form.querySelectorAll('input[name="productos"]:checked')].map((el) => el.value);
    const mejorarPop = [...form.querySelectorAll('input[name="mejorarPop"]:checked')].map((el) => el.value);
    return {
      claveYaavser: String(fd.get("claveYaavser") || "").trim(),
      nps: String(fd.get("nps") || "").trim(),
      productos,
      atencionEjecutivo: String(fd.get("atencionEjecutivo") || "").trim(),
      frecuenciaVisita: String(fd.get("frecuenciaVisita") || "").trim(),
      actualizacionPop: String(fd.get("actualizacionPop") || "").trim(),
      satisfaccionPop: String(fd.get("satisfaccionPop") || "").trim(),
      calidadTrade: String(fd.get("calidadTrade") || "").trim(),
      mejorarPop,
      mejorarPopOtro: String(fd.get("mejorarPopOtro") || "").trim(),
      satisfaccionGeneral: String(fd.get("satisfaccionGeneral") || "").trim(),
      conocimientoBeneficios: String(fd.get("conocimientoBeneficios") || "").trim(),
      comentarios: String(fd.get("comentarios") || "").trim(),
    };
  }

  function validate(a) {
    clearInvalid();
    if (isBlank(a.claveYaavser)) {
      markInvalid(form.elements.namedItem("claveYaavser"));
      return "Captura la clave YAAVSER.";
    }
    if (isBlank(a.nps)) {
      markInvalid(document.getElementById("npsScale"));
      return "Selecciona una calificación de 0 a 10.";
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
    if (isBlank(a.actualizacionPop)) {
      markInvalid(document.getElementById("actualizacionPopBox"));
      return "Indica si recibiste actualización de material POP.";
    }
    if (isBlank(a.satisfaccionPop)) {
      markInvalid(document.getElementById("satisfaccionPopBox"));
      return "Califica tu satisfacción con el material POP.";
    }
    if (isBlank(a.calidadTrade)) {
      markInvalid(document.getElementById("calidadTradeBox"));
      return "Califica la calidad de la ejecución de Trade Marketing.";
    }
    if (!a.mejorarPop.length) {
      markInvalid(document.getElementById("mejorarPopBox"));
      return "Marca al menos un aspecto a mejorar del material POP.";
    }
    if (a.mejorarPop.includes("Otro") && isBlank(a.mejorarPopOtro)) {
      markInvalid(form.elements.namedItem("mejorarPopOtro"));
      return "Especifica el otro aspecto a mejorar.";
    }
    if (isBlank(a.satisfaccionGeneral)) {
      markInvalid(document.getElementById("satisfaccionGeneralBox"));
      return "Califica tu experiencia general con YAAVS.";
    }
    if (isBlank(a.conocimientoBeneficios)) {
      markInvalid(document.getElementById("beneficiosBox"));
      return "Indica qué tanto conoces los beneficios YAAVSER.";
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
    if (t?.name === "mejorarPop") syncMejorarOtro();
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
    syncMejorarOtro();
    successPanel.hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  fillNps();
  fillChecks("productosBox", "productos", opts.productos || []);
  fillRadios("atencionBox", "atencionEjecutivo", opts.atencion || [], true);
  fillRadios("frecuenciaBox", "frecuenciaVisita", opts.frecuencia || []);
  fillRadios("actualizacionPopBox", "actualizacionPop", opts.actualizacionPop || []);
  fillRadios("satisfaccionPopBox", "satisfaccionPop", opts.satisfaccionPop || [], true);
  fillRadios("calidadTradeBox", "calidadTrade", opts.calidadTrade || [], true);
  fillChecks("mejorarPopBox", "mejorarPop", opts.mejorarPop || []);
  fillRadios("satisfaccionGeneralBox", "satisfaccionGeneral", opts.satisfaccionGeneral || [], true);
  fillRadios("beneficiosBox", "conocimientoBeneficios", opts.beneficios || []);
  syncMejorarOtro();
})();
