const express = require("express");
const pool = require("../config/db");
const router = express.Router();

// Estudiantes inscritos este año
router.get("/estudiantes-inscritos", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total
       FROM inscripciones
       WHERE gestion = $1 AND sucursal = $2 AND estado = 'Activo'`,
      [gestion, sucursal]
    );
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener estudiantes inscritos" });
  }
});

// Estudiantes nuevos este año
router.get("/estudiantes-nuevos", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total FROM (
        SELECT i.estudiante_id
        FROM inscripciones i
        WHERE i.gestion = $1 AND i.sucursal = $2
        AND NOT EXISTS (
          SELECT 1 FROM inscripciones
          WHERE gestion = $1::int - 1 AND sucursal = $2 AND estudiante_id = i.estudiante_id
        )
      ) AS nuevos`,
      [gestion, sucursal]
    );
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener estudiantes nuevos" });
  }
});

// Estudiantes no reinscritos
router.get("/estudiantes-no-reinscritos", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total FROM (
        SELECT i.estudiante_id
        FROM inscripciones i
        WHERE i.gestion = $1::int - 1 AND i.sucursal = $2
        AND NOT EXISTS (
          SELECT 1 FROM inscripciones
          WHERE gestion = $1 AND sucursal = $2 AND estudiante_id = i.estudiante_id
        )
      ) AS no_reinscritos`,
      [gestion, sucursal]
    );
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Error al obtener estudiantes no reinscritos" });
  }
});

// Estudiantes del año pasado
router.get("/estudiantes-anio-pasado", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total
       FROM inscripciones
       WHERE gestion = $1::int - 1 AND sucursal = $2`,
      [gestion, sucursal]
    );
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Error al obtener estudiantes del año pasado" });
  }
});

// Talleres activos
router.get("/talleres-activos", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT t.nombre AS taller, COUNT(tf.id) AS ciclos_activos
       FROM talleres t
       LEFT JOIN taller_fechas tf 
         ON t.id = tf.taller_id 
         AND tf.gestion = $1
         AND tf.estado = 'Activo'
         AND CURRENT_DATE BETWEEN tf.fecha_inicio AND tf.fecha_fin
       WHERE (t.nivel = $2 OR t.nivel = 'Ambos')
         AND (
           t.estado = 'Activo'
           OR EXISTS (
             SELECT 1 FROM taller_fechas 
             WHERE taller_id = t.id
               AND gestion = $1
               AND estado = 'Activo'
               AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
           )
         )
       GROUP BY t.nombre
       ORDER BY t.nombre`,
      [gestion, sucursal]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener talleres activos" });
  }
});

// Estudiantes por curso
router.get("/estudiantes-por-curso", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT curso, COUNT(*) AS total
       FROM inscripciones
       WHERE gestion = $1 AND sucursal = $2
       GROUP BY curso
       ORDER BY curso`,
      [gestion, sucursal]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener estudiantes por curso" });
  }
});

// Gastos por mes
router.get("/gastos-por-mes", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT EXTRACT(MONTH FROM fecha) AS mes, SUM(monto)::numeric(10,2) AS total
       FROM gastos
       WHERE EXTRACT(YEAR FROM fecha) = $1 AND sucursal = $2
       GROUP BY mes
       ORDER BY mes`,
      [gestion, sucursal]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener gastos por mes" });
  }
});

// Cumpleaños estudiantes
router.get("/cumpleanos-estudiantes", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT i.curso, e.nombre, e.apellidop, e.apellidom
       FROM estudiantes e
       JOIN inscripciones i ON e.id = i.estudiante_id
       WHERE i.gestion = $1 AND i.sucursal = $2
         AND EXTRACT(MONTH FROM e.fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM e.fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
       ORDER BY i.curso, e.apellidop, e.apellidom, e.nombre`,
      [gestion, sucursal]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cumpleaños estudiantes" });
  }
});

