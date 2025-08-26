const express = require("express");
const pool = require("../../config/db");
const router = express.Router();

const PdfPrinter = require("pdfmake");
const fs = require("fs");
const path = require("path");

const ExcelJS = require("exceljs");

// GET: Listado de estudiantes por gestión, sucursal y curso
router.get("/", async (req, res) => {
  const { gestion, sucursal, curso, page = 1, pageSize = 10 } = req.query;

  if (!gestion || !sucursal || !curso) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const offset = (page - 1) * pageSize;

  try {
    // Total de resultados
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM inscripciones i
       JOIN estudiantes e ON e.id = i.estudiante_id
       WHERE i.gestion = $1 AND i.sucursal = $2 AND i.curso = $3`,
      [gestion, sucursal, curso]
    );

    const total = parseInt(totalResult.rows[0].total);

    // Resultados paginados
    const result = await pool.query(
      `SELECT 
         e.cod_est,
         e.carnet_identidad,
         e.apellidop,
         e.apellidom,
         e.nombre
       FROM inscripciones i
       JOIN estudiantes e ON e.id = i.estudiante_id
       WHERE i.gestion = $1 AND i.sucursal = $2 AND i.curso = $3
       ORDER BY e.apellidop
       LIMIT $4 OFFSET $5`,
      [gestion, sucursal, curso, pageSize, offset]
    );

    res.json({
      total,
      estudiantes: result.rows,
    });
  } catch (error) {
    console.error("❌ Error obteniendo estudiantes:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

const fonts = {
  Roboto: {
    normal: path.join(__dirname, "../../fonts/Roboto-Regular.ttf"),
    bold: path.join(__dirname, "../../fonts/Roboto-Bold.ttf"),
    italics: path.join(__dirname, "../../fonts/Roboto-Italic.ttf"),
    bolditalics: path.join(__dirname, "../../fonts/Roboto-BoldItalic.ttf"),
  },
};

const printer = new PdfPrinter(fonts);

router.get("/pdf", async (req, res) => {
  const { gestion, sucursal, curso } = req.query;

  if (!gestion || !sucursal || !curso) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  try {
    const cursosPrimaria = [
      "Maternal",
      "Inicial I",
      "Inicial II",
      "Primero",
      "Segundo",
      "Tercero",
      "Cuarto",
      "Quinto",
      "Sexto",
    ];

    const cursosSecundaria = [
      "Primero",
      "Segundo",
      "Tercero",
      "Cuarto",
      "Quinto",
      "Sexto",
    ];

    const cursos =
      curso === "TODOS"
        ? sucursal === "Primaria"
          ? cursosPrimaria
          : cursosSecundaria
        : [curso];

    const estudiantesPorCurso = {};

    for (const c of cursos) {
      const result = await pool.query(
        `SELECT e.cod_est, e.carnet_identidad, e.apellidop, e.apellidom, e.nombre
         FROM inscripciones i
         JOIN estudiantes e ON e.id = i.estudiante_id
         WHERE i.gestion = $1 AND i.sucursal = $2 AND i.curso = $3
         ORDER BY e.apellidop`,
        [gestion, sucursal, c]
      );
      estudiantesPorCurso[c] = result.rows;
    }

    const content = [
      {
        text: "REPORTE DE ESTUDIANTES",
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 15],
      },
      {
        text: `Gestión: ${gestion}   |   Sucursal: ${sucursal}`,
        style: "subheader",
        alignment: "center",
        margin: [0, 0, 0, 15],
      },
    ];

    for (const [cursoActual, estudiantes] of Object.entries(
      estudiantesPorCurso
    )) {
      content.push({
        text: `Curso: ${cursoActual}`,
        style: "subheader",
        alignment: "center",
        margin: [0, 10, 0, 5],
      });

      const tableBody = [
        [
          { text: "#", style: "tableHeader" },
          { text: "Código", style: "tableHeader" },
          { text: "CI", style: "tableHeader" },
          { text: "Apellido Paterno", style: "tableHeader" },
          { text: "Apellido Materno", style: "tableHeader" },
          { text: "Nombre", style: "tableHeader" },
        ],
        ...estudiantes.map((est, index) => [
          { text: index + 1, alignment: "center" },
          { text: est.cod_est, alignment: "center" },
          { text: est.carnet_identidad, alignment: "center" },
          { text: est.apellidop, alignment: "center" },
          { text: est.apellidom, alignment: "center" },
          { text: est.nombre, alignment: "center" },
        ]),
      ];

      content.push({
        table: {
          widths: [25, "*", "*", "*", "*", "*"],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? "#2563EB" : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#cbd5e0",
          vLineColor: () => "#cbd5e0",
        },
        margin: [0, 0, 0, 20],
      });
    }

    const docDefinition = {
      content,
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: "#1e3a8a",
        },
        subheader: {
          fontSize: 13,
          bold: true,
        },
        tableHeader: {
          bold: true,
          fontSize: 11,
          color: "#ffffff",
          alignment: "center",
        },
      },
      defaultStyle: {
        font: "Roboto",
      },
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [40, 60, 40, 60],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-estudiantes-${gestion}-${sucursal}.pdf`
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("❌ Error generando PDF:", error);
    res.status(500).json({ error: "Error al generar el PDF" });
  }
});

