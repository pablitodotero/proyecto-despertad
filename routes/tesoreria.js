const express = require("express");
const pool = require("../config/db");
const router = express.Router();

// Utilidad para convertir string a fecha válida
const parseDate = (str) => new Date(str);

// INGRESOS, EGRESOS Y BALANCE POR METODOS DE PAGOS
router.get("/resumen", async (req, res) => {
  const { fecha_inicio, fecha_fin, sucursal } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res
      .status(400)
      .json({ error: "Se requiere fecha_inicio y fecha_fin" });
  }

  try {
    const ingresosQuery = `
      SELECT 
        COALESCE(SUM(monto), 0) AS total,
        metodo
      FROM (
       SELECT p.monto_pagado AS monto, p.metodo_pago AS metodo, p.fecha_pago, p.sucursal
        FROM pagos p

        UNION ALL

        SELECT tp.monto_pagado, tp.metodo_pago, tp.fecha_pago,
               CASE
                 WHEN t.nivel = 'Primaria' THEN 'Primaria'
                 WHEN t.nivel = 'Secundaria' THEN 'Secundaria'
                 ELSE 'Ambas'
               END AS sucursal
        FROM taller_pagos tp
        JOIN taller_inscripciones ti ON ti.id = tp.taller_inscripcion_id
        JOIN taller_fechas tf ON tf.id = ti.taller_fecha_id
        JOIN talleres t ON t.id = tf.taller_id

        UNION ALL

        SELECT 
          pc.monto, 
          pc.metodo_pago, 
          pc.fecha_pago, 
          (
            SELECT p.sucursal
            FROM compras_detalle cd
            JOIN productos p ON p.id = cd.producto_id
            WHERE cd.compra_id = pc.compra_id
            LIMIT 1
          ) AS sucursal
        FROM pagos_compra pc
        
      ) AS ingresos
      WHERE DATE(fecha_pago) BETWEEN $1 AND $2
      AND ($3 = 'Ambas' OR sucursal = $3)
      GROUP BY metodo;
    `;

    const egresosQuery = `
      SELECT SUM(monto) AS total FROM (
        SELECT pp.monto_pagado AS monto, pp.fecha_pago AS creado_en, c.sucursal
        FROM pagos_personal pp
        JOIN contratos c ON c.id = pp.id_contrato

        UNION ALL

        SELECT g.monto, g.creado_en, g.sucursal
        FROM gastos g
      ) AS egresos
      WHERE DATE(creado_en) BETWEEN $1 AND $2
      AND ($3 = 'Ambas' OR LOWER(sucursal) = LOWER($3))
    `;

    const ingresosRes = await pool.query(ingresosQuery, [
      fecha_inicio,
      fecha_fin,
      sucursal,
    ]);
    const egresosRes = await pool.query(egresosQuery, [
      fecha_inicio,
      fecha_fin,
      sucursal,
    ]);

    const totalIngresos = ingresosRes.rows.reduce(
      (sum, row) => sum + parseFloat(row.total),
      0
    );
    const ingresosPorMetodo = {
      efectivo: 0,
      qr: 0,
      deposito: 0,
    };
    ingresosRes.rows.forEach((row) => {
      const normalizar = (texto) =>
        texto
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[^\w\s]/gi, "");

      const metodo = normalizar(row.metodo || "");
      if (metodo.includes("qr")) ingresosPorMetodo.qr += parseFloat(row.total);
      else if (metodo.includes("efectivo"))
        ingresosPorMetodo.efectivo += parseFloat(row.total);
      else if (metodo.includes("deposito"))
        ingresosPorMetodo.deposito += parseFloat(row.total);
    });

    const totalEgresos = parseFloat(egresosRes.rows[0]?.total || 0);

    res.json({
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      ingresosPorMetodo,
    });
  } catch (error) {
    console.error("Error en /tesoreria/resumen:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//Detalle estructurado de los ingresos: matrícula/mensualidades, talleres, y ventas.
router.get("/ingresos", async (req, res) => {
  const { fecha_inicio, fecha_fin, sucursal } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res
      .status(400)
      .json({ error: "Se requiere fecha_inicio y fecha_fin" });
  }

  try {
    // 1. MATRÍCULA Y MENSUALIDADES
    const conceptosRes = await pool.query(
      `SELECT concepto, SUM(p.monto_pagado) AS total
   FROM pagos p
   JOIN inscripciones i ON i.id = p.inscripcion_id
   WHERE DATE(p.fecha_pago) BETWEEN $1 AND $2
   AND ($3 = 'Ambas' OR p.sucursal = $3)
   GROUP BY concepto
   ORDER BY concepto`,
      [fecha_inicio, fecha_fin, sucursal]
    );

    const conceptos = [];
    for (const row of conceptosRes.rows) {
      const detallesRes = await pool.query(
        `SELECT 
      p.fecha_pago, p.monto_pagado, p.metodo_pago, p.operador, 
      p.sucursal AS sucursal_pago,
      i.sucursal AS sucursal_inscripcion,
      e.carnet_identidad AS ci,
      e.apellidop || ' ' || e.apellidom || ' ' || e.nombre AS nombre_estudiante
    FROM pagos p
    JOIN inscripciones i ON i.id = p.inscripcion_id
    JOIN estudiantes e ON e.id = i.estudiante_id
    WHERE p.concepto = $4
      AND DATE(p.fecha_pago) BETWEEN $1 AND $2
      AND ($3 = 'Ambas' OR p.sucursal = $3)
    ORDER BY p.fecha_pago DESC`,
        [fecha_inicio, fecha_fin, sucursal, row.concepto]
      );
      conceptos.push({
        concepto: row.concepto,
        total: parseFloat(row.total),
        detalles: detallesRes.rows,
      });
    }

    // 2. TALLERES
    const talleresRes = await pool.query(
      `SELECT t.nombre AS taller, tf.id AS ciclo_id, tf.fecha_inicio, tf.fecha_fin, SUM(tp.monto_pagado) AS total
       FROM taller_pagos tp
       JOIN taller_inscripciones ti ON ti.id = tp.taller_inscripcion_id
       JOIN taller_fechas tf ON tf.id = ti.taller_fecha_id
       JOIN talleres t ON t.id = tf.taller_id
       WHERE DATE(tp.fecha_pago) BETWEEN $1 AND $2
       AND ($3 = 'Ambas' OR t.nivel = $3)
       GROUP BY t.nombre, tf.id, tf.fecha_inicio, tf.fecha_fin
       ORDER BY t.nombre, tf.fecha_inicio`,
      [fecha_inicio, fecha_fin, sucursal]
    );

    const talleresMap = new Map();

    for (const row of talleresRes.rows) {
      if (!talleresMap.has(row.taller)) talleresMap.set(row.taller, []);

      const ciclos = talleresMap.get(row.taller);
      const cicloIndex = ciclos.length + 1;

      const detallesRes = await pool.query(
        `SELECT 
        tp.fecha_pago, tp.monto_pagado, tp.metodo_pago, tp.operador,
        e.carnet_identidad AS ci,
        e.apellidop || ' ' || e.apellidom || ' ' || e.nombre AS nombre_estudiante,
        CASE WHEN t.nivel = 'Primaria' THEN 'Primaria' ELSE 'Secundaria' END AS sucursal
      FROM taller_pagos tp
      JOIN taller_inscripciones ti ON ti.id = tp.taller_inscripcion_id
      JOIN estudiantes e ON e.id = ti.estudiante_id
     JOIN taller_fechas tf ON tf.id = ti.taller_fecha_id
     JOIN talleres t ON t.id = tf.taller_id
     WHERE tf.id = $1
     AND DATE(tp.fecha_pago) BETWEEN $2 AND $3
     AND ($4 = 'Ambas' OR t.nivel = $4)
     ORDER BY tp.fecha_pago DESC`,
        [row.ciclo_id, fecha_inicio, fecha_fin, sucursal]
      );

      ciclos.push({
        nombre: `Ciclo ${cicloIndex}`,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        total: parseFloat(row.total),
        detalles: detallesRes.rows,
      });
    }

    const talleres = Array.from(talleresMap.entries()).map(
      ([nombre, ciclos]) => ({
        nombre,
        total: ciclos.reduce((acc, c) => acc + c.total, 0),
        ciclos,
      })
    );

    // 3. VENTAS: Agrupar correctamente por tipo y detalle
    const ventas = {};
    let totalVentas = 0;

    // Obtener todos los productos vendidos por tipo
    const ventasRes = await pool.query(
      `
    SELECT 
      LOWER(p.tipo) AS tipo,
      pc.fecha_pago,
      cd.precio_unitario,
      cd.cantidad,
      pc.metodo_pago,
      pc.operador,
      i.sucursal,
      p.sucursal AS sucursal_producto,
      p.nombre AS nombre_producto,
      e.carnet_identidad AS ci,
      e.apellidop || ' ' || e.apellidom || ' ' || e.nombre AS nombre_estudiante
    FROM pagos_compra pc
    JOIN compras c ON c.id = pc.compra_id
    JOIN compras_detalle cd ON cd.compra_id = c.id
    JOIN productos p ON p.id = cd.producto_id
    JOIN inscripciones i ON i.id = c.inscripcion_id
    JOIN estudiantes e ON e.id = i.estudiante_id
    WHERE DATE(pc.fecha_pago) BETWEEN $1 AND $2
      AND ($3 = 'Ambas' OR p.sucursal = $3)
    ORDER BY pc.fecha_pago DESC
  `,
      [fecha_inicio, fecha_fin, sucursal]
    );

    for (const row of ventasRes.rows) {
      const tipo = row.tipo;

      const venta = {
        fecha_pago: row.fecha_pago,
        metodo_pago: row.metodo_pago,
        operador: row.operador,
        sucursal: row.sucursal, //estudiante
        sucursal_producto: row.sucursal_producto, //producto
        nombre_producto: row.nombre_producto, //producto
        cantidad: parseInt(row.cantidad),
        precio_unitario: parseFloat(row.precio_unitario),
        monto: parseFloat(row.precio_unitario) * parseInt(row.cantidad),
        nombre_estudiante: row.nombre_estudiante,
        ci: row.ci,
      };

      if (!ventas[tipo]) ventas[tipo] = [];
      ventas[tipo].push(venta);

      totalVentas += venta.monto;
    }

    res.json({
      matriculaMensualidades: {
        total: conceptos.reduce((a, c) => a + c.total, 0),
        conceptos,
      },
      talleres: {
        total: talleres.reduce((a, t) => a + t.total, 0),
        talleres,
      },
      ventas: {
        total: totalVentas,
        ...ventas,
      },
    });
  } catch (error) {
    console.error("Error en /tesoreria/ingresos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//Detalle estructurado de los egresos: sueldos por rol y mes, y gastos operativos por sección.
router.get("/egresos", async (req, res) => {
  const { fecha_inicio, fecha_fin, sucursal } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res
      .status(400)
      .json({ error: "Se requiere fecha_inicio y fecha_fin" });
  }

  try {
    // 1. Sueldos por rol y mes
    const sueldosRes = await pool.query(
      `SELECT hr.tipo_personal, pp.mes, SUM(pp.monto_pagado) AS total
       FROM pagos_personal pp
       JOIN contratos c ON c.id = pp.id_contrato
       JOIN historial_roles hr ON hr.id = c.id_historial_rol
       WHERE DATE(pp.fecha_pago) BETWEEN $1 AND $2
       AND ($3 = 'Ambas' OR LOWER(c.sucursal) = LOWER($3))
       GROUP BY hr.tipo_personal, pp.mes
       ORDER BY hr.tipo_personal, pp.mes`,
      [fecha_inicio, fecha_fin, sucursal]
    );

    const sueldosMap = new Map();
    for (const row of sueldosRes.rows) {
      const { tipo_personal, mes, total } = row;
      if (!sueldosMap.has(tipo_personal)) sueldosMap.set(tipo_personal, []);
      const detallesRes = await pool.query(
        `SELECT pp.fecha_pago, pp.monto_pagado, pp.operador, c.sucursal, 
                per.ci,
                per.apellidop || ' ' || per.apellidom || ' ' || per.nombres AS nombre_personal
         FROM pagos_personal pp
         JOIN contratos c ON c.id = pp.id_contrato
         JOIN historial_roles hr ON hr.id = c.id_historial_rol
         JOIN personal per ON per.id = c.id_personal
         WHERE hr.tipo_personal = $4
         AND pp.mes = $5
         AND DATE(pp.fecha_pago) BETWEEN $1 AND $2
         AND ($3 = 'Ambas' OR c.sucursal = $3)
         ORDER BY pp.fecha_pago DESC`,
        [fecha_inicio, fecha_fin, sucursal, tipo_personal, mes]
      );
      sueldosMap.get(tipo_personal).push({
        mes: parseInt(mes),
        total: parseFloat(total),
        detalles: detallesRes.rows,
      });
    }

    const sueldos = Array.from(sueldosMap.entries()).map(
      ([tipo_personal, meses]) => ({
        tipo_personal,
        total: meses.reduce((acc, m) => acc + m.total, 0),
        meses,
      })
    );

    // 2. Gastos operativos por sección
    const seccionesRes = await pool.query(
      `SELECT sg.nombre AS seccion, SUM(g.monto) AS total
       FROM gastos g
       JOIN secciones_gasto sg ON sg.id = g.id_seccion
       WHERE DATE(g.creado_en) BETWEEN $1 AND $2
       AND ($3 = 'Ambas' OR g.sucursal = $3)
       GROUP BY sg.nombre
       ORDER BY sg.nombre`,
      [fecha_inicio, fecha_fin, sucursal]
    );

    const secciones = [];
    for (const row of seccionesRes.rows) {
      const detallesRes = await pool.query(
        `SELECT g.fecha, g.descripcion, g.monto,
       (u.apellidop || ' ' || u.apellidom || ' ' || u.nombre) AS operador,
       g.sucursal
        FROM gastos g
        JOIN secciones_gasto sg ON sg.id = g.id_seccion
        LEFT JOIN usuarios u ON u.id = g.id_usuario
        WHERE sg.nombre = $4
        AND DATE(g.creado_en) BETWEEN $1 AND $2
        AND ($3 = 'Ambas' OR g.sucursal = $3)
        ORDER BY g.fecha DESC`,
        [fecha_inicio, fecha_fin, sucursal, row.seccion]
      );
      secciones.push({
        seccion: row.seccion,
        total: parseFloat(row.total),
        detalles: detallesRes.rows,
      });
    }

    res.json({
      sueldos: {
        total: sueldos.reduce((acc, s) => acc + s.total, 0),
        roles: sueldos,
      },
      operativos: {
        total: secciones.reduce((acc, s) => acc + s.total, 0),
        secciones,
      },
    });
  } catch (error) {
    console.error("Error en /tesoreria/egresos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
