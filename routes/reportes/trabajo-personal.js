const express = require("express");
const pool = require("../../config/db");
const router = express.Router();

const PdfPrinter = require("pdfmake");
const fs = require("fs");
const path = require("path");

router.get("/", async (req, res) => {
  const { gestion, sucursal, rol, page = 1, pageSize = 5 } = req.query;
  const currentYear = new Date().getFullYear();
  if (parseInt(gestion) !== currentYear) {
    return res
      .status(400)
      .json({ error: "Gestión no permitida para este reporte" });
  }
  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const gestionActual = parseInt(gestion);
  const gestionPasada = gestionActual - 1;
  const offset = (page - 1) * pageSize;

  try {
    let queryBase = `
      SELECT DISTINCT p.id, 
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
    `;

    const values = [gestionPasada];
    let idx = 2;

    if (sucursal.toLowerCase() !== "todos") {
      queryBase += ` AND LOWER(c.sucursal) = LOWER($${idx})`;
      values.push(sucursal);
      idx++;
    }

    if (rol.toLowerCase() !== "todos") {
      queryBase += ` AND LOWER(hr.tipo_personal) = LOWER($${idx})`;
      values.push(rol);
      idx++;
    }

    const contratosPasados = await pool.query(queryBase, values);

    const personalMap = new Map();

    for (const row of contratosPasados.rows) {
      const verifica = await pool.query(
        `SELECT 1 FROM contratos WHERE id_personal = $1 AND gestion = $2 LIMIT 1`,
        [row.id, gestionActual]
      );

      if (verifica.rowCount === 0) {
        if (!personalMap.has(row.id)) {
          personalMap.set(row.id, {
            id: row.id,
            nombre_completo: row.nombre_completo,
            ci: row.ci,
            contratos: [],
          });
        }
        personalMap.get(row.id).contratos.push({
          rol: row.rol,
          sucursal: row.sucursal,
          sueldo: row.sueldo_mensual,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
        });
      }
    }

    const personalArray = Array.from(personalMap.values());
    const total = personalArray.length;

    // Paginar el resultado final
    const paginado = personalArray.slice(offset, offset + parseInt(pageSize));

    res.json({
      total,
      personal: paginado,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//PDF
router.get("/pdf", async (req, res) => {
  const { gestion, sucursal, rol } = req.query;
  const currentYear = new Date().getFullYear();
  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }
  if (parseInt(gestion) !== currentYear) {
    return res
      .status(400)
      .json({ error: "Gestión no permitida para este reporte" });
  }

  const gestionActual = parseInt(gestion);
  const gestionPasada = gestionActual - 1;

  try {
    let query = `
      SELECT DISTINCT p.id, 
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
    `;

    const values = [gestionPasada];
    let idx = 2;

    if (sucursal.toLowerCase() !== "todos") {
      query += ` AND LOWER(c.sucursal) = LOWER($${idx})`;
      values.push(sucursal);
      idx++;
    }

    if (rol.toLowerCase() !== "todos") {
      query += ` AND LOWER(hr.tipo_personal) = LOWER($${idx})`;
      values.push(rol);
      idx++;
    }

    const contratosPasados = await pool.query(query, values);

    const personal = [];
    for (const row of contratosPasados.rows) {
      const verifica = await pool.query(
        `SELECT 1 FROM contratos WHERE id_personal = $1 AND gestion = $2 LIMIT 1`,
        [row.id, gestionActual]
      );
      if (verifica.rowCount === 0) {
        let existente = personal.find((p) => p.id === row.id);
        if (!existente) {
          existente = {
            id: row.id,
            nombre_completo: row.nombre_completo,
            ci: row.ci,
            contratos: [],
          };
          personal.push(existente);
        }
        existente.contratos.push({
          rol: row.rol,
          sucursal: row.sucursal,
          sueldo: row.sueldo_mensual,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
        });
      }
    }

    // Generar PDF
    const fonts = {
      Roboto: {
        normal: path.join(__dirname, "../../fonts/Roboto-Regular.ttf"),
        bold: path.join(__dirname, "../../fonts/Roboto-Bold.ttf"),
        italics: path.join(__dirname, "../../fonts/Roboto-Italic.ttf"),
        bolditalics: path.join(__dirname, "../../fonts/Roboto-BoldItalic.ttf"),
      },
    };
    const printer = new PdfPrinter(fonts);

    const content = [
      {
        text: `Personal sin contrato vigente - Gestión ${gestion}`,
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
    ];

    const body = [
      [
        { text: "#", style: "tableHeader" },
        { text: "Nombre Completo / CI", style: "tableHeader" },
        { text: "Rol", style: "tableHeader" },
        { text: "Sucursal", style: "tableHeader" },
        { text: "Sueldo", style: "tableHeader" },
        { text: "Fecha Inicio / Fin", style: "tableHeader" },
      ],
    ];

    let contador = 1;
    personal.forEach((p) => {
      p.contratos.forEach((c, idx) => {
        body.push([
          idx === 0 ? contador++ : "",
          idx === 0 ? `${p.nombre_completo}\nCI: ${p.ci}` : "",
          c.rol,
          c.sucursal,
          c.sueldo,
          `${formatFecha(c.fecha_inicio)} al ${formatFecha(c.fecha_fin)}`,
        ]);
      });
    });

    const docDefinition = {
      content: [
        ...content,
        {
          table: {
            widths: [20, "*", "*", "*", "*", "*"],
            body,
          },
          layout: {
            fillColor: (rowIndex) => (rowIndex === 0 ? "#e2e8f0" : null),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#cbd5e0",
            vLineColor: () => "#cbd5e0",
          },
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true },
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

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=personal-sin-contrato-${gestion}.pdf`
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("❌ Error generando PDF:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }

  function formatFecha(f) {
    const d = new Date(f);
    return `${("0" + d.getDate()).slice(-2)}/${("0" + (d.getMonth() + 1)).slice(
      -2
    )}/${d.getFullYear()}`;
  }
});

//EXCEL
router.get("/excel", async (req, res) => {
  const { gestion, sucursal, rol } = req.query;
  const currentYear = new Date().getFullYear();
  if (parseInt(gestion) !== currentYear) {
    return res
      .status(400)
      .json({ error: "Gestión no permitida para este reporte" });
  }
  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const gestionActual = parseInt(gestion);
  const gestionPasada = gestionActual - 1;

  try {
    let query = `
      SELECT DISTINCT p.id, 
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
    `;

    const values = [gestionPasada];
    let idx = 2;

    if (sucursal.toLowerCase() !== "todos") {
      query += ` AND LOWER(c.sucursal) = LOWER($${idx})`;
      values.push(sucursal);
      idx++;
    }

    if (rol.toLowerCase() !== "todos") {
      query += ` AND LOWER(hr.tipo_personal) = LOWER($${idx})`;
      values.push(rol);
      idx++;
    }

    const contratosPasados = await pool.query(query, values);

    const personal = [];
    for (const row of contratosPasados.rows) {
      const verifica = await pool.query(
        `SELECT 1 FROM contratos WHERE id_personal = $1 AND gestion = $2 LIMIT 1`,
        [row.id, gestionActual]
      );
      if (verifica.rowCount === 0) {
        let existente = personal.find((p) => p.id === row.id);
        if (!existente) {
          existente = {
            id: row.id,
            nombre_completo: row.nombre_completo,
            ci: row.ci,
            contratos: [],
          };
          personal.push(existente);
        }
        existente.contratos.push({
          rol: row.rol,
          sucursal: row.sucursal,
          sueldo: row.sueldo_mensual,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
        });
      }
    }

    // EXCEL
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Personal sin contrato");

    worksheet.mergeCells("A1:F1");
    worksheet.getCell(
      "A1"
    ).value = `Personal sin contrato vigente - Gestión ${gestion}`;
    worksheet.getCell("A1").font = { size: 14, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.addRow([]);

    worksheet.mergeCells("A3:F3");
    worksheet.getCell("A3").value = `Sucursal: ${sucursal} | Rol: ${rol}`;
    worksheet.getCell("A3").font = { italic: true, size: 12 };
    worksheet.getCell("A3").alignment = { horizontal: "center" };

    worksheet.addRow([]);

    const headerRow = worksheet.addRow([
      "#",
      "Nombre Completo / CI",
      "Rol",
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

    let contador = 1;
    personal.forEach((p) => {
      p.contratos.forEach((c, idx) => {
        const row = worksheet.addRow([
          idx === 0 ? contador++ : "",
          idx === 0 ? `${p.nombre_completo}\nCI: ${p.ci}` : "",
          c.rol,
          c.sucursal,
          c.sueldo,
          `${formatFecha(c.fecha_inicio)} al ${formatFecha(c.fecha_fin)}`,
        ]);
        row.eachCell((cell) => {
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
      });
    });

    worksheet.columns.forEach((col) => (col.width = 30));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=personal-sin-contrato-${gestion}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ Error generando Excel:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }

  function formatFecha(f) {
    const d = new Date(f);
    return `${("0" + d.getDate()).slice(-2)}/${("0" + (d.getMonth() + 1)).slice(
      -2
    )}/${d.getFullYear()}`;
  }
});

module.exports = router;
