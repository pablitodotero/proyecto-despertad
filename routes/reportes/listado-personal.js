const express = require("express");
const pool = require("../../config/db");
const router = express.Router();

const PdfPrinter = require("pdfmake");
const fs = require("fs");
const path = require("path");

// VISTA PREVIA
router.get("/", async (req, res) => {
  const { gestion, sucursal, rol, page = 1, pageSize = 10 } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const roleFilter = rol && rol !== "Todos los roles" ? rol : null;

  try {
    const query = `
      SELECT 
        p.id,
        CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
        p.ci,
        c.id AS contrato_id,
        hr.tipo_personal AS rol,
        c.sucursal,
        c.sueldo_mensual,
        c.fecha_inicio,
        c.fecha_fin
      FROM contratos c
      JOIN personal p ON p.id = c.id_personal
      JOIN historial_roles hr ON hr.id = c.id_historial_rol
      WHERE c.gestion = $1
        AND LOWER(c.sucursal) = LOWER($2)
        ${roleFilter ? `AND LOWER(hr.tipo_personal) = LOWER($3)` : ""}
      ORDER BY p.apellidop, p.apellidom
    `;

    const values = roleFilter
      ? [gestion, sucursal, roleFilter]
      : [gestion, sucursal];

    const result = await pool.query(query, values);

    // Agrupar por personal
    const agrupado = {};
    result.rows.forEach((row) => {
      if (!agrupado[row.id]) {
        agrupado[row.id] = {
          nombre_completo: row.nombre_completo,
          ci: row.ci,
          contratos: [],
        };
      }
      agrupado[row.id].contratos.push({
        rol: row.rol,
        sucursal: row.sucursal,
        sueldo: row.sueldo_mensual,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
      });
    });

    const allPersonal = Object.values(agrupado);

    // Paginar en el backend
    const total = allPersonal.length;
    const start = (page - 1) * pageSize;
    const paginated = allPersonal.slice(start, start + Number(pageSize));

    res.json({
      total,
      personal: paginated,
    });
  } catch (error) {
    console.error("❌ Error generando vista previa personal:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//PDF
router.get("/pdf", async (req, res) => {
  const { gestion, sucursal, rol } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  try {
    let query = `
      SELECT 
        p.id,
        CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
        p.ci,
        hr.tipo_personal AS rol,
        c.sucursal,
        c.sueldo_mensual,
        c.fecha_inicio,
        c.fecha_fin
      FROM contratos c
      JOIN personal p ON p.id = c.id_personal
      JOIN historial_roles hr ON hr.id = c.id_historial_rol
      WHERE c.gestion = $1
        AND LOWER(c.sucursal) = LOWER($2)
    `;

    const values = [gestion, sucursal];

    if (rol.toLowerCase() !== "todos los roles") {
      query += ` AND LOWER(hr.tipo_personal) = LOWER($3)`;
      values.push(rol);
    }

    query += ` ORDER BY hr.tipo_personal, p.apellidop, p.apellidom`;

    const result = await pool.query(query, values);

    // Agrupar por rol
    const agrupado = {};
    result.rows.forEach((row) => {
      if (!agrupado[row.rol]) agrupado[row.rol] = [];
      agrupado[row.rol].push(row);
    });

    const content = [
      {
        text: `Reporte de Personal - Gestión ${gestion} - Sucursal ${sucursal}`,
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 20],
      },
    ];

    function formatFecha(fecha) {
      const d = new Date(fecha);
      return `${("0" + d.getDate()).slice(-2)}/${(
        "0" +
        (d.getMonth() + 1)
      ).slice(-2)}/${d.getFullYear()}`;
    }

    for (const rolKey of Object.keys(agrupado)) {
      content.push({
        text: `\n${rolKey}`,
        style: "subheader",
        margin: [0, 10, 0, 5],
      });

      const body = [
        [
          { text: "#", style: "tableHeader" },
          { text: "Nombre Completo / CI", style: "tableHeader" },
          { text: "Sucursal", style: "tableHeader" },
          { text: "Sueldo", style: "tableHeader" },
          { text: "Fecha Inicio / Fin", style: "tableHeader" },
        ],
      ];

      let prevCI = "";
      let contador = 1;
      agrupado[rolKey].forEach((row) => {
        body.push([
          row.ci !== prevCI ? contador++ : "",
          row.ci !== prevCI ? `${row.nombre_completo}\nCI: ${row.ci}` : "",
          row.sucursal,
          row.sueldo_mensual,
          `${formatFecha(row.fecha_inicio)} / ${formatFecha(row.fecha_fin)}`,
        ]);
        prevCI = row.ci;
      });

      content.push({
        table: {
          widths: [20, "*", "auto", "auto", "auto"],
          body,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? "#e2e8f0" : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#cbd5e0",
          vLineColor: () => "#cbd5e0",
        },
      });
    }

    const docDefinition = {
      content,
      styles: {
        header: { fontSize: 16, bold: true },
        subheader: { fontSize: 14, bold: true, color: "#1e3a8a" },
        tableHeader: {
          bold: true,
          fontSize: 11,
          color: "#1e3a8a",
          alignment: "center",
        },
      },
      defaultStyle: { font: "Roboto" },
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [40, 60, 40, 60],
    };

    const printer = new PdfPrinter({
      Roboto: {
        normal: path.join(__dirname, "../../fonts/Roboto-Regular.ttf"),
        bold: path.join(__dirname, "../../fonts/Roboto-Bold.ttf"),
        italics: path.join(__dirname, "../../fonts/Roboto-Italic.ttf"),
        bolditalics: path.join(__dirname, "../../fonts/Roboto-BoldItalic.ttf"),
      },
    });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-personal-${gestion}-${sucursal}.pdf`
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("❌ Error generando PDF:", error);
    res.status(500).json({ error: "Error al generar el PDF" });
  }
});

//EXCEL
router.get("/excel", async (req, res) => {
  const { gestion, sucursal, rol } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  try {
    let query = `
      SELECT 
        p.id,
        CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
        p.ci,
        hr.tipo_personal AS rol,
        c.sucursal,
        c.sueldo_mensual,
        c.fecha_inicio,
        c.fecha_fin
      FROM contratos c
      JOIN personal p ON p.id = c.id_personal
      JOIN historial_roles hr ON hr.id = c.id_historial_rol
      WHERE c.gestion = $1
        AND LOWER(c.sucursal) = LOWER($2)
    `;

    const values = [gestion, sucursal];

    if (rol.toLowerCase() !== "todos los roles") {
      query += ` AND LOWER(hr.tipo_personal) = LOWER($3)`;
      values.push(rol);
    }

    query += ` ORDER BY hr.tipo_personal, p.apellidop, p.apellidom`;

    const result = await pool.query(query, values);

    const agrupado = {};
    result.rows.forEach((row) => {
      if (!agrupado[row.rol]) agrupado[row.rol] = [];
      agrupado[row.rol].push(row);
    });

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte Personal");

    worksheet.mergeCells("A1:E1");
    worksheet.getCell(
      "A1"
    ).value = `REPORTE DE PERSONAL - Gestión ${gestion} - Sucursal ${sucursal}`;
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    let rowIndex = 3;

    function formatFecha(fecha) {
      const d = new Date(fecha);
      return `${("0" + d.getDate()).slice(-2)}/${(
        "0" +
        (d.getMonth() + 1)
      ).slice(-2)}/${d.getFullYear()}`;
    }

    for (const rolKey of Object.keys(agrupado)) {
      worksheet.getCell(`A${rowIndex}`).value = rolKey;
      worksheet.getCell(`A${rowIndex}`).font = {
        bold: true,
        color: { argb: "FF1E3A8A" },
      };
      rowIndex++;

      const headerRow = worksheet.addRow([
        "#",
        "Nombre Completo / CI",
        "Sucursal",
        "Sueldo",
        "Fecha Inicio / Fin",
      ]);

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      let prevCI = "";
      let contador = 1;
      agrupado[rolKey].forEach((row) => {
        const dataRow = worksheet.addRow([
          row.ci !== prevCI ? contador++ : "",
          row.ci !== prevCI ? `${row.nombre_completo}\nCI: ${row.ci}` : "",
          row.sucursal,
          row.sueldo_mensual,
          `${formatFecha(row.fecha_inicio)} / ${formatFecha(row.fecha_fin)}`,
        ]);
        dataRow.eachCell((cell) => {
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
        prevCI = row.ci;
      });

      rowIndex = worksheet.lastRow.number + 2;
    }

    worksheet.columns.forEach((col) => {
      col.width = 30;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-personal-${gestion}-${sucursal}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Error generando Excel:", error);
    res.status(500).json({ error: "Error al generar el Excel" });
  }
});

module.exports = router;
