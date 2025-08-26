const express = require("express");
const pool = require("../../config/db");
const router = express.Router();
const PdfPrinter = require("pdfmake");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

router.get("/pdf", async (req, res) => {
  const { gestion, sucursal } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const query = `
    SELECT 
      p.id,
      CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
      p.ci,
      hr.tipo_personal AS rol,
      c.sucursal,
      c.sueldo_mensual,
      c.tipo_contrato,
      t.nombre AS turno,
      t.hora_inicio,
      t.hora_fin,
      c.fecha_inicio,
      c.fecha_fin
    FROM contratos c
    JOIN personal p ON p.id = c.id_personal
    JOIN historial_roles hr ON hr.id = c.id_historial_rol
    LEFT JOIN turnos t ON t.id = c.id_turno
    WHERE c.gestion = $1
      AND LOWER(c.sucursal) = LOWER($2)
      AND LOWER(hr.tipo_personal) <> 'profesor'
    ORDER BY c.tipo_contrato, t.nombre, p.apellidop, p.apellidom
  `;

  try {
    const result = await pool.query(query, [gestion, sucursal]);

    // Agrupar datos
    const tiempo_completo = {};
    const medio_tiempo = {};

    result.rows.forEach((row) => {
      if (row.tipo_contrato === "tiempo_completo") {
        if (!tiempo_completo[row.ci])
          tiempo_completo[row.ci] = { info: row, contratos: [] };
        tiempo_completo[row.ci].contratos.push(row);
      } else if (row.tipo_contrato === "medio_tiempo") {
        if (!medio_tiempo[row.turno]) medio_tiempo[row.turno] = {};
        if (!medio_tiempo[row.turno][row.ci])
          medio_tiempo[row.turno][row.ci] = { info: row, contratos: [] };
        medio_tiempo[row.turno][row.ci].contratos.push(row);
      }
    });

    // PDF
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
        text: `LISTA DE PERSONAL POR TURNOS - Gestión ${gestion} - Sucursal ${sucursal}`,
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
    ];

    if (Object.keys(tiempo_completo).length > 0) {
      content.push({
        text: "Personal con Jornada Especial (Turnos/Horas no definidos)",
        style: "subheader",
      });
      content.push({
        table: {
          widths: [20, "*", "*", "*", "*", "*"],
          body: buildBody(tiempo_completo),
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      });
    }

    if (Object.keys(medio_tiempo).length > 0) {
      content.push({ text: "Personal con Jornada Clásica", style: "subheader" });
      for (const turno in medio_tiempo) {
        content.push({ text: `Turno: ${turno}`, style: "turno" });
        content.push({
          table: {
            widths: [20, "*", "*", "*", "*", "*"],
            body: buildBody(medio_tiempo[turno]),
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        });
      }
    }

    const docDefinition = {
      content,
      styles: {
        header: { fontSize: 14, bold: true },
        subheader: {
          fontSize: 12,
          bold: true,
          color: "#2563EB",
          margin: [0, 5, 0, 5],
        },
        turno: { fontSize: 11, bold: true, italics: true },
      },
      defaultStyle: { font: "Roboto" },
      pageSize: "A4",
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=personal-turnos-${gestion}-${sucursal}.pdf`
    );
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("❌ Error generando PDF:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }

  function buildBody(data) {
    const body = [["#", "Nombre / CI", "Rol", "Sucursal", "Sueldo", "Fechas"]];
    let contador = 1;
    for (const ci in data) {
      const { info, contratos } = data[ci];
      contratos.forEach((c, idx) => {
        body.push([
          idx === 0 ? contador++ : "",
          idx === 0 ? `${info.nombre_completo}\nCI: ${info.ci}` : "",
          c.rol,
          c.sucursal,
          c.sueldo_mensual,
          `${formatFecha(c.fecha_inicio)} al ${formatFecha(c.fecha_fin)}`,
        ]);
      });
    }
    return body;
  }

  function formatFecha(f) {
    const d = new Date(f);
    return `${("0" + d.getDate()).slice(-2)}/${("0" + (d.getMonth() + 1)).slice(
      -2
    )}/${d.getFullYear()}`;
  }
});

router.get("/excel", async (req, res) => {
  const { gestion, sucursal } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Faltan filtros requeridos" });
  }

  const query = `
    SELECT 
      p.id,
      CONCAT(p.apellidop, ' ', p.apellidom, ' ', p.nombres) AS nombre_completo,
      p.ci,
      hr.tipo_personal AS rol,
      c.sucursal,
      c.sueldo_mensual,
      c.tipo_contrato,
      t.nombre AS turno,
      t.hora_inicio,
      t.hora_fin,
      c.fecha_inicio,
      c.fecha_fin
    FROM contratos c
    JOIN personal p ON p.id = c.id_personal
    JOIN historial_roles hr ON hr.id = c.id_historial_rol
    LEFT JOIN turnos t ON t.id = c.id_turno
    WHERE c.gestion = $1
      AND LOWER(c.sucursal) = LOWER($2)
      AND LOWER(hr.tipo_personal) <> 'profesor'
    ORDER BY c.tipo_contrato, t.nombre, p.apellidop, p.apellidom
  `;

  try {
    const result = await pool.query(query, [gestion, sucursal]);

    const tiempo_completo = {};
    const medio_tiempo = {};

    result.rows.forEach((row) => {
      if (row.tipo_contrato === "tiempo_completo") {
        if (!tiempo_completo[row.ci])
          tiempo_completo[row.ci] = { info: row, contratos: [] };
        tiempo_completo[row.ci].contratos.push(row);
      } else if (row.tipo_contrato === "medio_tiempo") {
        if (!medio_tiempo[row.turno]) medio_tiempo[row.turno] = {};
        if (!medio_tiempo[row.turno][row.ci])
          medio_tiempo[row.turno][row.ci] = { info: row, contratos: [] };
        medio_tiempo[row.turno][row.ci].contratos.push(row);
      }
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Personal Turnos");

    ws.mergeCells("A1:F1");
    ws.getCell(
      "A1"
    ).value = `LISTA DE PERSONAL POR TURNOS - Gestión ${gestion} - Sucursal ${sucursal}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { horizontal: "center" };

    let rowIdx = 3;

    if (Object.keys(tiempo_completo).length > 0) {
      ws.getCell(`A${rowIdx++}`).value = "Personal con Jornada Especial (Turnos/Horas no definidos)";
      ws.getRow(rowIdx++).values = [
        "#",
        "Nombre / CI",
        "Rol",
        "Sucursal",
        "Sueldo",
        "Fechas",
      ];

      let contador = 1;
      for (const ci in tiempo_completo) {
        const { info, contratos } = tiempo_completo[ci];
        contratos.forEach((c, idx) => {
          ws.addRow([
            idx === 0 ? contador++ : "",
            idx === 0 ? `${info.nombre_completo}\nCI: ${info.ci}` : "",
            c.rol,
            c.sucursal,
            c.sueldo_mensual,
            `${formatFecha(c.fecha_inicio)} / ${formatFecha(c.fecha_fin)}`,
          ]);
        });
      }
      rowIdx = ws.lastRow.number + 2;
    }

    if (Object.keys(medio_tiempo).length > 0) {
      ws.getCell(`A${rowIdx++}`).value = "Personal con Jornada Clásica";
      for (const turno in medio_tiempo) {
        ws.getCell(`A${rowIdx++}`).value = `Turno: ${turno}`;
        ws.getRow(rowIdx++).values = [
          "#",
          "Nombre / CI",
          "Rol",
          "Sucursal",
          "Sueldo",
          "Fechas",
        ];

        let contador = 1;
        for (const ci in medio_tiempo[turno]) {
          const { info, contratos } = medio_tiempo[turno][ci];
          contratos.forEach((c, idx) => {
            ws.addRow([
              idx === 0 ? contador++ : "",
              idx === 0 ? `${info.nombre_completo}\nCI: ${info.ci}` : "",
              c.rol,
              c.sucursal,
              c.sueldo_mensual,
              `${formatFecha(c.fecha_inicio)} / ${formatFecha(c.fecha_fin)}`,
            ]);
          });
        }
        rowIdx = ws.lastRow.number + 2;
      }
    }

    // Estilo columnas
    ws.columns.forEach((col) => {
      col.width = 25;
    });

    // Estilo filas y bordes
    ws.eachRow((row) => {
      row.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=personal-turnos-${gestion}-${sucursal}.xlsx`
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