// Cumpleaños personal
router.get("/cumpleanos-personal", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT p.nombres, p.apellidop, p.apellidom,
              ARRAY_AGG(DISTINCT hr.tipo_personal ORDER BY hr.tipo_personal) AS roles
       FROM personal p
       JOIN contratos c ON p.id = c.id_personal
       JOIN historial_roles hr ON c.id_historial_rol = hr.id
       WHERE c.gestion = $1 AND LOWER(c.sucursal) = LOWER($2)
         AND EXTRACT(MONTH FROM p.fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM p.fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
       GROUP BY p.id, p.nombres, p.apellidop, p.apellidom
       ORDER BY p.apellidop, p.apellidom, p.nombres`,
      [gestion, sucursal]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cumpleaños personal" });
  }
});

// Productos vendidos
router.get("/productos-vendidos", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    const result = await pool.query(
      `SELECT p.tipo,
              SUM(cd.cantidad)::int AS total_comprado,
              SUM(CASE WHEN c.estado = 'Pagado' THEN cd.cantidad ELSE 0 END)::int AS total_pagado
       FROM compras c
       JOIN compras_detalle cd ON c.id = cd.compra_id
       JOIN productos p ON cd.producto_id = p.id
       WHERE EXTRACT(YEAR FROM c.fecha_compra) = $1
         AND (p.sucursal = $2 OR p.sucursal IS NULL)
       GROUP BY p.tipo
       ORDER BY p.tipo`,
      [gestion, sucursal]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos vendidos" });
  }
});

// Porcentaje pagos
router.get("/porcentaje-pagos", async (req, res) => {
  const { gestion, sucursal } = req.query;
  try {
    // =========================
    // MATRÍCULA
    // =========================
    const matriculaResult = await pool.query(
      `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE pagado >= esperado) AS pagados
      FROM (
        SELECT 
          i.id,
          COALESCE(SUM(p.monto_pagado), 0) AS pagado,
          COALESCE(
            (SELECT monto FROM mensualidades_personalizadas 
             WHERE inscripcion_id = i.id AND concepto = 'Matrícula'),
            tp.costo_matricula,
            t.costo_matricula
          ) AS esperado
        FROM inscripciones i
        LEFT JOIN pagos p 
          ON p.inscripcion_id = i.id AND p.concepto = 'Matrícula'
        LEFT JOIN tarifas_personalizadas tp 
          ON tp.inscripcion_id = i.id
        LEFT JOIN cursos_tarifarios ct 
          ON ct.nombre_curso = i.curso AND ct.sucursal = i.sucursal
        LEFT JOIN tarifas t 
          ON t.gestion = i.gestion AND t.grupo_tarifa_id = ct.grupo_tarifa_id
        WHERE i.gestion = $1 AND i.sucursal = $2
        GROUP BY i.id, esperado
      ) sub
      `,
      [gestion, sucursal]
    );

    // =========================
    // MENSUALIDADES
    // =========================
    const mensualidadesResult = await pool.query(
      `
      WITH meses AS (
        SELECT unnest(array[2,3,4,5,6,7,8,9,10,11]) AS mes
      ),
      insc AS (
        SELECT 
          i.id AS inscripcion_id,
          m.mes,
          COALESCE(
            (SELECT monto 
             FROM mensualidades_personalizadas 
             WHERE inscripcion_id = i.id 
               AND concepto = CASE m.mes
                 WHEN 2 THEN 'Febrero'
                 WHEN 3 THEN 'Marzo'
                 WHEN 4 THEN 'Abril'
                 WHEN 5 THEN 'Mayo'
                 WHEN 6 THEN 'Junio'
                 WHEN 7 THEN 'Julio'
                 WHEN 8 THEN 'Agosto'
                 WHEN 9 THEN 'Septiembre'
                 WHEN 10 THEN 'Octubre'
                 WHEN 11 THEN 'Noviembre'
               END
            ),
            CASE 
              -- Si tiene mensualidades_personalizadas pero no este mes, esperado = 0
              WHEN EXISTS (
                SELECT 1 FROM mensualidades_personalizadas 
                WHERE inscripcion_id = i.id
              ) THEN 0
              ELSE COALESCE(tp.costo_mensualidad, t.costo_mensualidad)
            END
          ) AS esperado
        FROM inscripciones i
        CROSS JOIN meses m
        LEFT JOIN tarifas_personalizadas tp 
          ON tp.inscripcion_id = i.id
        LEFT JOIN cursos_tarifarios ct 
          ON ct.nombre_curso = i.curso AND ct.sucursal = i.sucursal
        LEFT JOIN tarifas t 
          ON t.gestion = i.gestion AND t.grupo_tarifa_id = ct.grupo_tarifa_id
        WHERE i.gestion = $1 AND i.sucursal = $2
      ),
      pagos_mes AS (
        SELECT 
          p.inscripcion_id,
          CASE 
            WHEN p.concepto = 'Febrero' THEN 2
            WHEN p.concepto = 'Marzo' THEN 3
            WHEN p.concepto = 'Abril' THEN 4
            WHEN p.concepto = 'Mayo' THEN 5
            WHEN p.concepto = 'Junio' THEN 6
            WHEN p.concepto = 'Julio' THEN 7
            WHEN p.concepto = 'Agosto' THEN 8
            WHEN p.concepto = 'Septiembre' THEN 9
            WHEN p.concepto = 'Octubre' THEN 10
            WHEN p.concepto = 'Noviembre' THEN 11
            ELSE NULL
          END AS mes,
          SUM(p.monto_pagado) AS pagado
        FROM pagos p
        GROUP BY p.inscripcion_id, mes
      )
      SELECT 
        i.mes,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE COALESCE(p.pagado,0) >= i.esperado) AS pagados
      FROM insc i
      LEFT JOIN pagos_mes p
        ON p.inscripcion_id = i.inscripcion_id AND p.mes = i.mes
      GROUP BY i.mes
      ORDER BY i.mes
      `,
      [gestion, sucursal]
    );

    // =========================
    // Formateo de respuesta
    // =========================
    const matricula = matriculaResult.rows[0] || { total: 0, pagados: 0 };
    const mensualidades = mensualidadesResult.rows.map((r) => ({
      mes: parseInt(r.mes),
      total: parseInt(r.total),
      pagados: parseInt(r.pagados),
      porcentaje:
        r.total > 0 ? Math.round((r.pagados * 10000) / r.total) / 100 : 0,
    }));

    res.json({
      matricula: {
        total: parseInt(matricula.total),
        pagados: parseInt(matricula.pagados),
        porcentaje:
          matricula.total > 0
            ? Math.round((matricula.pagados * 10000) / matricula.total) / 100
            : 0,
      },
      mensualidades,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular porcentaje de pagos" });
  }
});

module.exports = router;
