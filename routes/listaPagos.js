const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//Lista de estudiantes
router.get("/", async (req, res) => {
  const { gestion, sucursal, curso, orden, busqueda } = req.query;

  let palabrasBusqueda = [];
  if (busqueda && busqueda.trim() !== "") {
    palabrasBusqueda = busqueda.trim().split(/\s+/);
  }

  let condicionesBusqueda = "";
  if (palabrasBusqueda.length > 0) {
    condicionesBusqueda = palabrasBusqueda
      .map(
        (_, idx) =>
          `(e.nombre || ' ' || e.apellidop || ' ' || e.apellidom || ' ' || e.carnet_identidad) ILIKE '%' || $${
            5 + idx
          } || '%'`
      )
      .join(" AND ");
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        e.id,
        e.cod_est,
        e.apellidop,
        e.apellidom,
        e.nombre,
        e.carnet_identidad,
        i.id AS inscripcion_id,

        COALESCE(tp.costo_matricula, t.costo_matricula) AS costo_matricula_total,
        COALESCE(tp.costo_mensualidad, t.costo_mensualidad) AS costo_mensualidad_total,

        CASE 
          WHEN tp.costo_matricula IS NOT NULL AND tp.costo_mensualidad IS NOT NULL 
          THEN true ELSE false 
        END AS tiene_tarifa_personalizada,

        mp.mensualidades_personalizadas,

        SUM(CASE WHEN p.concepto = 'Matrícula' THEN p.monto_pagado ELSE 0 END) AS pagado_matricula,
        SUM(CASE WHEN p.concepto = 'Enero' THEN p.monto_pagado ELSE 0 END) AS pagado_enero,
        SUM(CASE WHEN p.concepto = 'Febrero' THEN p.monto_pagado ELSE 0 END) AS pagado_febrero,
        SUM(CASE WHEN p.concepto = 'Marzo' THEN p.monto_pagado ELSE 0 END) AS pagado_marzo,
        SUM(CASE WHEN p.concepto = 'Abril' THEN p.monto_pagado ELSE 0 END) AS pagado_abril,
        SUM(CASE WHEN p.concepto = 'Mayo' THEN p.monto_pagado ELSE 0 END) AS pagado_mayo,
        SUM(CASE WHEN p.concepto = 'Junio' THEN p.monto_pagado ELSE 0 END) AS pagado_junio,
        SUM(CASE WHEN p.concepto = 'Julio' THEN p.monto_pagado ELSE 0 END) AS pagado_julio,
        SUM(CASE WHEN p.concepto = 'Agosto' THEN p.monto_pagado ELSE 0 END) AS pagado_agosto,
        SUM(CASE WHEN p.concepto = 'Septiembre' THEN p.monto_pagado ELSE 0 END) AS pagado_septiembre,
        SUM(CASE WHEN p.concepto = 'Octubre' THEN p.monto_pagado ELSE 0 END) AS pagado_octubre,
        SUM(CASE WHEN p.concepto = 'Noviembre' THEN p.monto_pagado ELSE 0 END) AS pagado_noviembre

      FROM estudiantes e
      JOIN inscripciones i ON e.id = i.estudiante_id
      LEFT JOIN tarifas_personalizadas tp ON tp.inscripcion_id = i.id

      LEFT JOIN cursos_tarifarios ct ON ct.nombre_curso = i.curso AND ct.sucursal = i.sucursal
      LEFT JOIN tarifas t ON t.gestion = i.gestion AND t.grupo_tarifa_id = ct.grupo_tarifa_id

      LEFT JOIN (
        SELECT inscripcion_id, jsonb_object_agg(concepto, monto) AS mensualidades_personalizadas
        FROM mensualidades_personalizadas
        GROUP BY inscripcion_id
      ) mp ON mp.inscripcion_id = i.id

      LEFT JOIN pagos p ON p.inscripcion_id = i.id

      WHERE i.gestion = $1 AND i.sucursal = $2
        AND ($3::VARCHAR IS NULL OR i.curso = $3)
        ${condicionesBusqueda ? `AND (${condicionesBusqueda})` : ""}

      GROUP BY 
        e.id, e.cod_est, e.apellidop, e.apellidom, e.nombre, e.carnet_identidad, 
        i.id, tp.costo_matricula, tp.costo_mensualidad, 
        t.costo_matricula, t.costo_mensualidad,
        mp.mensualidades_personalizadas

      ORDER BY 
        CASE 
          WHEN $4 = 'apellidop' THEN e.apellidop
          WHEN $4 = 'nombre' THEN e.nombre
          WHEN $4 = 'codigo' THEN e.cod_est
          WHEN $4 = 'carnet' THEN e.carnet_identidad
        END;
      `,
      [
        gestion,
        sucursal,
        curso === "Ninguno" ? null : curso,
        orden,
        ...palabrasBusqueda,
      ]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el resumen de pagos" });
  }
});

//Tarifas por gestion
router.get("/por-gestion", async (req, res) => {
  const { gestion, sucursal, curso } = req.query;

  try {
    if (!gestion || !sucursal) {
      return res.status(400).json({ error: "Faltan parámetros requeridos." });
    }

    if (curso && curso !== "Todos los Cursos") {
      // Obtener tarifa específica para ese curso y sucursal
      const result = await pool.query(
        `
          SELECT t.costo_matricula, t.costo_mensualidad
          FROM cursos_tarifarios ct
          JOIN tarifas t ON t.gestion = $1 AND t.grupo_tarifa_id = ct.grupo_tarifa_id
          WHERE ct.nombre_curso = $2 AND ct.sucursal = $3
        `,
        [gestion, curso, sucursal]
      );

      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res
          .status(404)
          .json({ error: "No se encontró tarifa para ese curso y año." });
      }
    } else {
      const result = await pool.query(
        `
          SELECT DISTINCT g.nombre AS grupo, t.costo_matricula, t.costo_mensualidad
          FROM cursos_tarifarios ct
          JOIN grupos_tarifas g ON g.id = ct.grupo_tarifa_id
          JOIN tarifas t ON t.gestion = $1 AND t.grupo_tarifa_id = g.id
          WHERE ct.sucursal = $2
          ORDER BY g.nombre DESC
        `,
        [gestion, sucursal]
      );

      if (result.rows.length > 0) {
        res.json({ resumen: result.rows });
      } else {
        res.status(404).json({
          error: "No se encontraron tarifas para esa sucursal y gestión.",
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener las tarifas" });
  }
});

module.exports = router;