router.get("/excel", async (req, res) => {
  const { gestion, sucursal, curso } = req.query;

  if (!gestion || !sucursal || !curso) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  try {
    const cursosPrimaria = [
      "Maternal",
      "Inicial I",
      "Inicial II",
      "Primero",
      "Segundo",
      "Tercero",
      "Cuarto",
      "Quinto",
      "Sexto",
    ];

    const cursosSecundaria = [
      "Primero",
      "Segundo",
      "Tercero",
      "Cuarto",
      "Quinto",
      "Sexto",
    ];

    const cursos =
      curso === "TODOS"
        ? sucursal === "Primaria"
          ? cursosPrimaria
          : cursosSecundaria
        : [curso];

    const workbook = new ExcelJS.Workbook();

    for (const c of cursos) {
      const result = await pool.query(
        `SELECT e.cod_est, e.carnet_identidad, e.apellidop, e.apellidom, e.nombre
         FROM inscripciones i
         JOIN estudiantes e ON e.id = i.estudiante_id
         WHERE i.gestion = $1 AND i.sucursal = $2 AND i.curso = $3
         ORDER BY e.apellidop`,
        [gestion, sucursal, c]
      );

      const estudiantes = result.rows;
      const wsName = c.length > 31 ? c.substring(0, 31) : c;
      const sheet = workbook.addWorksheet(wsName);

      // Título
      sheet.mergeCells("A1:F1");
      sheet.getCell("A1").value = "REPORTE DE ESTUDIANTES";
      sheet.getCell("A1").font = {
        size: 16,
        bold: true,
        color: { argb: "1e3a8a" },
      };
      sheet.getCell("A1").alignment = { horizontal: "center" };

      // Subtítulo
      sheet.mergeCells("A2:F2");
      sheet.getCell(
        "A2"
      ).value = `Gestión: ${gestion}   |   Sucursal: ${sucursal}   |   Curso: ${c}`;
      sheet.getCell("A2").font = { italic: true, bold: true };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      // Encabezado
      const headerRow = sheet.addRow([
        "#",
        "Código",
        "CI",
        "Apellido Paterno",
        "Apellido Materno",
        "Nombre",
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { horizontal: "center" };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "2563EB" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Datos
      estudiantes.forEach((est, index) => {
        const row = sheet.addRow([
          index + 1,
          est.cod_est,
          est.carnet_identidad,
          est.apellidop,
          est.apellidom,
          est.nombre,
        ]);
        row.alignment = { horizontal: "center" };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Ancho columnas
      sheet.columns.forEach((col) => (col.width = 20));

      // Footer
      sheet.addRow([]);
      sheet.mergeCells(
        `A${sheet.lastRow.number + 1}:F${sheet.lastRow.number + 1}`
      );
      const fechaCell = sheet.getCell(`A${sheet.lastRow.number}`);
      fechaCell.value = `Generado el ${new Date().toLocaleDateString()}`;
      fechaCell.font = { italic: true, size: 10, color: { argb: "888888" } };
      fechaCell.alignment = { horizontal: "center" };
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-estudiantes-${gestion}-${sucursal}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Error generando Excel:", error);
    res.status(500).json({ error: "Error al generar el Excel" });
  }
});

module.exports = router;
