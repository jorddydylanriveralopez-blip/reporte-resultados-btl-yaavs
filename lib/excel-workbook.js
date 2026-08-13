module.exports = function createBuildWorkbook({ ExcelJS, path, fs, publicDir }) {
  const NAVY = "FF002B44";
  const NAVY_DEEP = "FF001A2C";
  const TEAL = "FF00A0C8";
  const TEAL_SOFT = "FFE6F6FB";
  const ALT = "FFF3F8FB";
  const LINE = "FFD5E4EE";
  const INK = "FF071824";
  const MUTED = "FF6B8296";
  const WHITE = "FFFFFFFF";
  const GREEN = "FF28785A";
  const RED = "FFC83048";
  const GOLD = "FFE8C547";

  const MATERIAL_CATALOG = [
    "Pelota de esponja",
    "Cilindro AT&T",
    "Llavero 1",
    "Tarjetero anillo",
    "Plumas cartón",
    "Plumas blancas",
    "Plumas negras",
    "Anillo celular",
  ];

  const NUM_KEYS = new Set([
    "abordados",
    "prospectos",
    "ventas",
    "dinamicas",
    "participantes",
    "promocionales",
    "tasaInteres",
    "tasaConversion",
    "promedioVentasHora",
    "totalDinamicas",
  ]);

  const CENTER_KEYS = new Set([
    "claveYaavser",
    "receivedAt",
    "fecha",
    "horarioInicio",
    "horarioFin",
    "hayIncidencia",
    ...NUM_KEYS,
  ]);

  function paintCell(cell, { fill, font, align, border, numFmt } = {}) {
    if (fill) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
    if (font) {
      cell.font = { name: "Calibri", ...font };
    }
    if (align) {
      cell.alignment = { vertical: "middle", ...align };
    }
    if (border) {
      const b = { style: "thin", color: { argb: border } };
      cell.border = { top: b, left: b, bottom: b, right: b };
    }
    if (numFmt) cell.numFmt = numFmt;
  }

  function styleHeaderRow(row, fill = TEAL) {
    row.height = 28;
    row.eachCell((cell) => {
      paintCell(cell, {
        fill,
        font: { bold: true, color: { argb: WHITE }, size: 11 },
        align: { horizontal: "center", wrapText: true },
        border: fill,
      });
    });
  }

  function fillRange(sheet, r1, c1, r2, c2, fill) {
    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) {
        paintCell(sheet.getCell(r, c), { fill });
      }
    }
  }

  function buildMaterialInventory(rawList) {
    const byMaterial = new Map();
    MATERIAL_CATALOG.forEach((name) => {
      byMaterial.set(name, {
        material: name,
        entregada: 0,
        utilizada: 0,
        devuelta: 0,
        mermaSi: 0,
        reportes: 0,
      });
    });

    (rawList || []).forEach((entry) => {
      const mats = Array.isArray(entry?.answers?.materiales) ? entry.answers.materiales : [];
      mats.forEach((m) => {
        const name = String(m.material || "Sin nombre").trim() || "Sin nombre";
        if (!byMaterial.has(name)) {
          byMaterial.set(name, {
            material: name,
            entregada: 0,
            utilizada: 0,
            devuelta: 0,
            mermaSi: 0,
            reportes: 0,
          });
        }
        const row = byMaterial.get(name);
        row.entregada += Number(m.cantidadEntregada) || 0;
        row.utilizada += Number(m.cantidadUtilizada) || 0;
        row.devuelta += Number(m.cantidadDevuelta) || 0;
        const merma = String(m.mermaDanio || "")
          .trim()
          .toLowerCase();
        if (merma === "sí" || merma === "si") row.mermaSi += 1;
        row.reportes += 1;
      });
    });

    return [...byMaterial.values()].map((r) => ({
      ...r,
      saldo: r.entregada - r.utilizada,
    }));
  }

  function sumKey(items, key) {
    return items.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  }

  function isSi(value) {
    const v = String(value || "")
      .trim()
      .toLowerCase();
    return v === "sí" || v === "si";
  }

  function tryAddLogo(workbook) {
    try {
      const logoPath = path.join(publicDir, "assets", "logo-yaavs-white.png");
      if (!fs.existsSync(logoPath)) return null;
      return workbook.addImage({
        filename: logoPath,
        extension: "png",
      });
    } catch (_) {
      return null;
    }
  }

  return async function buildWorkbook(items, rawList, { FIELD_ORDER, COLUMN_WIDTHS, formatDateMx }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "YAAVS";
    workbook.company = "YAAVS";
    workbook.created = new Date();
    workbook.modified = new Date();

    const list = Array.isArray(items) ? items : [];
    const inventory = buildMaterialInventory(rawList);
    const generatedAt = formatDateMx(new Date().toISOString());
    const logoId = tryAddLogo(workbook);

    const incidenciasCount = list.filter((r) => isSi(r.hayIncidencia)).length;
    const kpis = [
      { label: "Reportes", value: list.length },
      { label: "Interesados", value: sumKey(list, "abordados") },
      { label: "Prospectos", value: sumKey(list, "prospectos") },
      { label: "Ventas", value: sumKey(list, "ventas") },
      { label: "Con incidencia", value: incidenciasCount },
    ];

    // ——— Portada ———
    const cover = workbook.addWorksheet("Portada", {
      properties: { tabColor: { argb: TEAL } },
      views: [{ showGridLines: false }],
    });
    cover.columns = [
      { width: 3 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 3 },
    ];

    fillRange(cover, 1, 1, 3, 8, NAVY);
    cover.mergeCells(1, 2, 3, 6);
    const brand = cover.getCell(1, 2);
    paintCell(brand, {
      fill: NAVY,
      font: { bold: true, size: 22, color: { argb: WHITE } },
      align: { horizontal: "left", vertical: "middle", indent: 1 },
    });
    brand.value = "YAAVS  ·  Reporte BTL";

    if (logoId != null) {
      cover.addImage(logoId, {
        tl: { col: 6.15, row: 0.35 },
        ext: { width: 110, height: 42 },
      });
    }

    fillRange(cover, 4, 1, 4, 8, TEAL);
    cover.getRow(4).height = 8;

    cover.mergeCells(6, 2, 6, 7);
    paintCell(cover.getCell(6, 2), {
      font: { bold: true, size: 16, color: { argb: NAVY_DEEP } },
      align: { horizontal: "left" },
    });
    cover.getCell(6, 2).value = "Reporte de Resultados – Activación BTL";

    cover.mergeCells(7, 2, 7, 7);
    paintCell(cover.getCell(7, 2), {
      font: { size: 11, color: { argb: MUTED }, italic: true },
      align: { horizontal: "left" },
    });
    cover.getCell(7, 2).value = `Generado: ${generatedAt}`;

    cover.getRow(9).height = 18;
    paintCell(cover.getCell(9, 2), {
      font: { bold: true, size: 12, color: { argb: NAVY } },
    });
    cover.getCell(9, 2).value = "Indicadores clave";

    kpis.forEach((kpi, i) => {
      const col = 2 + i;
      const labelCell = cover.getCell(11, col);
      const valueCell = cover.getCell(12, col);
      paintCell(labelCell, {
        fill: TEAL_SOFT,
        font: { bold: true, size: 10, color: { argb: MUTED } },
        align: { horizontal: "center" },
        border: LINE,
      });
      labelCell.value = kpi.label;
      paintCell(valueCell, {
        fill: WHITE,
        font: {
          bold: true,
          size: 18,
          color: { argb: i === 4 && kpi.value > 0 ? RED : NAVY },
        },
        align: { horizontal: "center" },
        border: LINE,
      });
      valueCell.value = kpi.value;
      cover.getRow(11).height = 22;
      cover.getRow(12).height = 36;
    });

    cover.getRow(14).height = 18;
    paintCell(cover.getCell(14, 2), {
      font: { bold: true, size: 12, color: { argb: NAVY } },
    });
    cover.getCell(14, 2).value = "Inventario · Material promocional";

    const invHeaders = ["Producto", "Entregada", "Utilizada", "Devuelta", "Saldo", "Merma"];
    const invHeaderRow = cover.getRow(15);
    invHeaders.forEach((h, i) => {
      const cell = invHeaderRow.getCell(2 + i);
      cell.value = h;
    });
    styleHeaderRow(invHeaderRow, NAVY);

    inventory.forEach((row, idx) => {
      const excelRow = cover.getRow(16 + idx);
      const vals = [
        row.material,
        row.entregada,
        row.utilizada,
        row.devuelta,
        row.saldo,
        row.mermaSi,
      ];
      vals.forEach((v, i) => {
        const cell = excelRow.getCell(2 + i);
        cell.value = v;
        paintCell(cell, {
          fill: idx % 2 === 1 ? ALT : WHITE,
          font: {
            size: 11,
            color: { argb: INK },
            bold: i === 0,
          },
          align: { horizontal: i === 0 ? "left" : "center" },
          border: LINE,
        });
        if ((i === 4 && Number(v) < 0) || (i === 5 && Number(v) > 0)) {
          cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: RED } };
        }
      });
      excelRow.height = 22;
    });

    const footRow = 16 + inventory.length + 1;
    cover.mergeCells(footRow, 2, footRow, 7);
    paintCell(cover.getCell(footRow, 2), {
      font: { italic: true, size: 10, color: { argb: MUTED } },
    });
    cover.getCell(footRow, 2).value = "YAAVS · Trade & Activaciones BTL";

    // ——— Reportes ———
    const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
    const keys = FIELD_ORDER.map(([key]) => key);
    const colCount = headers.length;

    const sheet = workbook.addWorksheet("Reportes", {
      properties: { tabColor: { argb: NAVY } },
      views: [{ state: "frozen", ySplit: 3, xSplit: 2, showGridLines: false }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });

    sheet.columns = [
      { key: "_n", width: 5 },
      ...FIELD_ORDER.map(([key]) => ({
        key,
        width: COLUMN_WIDTHS[key] || 20,
      })),
    ];

    const titleRow = sheet.addRow([
      "YAAVS  ·  Reporte BTL",
      ...Array(colCount - 1).fill(""),
    ]);
    titleRow.height = 32;
    sheet.mergeCells(1, 1, 1, colCount);
    paintCell(titleRow.getCell(1), {
      fill: NAVY,
      font: { bold: true, color: { argb: WHITE }, size: 14 },
      align: { horizontal: "left", indent: 1 },
    });
    for (let c = 2; c <= colCount; c += 1) {
      paintCell(titleRow.getCell(c), { fill: NAVY });
    }

    const subRow = sheet.addRow([
      `${list.length} reporte${list.length === 1 ? "" : "s"}  ·  Generado ${generatedAt}`,
      ...Array(colCount - 1).fill(""),
    ]);
    subRow.height = 22;
    sheet.mergeCells(2, 1, 2, colCount);
    paintCell(subRow.getCell(1), {
      fill: TEAL,
      font: { bold: true, color: { argb: WHITE }, size: 11 },
      align: { horizontal: "left", indent: 1 },
    });
    for (let c = 2; c <= colCount; c += 1) {
      paintCell(subRow.getCell(c), { fill: TEAL });
    }

    const headerRow = sheet.addRow(headers);
    styleHeaderRow(headerRow, NAVY_DEEP);

    list.forEach((row, idx) => {
      const values = [
        idx + 1,
        ...keys.map((k) => {
          if (k === "receivedAt") return formatDateMx(row.receivedAt || row.timestamp);
          if (NUM_KEYS.has(k)) {
            const n = Number(row[k]);
            return Number.isFinite(n) ? n : "";
          }
          const v = row[k];
          return v == null || String(v).trim() === "" ? "" : String(v).trim();
        }),
      ];
      const excelRow = sheet.addRow(values);
      const longText =
        String(row.comerciales || "").length > 70 ||
        String(row.materiales || "").length > 70 ||
        String(row.observaciones || "").length > 70 ||
        String(row.incidencias || "").length > 70;
      excelRow.height = longText ? 42 : 24;
      const alt = idx % 2 === 1;

      excelRow.eachCell((cell, colNumber) => {
        const key = colNumber === 1 ? "_n" : keys[colNumber - 2];
        paintCell(cell, {
          fill: alt ? ALT : WHITE,
          font: { size: 11, color: { argb: INK } },
          align: {
            horizontal: colNumber === 1 || CENTER_KEYS.has(key) ? "center" : "left",
            wrapText: true,
          },
          border: LINE,
        });

        if (colNumber === 1) {
          paintCell(cell, {
            fill: TEAL_SOFT,
            font: { bold: true, size: 11, color: { argb: NAVY } },
            align: { horizontal: "center", wrapText: true },
            border: LINE,
          });
        }

        if (colNumber === 2) {
          cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: TEAL } };
        }

        if (key === "hayIncidencia") {
          const v = String(cell.value || "")
            .trim()
            .toLowerCase();
          if (v === "sí" || v === "si") {
            paintCell(cell, {
              fill: "FFFCE8EC",
              font: { bold: true, size: 11, color: { argb: RED } },
              align: { horizontal: "center", wrapText: true },
              border: LINE,
            });
          } else if (v === "no") {
            paintCell(cell, {
              fill: "FFE8F5F0",
              font: { bold: true, size: 11, color: { argb: GREEN } },
              align: { horizontal: "center", wrapText: true },
              border: LINE,
            });
          }
        }
      });
    });

    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: Math.max(3, list.length + 3), column: colCount },
    };

    // ——— Inventario ———
    const inv = workbook.addWorksheet("Inventario", {
      properties: { tabColor: { argb: GOLD } },
      views: [{ showGridLines: false }],
    });
    inv.columns = [
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ];

    const invTitle = inv.addRow(["Inventario Trade · Material promocional por producto"]);
    inv.mergeCells(1, 1, 1, 7);
    invTitle.height = 32;
    paintCell(invTitle.getCell(1), {
      fill: NAVY,
      font: { bold: true, size: 14, color: { argb: WHITE } },
      align: { horizontal: "left", indent: 1 },
    });
    for (let c = 2; c <= 7; c += 1) {
      paintCell(invTitle.getCell(c), { fill: NAVY });
    }

    const invSub = inv.addRow([`Generado ${generatedAt}`, "", "", "", "", "", ""]);
    inv.mergeCells(2, 1, 2, 7);
    paintCell(invSub.getCell(1), {
      fill: TEAL_SOFT,
      font: { size: 11, color: { argb: MUTED }, italic: true },
      align: { indent: 1 },
    });
    for (let c = 2; c <= 7; c += 1) {
      paintCell(invSub.getCell(c), { fill: TEAL_SOFT });
    }

    inv.addRow([]);
    const invCols = [
      "Producto",
      "Entregada",
      "Utilizada",
      "Devuelta",
      "Saldo",
      "Merma",
      "Reportes",
    ];
    const invHead = inv.addRow(invCols);
    styleHeaderRow(invHead, NAVY_DEEP);

    const totals = {
      entregada: 0,
      utilizada: 0,
      devuelta: 0,
      saldo: 0,
      mermaSi: 0,
      reportes: 0,
    };

    inventory.forEach((row, idx) => {
      const excelRow = inv.addRow([
        row.material,
        row.entregada,
        row.utilizada,
        row.devuelta,
        row.saldo,
        row.mermaSi,
        row.reportes,
      ]);
      excelRow.height = 24;
      excelRow.eachCell((cell, colNumber) => {
        paintCell(cell, {
          fill: idx % 2 === 1 ? ALT : WHITE,
          font: {
            size: 11,
            color: { argb: INK },
            bold: colNumber === 1,
          },
          align: { horizontal: colNumber === 1 ? "left" : "center" },
          border: LINE,
        });
        if (colNumber === 5 && Number(cell.value) < 0) {
          cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: RED } };
        }
        if (colNumber === 6 && Number(cell.value) > 0) {
          cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: RED } };
        }
      });
      totals.entregada += row.entregada;
      totals.utilizada += row.utilizada;
      totals.devuelta += row.devuelta;
      totals.saldo += row.saldo;
      totals.mermaSi += row.mermaSi;
      totals.reportes += row.reportes;
    });

    const totalRow = inv.addRow([
      "TOTAL",
      totals.entregada,
      totals.utilizada,
      totals.devuelta,
      totals.saldo,
      totals.mermaSi,
      totals.reportes,
    ]);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      paintCell(cell, {
        fill: GOLD,
        font: {
          bold: true,
          size: 11,
          color: { argb: NAVY_DEEP },
        },
        align: { horizontal: colNumber === 1 ? "left" : "center" },
        border: GOLD,
      });
      if (colNumber === 5 && Number(cell.value) < 0) {
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: RED } };
      }
      if (colNumber === 6 && Number(cell.value) > 0) {
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: RED } };
      }
    });

    // ——— Resumen ———
    const summary = workbook.addWorksheet("Resumen", {
      properties: { tabColor: { argb: TEAL } },
      views: [{ showGridLines: false }],
    });
    summary.columns = [
      { key: "a", width: 42 },
      { key: "b", width: 18 },
      { key: "c", width: 12 },
      { key: "d", width: 14 },
    ];

    const sTitle = summary.addRow(["YAAVS  ·  Resumen operativo", "", "", ""]);
    summary.mergeCells(1, 1, 1, 4);
    sTitle.height = 32;
    paintCell(sTitle.getCell(1), {
      fill: NAVY,
      font: { bold: true, size: 14, color: { argb: WHITE } },
      align: { indent: 1 },
    });
    for (let c = 2; c <= 4; c += 1) {
      paintCell(sTitle.getCell(c), { fill: NAVY });
    }

    summary.addRow([]);
    const meta1 = summary.addRow(["Total de reportes", list.length, "", ""]);
    paintCell(meta1.getCell(1), {
      font: { bold: true, color: { argb: INK } },
    });
    paintCell(meta1.getCell(2), {
      font: { bold: true, size: 14, color: { argb: TEAL } },
      align: { horizontal: "center" },
    });
    summary.addRow(["Generado", generatedAt, "", ""]);

    summary.addRow([]);
    const hInd = summary.addRow(["Indicadores operativos", "Valor", "", ""]);
    hInd.eachCell((c, i) => {
      if (i > 2) return;
      paintCell(c, {
        fill: TEAL,
        font: { bold: true, color: { argb: WHITE } },
        align: { horizontal: i === 2 ? "center" : "left" },
        border: TEAL,
      });
    });

    [
      ["Suma interesados", sumKey(list, "abordados")],
      ["Suma prospectos", sumKey(list, "prospectos")],
      ["Suma ventas", sumKey(list, "ventas")],
      ["Suma dinámicas", sumKey(list, "dinamicas")],
      ["Suma participantes", sumKey(list, "participantes")],
      ["Suma promocionales", sumKey(list, "promocionales")],
      ["Reportes con incidencia", incidenciasCount],
    ].forEach(([label, value], i) => {
      const row = summary.addRow([label, value, "", ""]);
      paintCell(row.getCell(1), {
        fill: i % 2 === 1 ? ALT : WHITE,
        font: { color: { argb: INK } },
        border: LINE,
      });
      paintCell(row.getCell(2), {
        fill: i % 2 === 1 ? ALT : WHITE,
        font: { bold: true, color: { argb: NAVY } },
        align: { horizontal: "center" },
        border: LINE,
      });
    });

    const distBlock = (title, key) => {
      summary.addRow([]);
      const head = summary.addRow([title, "Cantidad", "%", ""]);
      head.eachCell((c, i) => {
        if (i > 3) return;
        paintCell(c, {
          fill: NAVY,
          font: { bold: true, color: { argb: WHITE } },
          align: { horizontal: i === 1 ? "left" : "center" },
          border: NAVY,
        });
      });
      const map = new Map();
      list.forEach((r) => {
        const v = String(r[key] || "").trim();
        if (!v) return;
        map.set(v, (map.get(v) || 0) + 1);
      });
      const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
      [...map.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
        .forEach(([label, count], i) => {
          const row = summary.addRow([
            label,
            count,
            Math.round((count / total) * 100),
            "",
          ]);
          [1, 2, 3].forEach((col) => {
            paintCell(row.getCell(col), {
              fill: i % 2 === 1 ? ALT : WHITE,
              font: { color: { argb: INK } },
              align: { horizontal: col === 1 ? "left" : "center" },
              border: LINE,
            });
          });
        });
      if (!map.size) {
        const empty = summary.addRow(["Sin datos", 0, 0, ""]);
        [1, 2, 3].forEach((col) => {
          paintCell(empty.getCell(col), {
            fill: WHITE,
            font: { color: { argb: MUTED }, italic: true },
            align: { horizontal: col === 1 ? "left" : "center" },
            border: LINE,
          });
        });
      }
    };

    distBlock("Distribución · ¿Hay incidencia?", "hayIncidencia");
    distBlock("Distribución · Punto de venta", "puntoDeVenta");
    distBlock("Distribución · Responsable", "responsable");

    summary.addRow([]);
    const foot = summary.addRow(["YAAVS · Reporte BTL", "", "", ""]);
    paintCell(foot.getCell(1), {
      font: { italic: true, size: 10, color: { argb: MUTED } },
    });

    return workbook;
  };
};
