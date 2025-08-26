const express = require("express");
const pool = require("../../config/db");
const router = express.Router();

const PdfPrinter = require("pdfmake");
const fs = require("fs");
const path = require("path");

const ExcelJS = require("exceljs");

router.get("/pdf", async (req, res) => {
  const { gestion, sucursal } = req.query;
  if (!gestion || !sucursal)
    return res.status(400).json({ error: "Filtros faltantes" });

  const query = `
    SELECT 
      p.id, p.apellidop,
      CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
      p.ci,
      c.sueldo_mensual,
      c.fecha_inicio,
      c.fecha_fin,
      h.hora_inicio,
      h.hora_fin,
      h.dia_semana AS dia,
      m.nombre AS materia,
      cu.nombre AS curso
    FROM contratos c
    JOIN personal p ON p.id = c.id_personal
    JOIN historial_roles hr ON hr.id = c.id_historial_rol
    JOIN horarios_profesor h ON h.id_contrato = c.id
    JOIN materias m ON m.id = h.id_materia
    JOIN cursos cu ON cu.id = h.id_curso
    WHERE c.gestion = $1
      AND LOWER(c.sucursal) = LOWER($2)
      AND LOWER(hr.tipo_personal) = 'profesor'
    ORDER BY p.apellidop, c.fecha_inicio, h.hora_inicio
  `;

  try {
    const result = await pool.query(query, [gestion, sucursal]);

    const profesores = {};
    const materiaColores = {};
    const materiaColorPool = [
      "#FFCDD2",
      "#C8E6C9",
      "#BBDEFB",
      "#FFF9C4",
      "#D1C4E9",
      "#FFECB3",
    ];
    let materiaIdx = 0;

    result.rows.forEach((r) => {
      if (!profesores[r.id]) {
        profesores[r.id] = {
          apellidop: r.apellidop,
          nombre_completo: r.nombre_completo,
          ci: r.ci,
          contratos: [],
        };
      }
      let contrato = profesores[r.id].contratos.find(
        (c) =>
          +c.fecha_inicio === +r.fecha_inicio && +c.fecha_fin === +r.fecha_fin
      );
      if (!contrato) {
        contrato = {
          fecha_inicio: r.fecha_inicio,
          fecha_fin: r.fecha_fin,
          sueldo: r.sueldo_mensual,
          horarios: [],
        };
        profesores[r.id].contratos.push(contrato);
      }
      contrato.horarios.push(r);
      if (!materiaColores[r.materia]) {
        materiaColores[r.materia] =
          materiaColorPool[materiaIdx++ % materiaColorPool.length];
      }
    });

    // Ordenar profesores por apellido paterno
    const ordenados = Object.values(profesores).sort((a, b) =>
      a.apellidop.localeCompare(b.apellidop)
    );

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
        text: `HORARIO DE PROFESORES - Gestión ${gestion} - Sucursal ${sucursal}`,
        style: "header",
        margin: [0, 0, 0, 10],
      },
    ];

    ordenados.forEach((prof) => {
      content.push({
        text: `${prof.nombre_completo} – CI: ${prof.ci}`,
        style: "subheader",
        margin: [0, 10, 0, 5],
      });
      prof.contratos.forEach((c) => {
        content.push({
          text: `Contrato: ${formatFecha(c.fecha_inicio)} al ${formatFecha(
            c.fecha_fin
          )} – Sueldo: ${c.sueldo}`,
          style: "small",
          margin: [0, 0, 0, 5],
        });
        content.push({
          table: {
            widths: [60, "*", "*", "*", "*", "*", "*"],
            body: buildHorarioTable(c.horarios, materiaColores),
          },
          layout: {
            fillColor: (rowIdx, node, colIdx) => {
              if (rowIdx === 0 || colIdx === 0) return null;
              const mat = node.table.body[rowIdx][colIdx].materia || "";
              return materiaColores[mat] || null;
            },
            hLineWidth: () => 1,
            vLineWidth: () => 1,
          },
          margin: [0, 0, 0, 10],
        });
      });
    });

    const docDefinition = {
      pageOrientation: "landscape",
      content,
      styles: {
        header: { fontSize: 14, bold: true, alignment: "center" },
        subheader: {
          fontSize: 12,
          bold: true,
          color: "#1976D2",
          alignment: "center",
        },
        small: { fontSize: 10, alignment: "center" },
      },
      defaultStyle: {
        font: "Roboto",
        alignment: "center",
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=horario-profesores-${gestion}-${sucursal}.pdf`
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("❌ Error generando PDF:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }

  function buildHorarioTable(hs, materiaColores) {
    const dias = [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    const horas = Array.from(
      new Set(hs.map((h) => `${h.hora_inicio}-${h.hora_fin}`))
    ).sort();

    const body = [
      [
        { text: "Hora", bold: true },
        ...dias.map((d) => ({
          text: d.charAt(0).toUpperCase() + d.slice(1),
          bold: true,
        })),
      ],
    ];

    horas.forEach((hora) => {
      const [start, end] = hora.split("-");
      const row = [{ text: `${start} / ${end}` }];
      dias.forEach((d) => {
        const rec = hs.find(
          (x) => x.dia === d && `${x.hora_inicio}-${x.hora_fin}` === hora
        );
        if (rec) {
          row.push({
            stack: [
              { text: rec.materia, bold: true, color: "black" },
              { text: rec.curso, color: "black" },
            ],
            materia: rec.materia,
          });
        } else {
          row.push({ text: "", materia: "" });
        }
      });
      body.push(row);
    });
    return body;
  }

  function formatFecha(fecha) {
    const d = new Date(fecha);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  }
});

//EXCEL
router.get("/excel", async (req, res) => {
  const { gestion, sucursal } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const query = `
    SELECT 
      p.id,
      p.apellidop,
      p.apellidom,
      p.nombres,
      CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
      p.ci,
      c.sueldo_mensual,
      c.fecha_inicio,
      c.fecha_fin,
      h.hora_inicio,
      h.hora_fin,
      h.dia_semana,
      m.nombre AS materia,
      cu.nombre AS curso
    FROM contratos c
    JOIN personal p ON p.id = c.id_personal
    JOIN historial_roles hr ON hr.id = c.id_historial_rol
    JOIN horarios_profesor h ON h.id_contrato = c.id
    JOIN materias m ON m.id = h.id_materia
    JOIN cursos cu ON cu.id = h.id_curso
    WHERE c.gestion = $1
      AND LOWER(c.sucursal) = LOWER($2)
      AND LOWER(hr.tipo_personal) = 'profesor'
    ORDER BY p.apellidop, p.apellidom, p.nombres, c.fecha_inicio, h.hora_inicio
  `;

  try {
    const result = await pool.query(query, [gestion, sucursal]);

    // Organizar por profesor -> contratos
    const profesores = {};
    result.rows.forEach((row) => {
      if (!profesores[row.id]) {
        profesores[row.id] = {
          nombre_completo: row.nombre_completo,
          ci: row.ci,
          apellidop: row.apellidop,
          contratos: [],
        };
      }
      let contrato = profesores[row.id].contratos.find(
        (c) =>
          c.fecha_inicio.toISOString() === row.fecha_inicio.toISOString() &&
          c.fecha_fin.toISOString() === row.fecha_fin.toISOString()
      );
      if (!contrato) {
        contrato = {
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
          sueldo: row.sueldo_mensual,
          horarios: [],
        };
        profesores[row.id].contratos.push(contrato);
      }
      contrato.horarios.push(row);
    });

    // Ordenar profesores por apellido paterno
    const ordenados = Object.values(profesores).sort((a, b) =>
      a.apellidop.localeCompare(b.apellidop)
    );

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Horarios Profesores");

    ws.mergeCells("A1:H1");
    ws.getCell(
      "A1"
    ).value = `HORARIO DE PROFESORES - Gestión ${gestion} - Sucursal ${sucursal}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { horizontal: "center" };

    let rowIdx = 3;

    const materiaColores = {};
    const materiaColorPool = [
      "FFEF5350",
      "FF42A5F5",
      "FF66BB6A",
      "FFFFA726",
      "FFAB47BC",
    ];
    let colorIndex = 0;

    ordenados.forEach((prof) => {
      ws.getCell(
        `A${rowIdx}`
      ).value = `${prof.nombre_completo} - CI: ${prof.ci}`;
      ws.getCell(`A${rowIdx}`).font = {
        bold: true,
        color: { argb: "FF2563EB" },
      };
      rowIdx++;

      prof.contratos.forEach((contrato) => {
        ws.getCell(`A${rowIdx}`).value = `Contrato: ${formatFecha(
          contrato.fecha_inicio
        )} al ${formatFecha(contrato.fecha_fin)} - Sueldo: ${contrato.sueldo}`;
        ws.getCell(`A${rowIdx}`).font = { italic: true };
        rowIdx++;

        ws.getRow(rowIdx).values = [
          "Hora inicio / fin",
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
        ];
        ws.getRow(rowIdx).eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" },
          };
          cell.alignment = { horizontal: "center" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
        rowIdx++;

        const horasUnicas = [
          ...new Set(
            contrato.horarios.map((h) => `${h.hora_inicio}-${h.hora_fin}`)
          ),
        ].sort();

        horasUnicas.forEach((hora) => {
          const [inicio, fin] = hora.split("-");
          const row = [`${inicio} / ${fin}`];

          const cells = [];

          [
            "lunes",
            "martes",
            "miércoles",
            "jueves",
            "viernes",
            "sábado",
          ].forEach((dia) => {
            const h = contrato.horarios.find(
              (x) =>
                x.dia_semana === dia &&
                x.hora_inicio === inicio &&
                x.hora_fin === fin
            );
            if (h) {
              if (!materiaColores[h.materia]) {
                materiaColores[h.materia] =
                  materiaColorPool[colorIndex++ % materiaColorPool.length];
              }
              cells.push({
                text: `${h.materia}\n${h.curso}`,
                color: materiaColores[h.materia],
              });
            } else {
              cells.push(null);
            }
          });

          const excelRow = ws.getRow(rowIdx);
          excelRow.values = [row[0], ...cells.map((c) => (c ? c.text : ""))];
          excelRow.eachCell((cell, colNumber) => {
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
            if (colNumber > 1 && cells[colNumber - 2]) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: cells[colNumber - 2].color },
              };
            }
          });

          rowIdx++;
        });

        rowIdx++;
      });

      rowIdx++;
    });

    ws.columns.forEach((col) => (col.width = 20));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=horario-profesores-${gestion}-${sucursal}.xlsx`
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
