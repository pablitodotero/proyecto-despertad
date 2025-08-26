const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// API 1: Obtener talleres con ciclos por gestión y nivel
router.get("/talleres", async (req, res) => {
  const { gestion, nivel } = req.query;
  if (!gestion || !nivel)
    return res.status(400).json({ message: "Faltan filtros" });

  try {
    const talleresRes = await pool.query(
      `SELECT * FROM talleres WHERE nivel = $1 ORDER BY nombre`,
      [nivel]
    );

    const data = await Promise.all(
      talleresRes.rows.map(async (taller) => {
        const ciclosRes = await pool.query(
          `SELECT id, fecha_inicio, fecha_fin, estado FROM taller_fechas
           WHERE taller_id = $1 AND gestion = $2 ORDER BY fecha_inicio`,
          [taller.id, gestion]
        );

        const ciclos = await Promise.all(
          ciclosRes.rows.map(async (ciclo) => {
            const montoRes = await pool.query(
              `SELECT AVG(monto) AS monto_promedio
               FROM taller_fechas_precios
               WHERE taller_fecha_id = $1`,
              [ciclo.id]
            );

            return {
              ...ciclo,
              monto_mensual: parseFloat(montoRes.rows[0].monto_promedio) || 0,
            };
          })
        );

        return {
          ...taller,
          ciclos,
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.error("Error obteniendo talleres:", err);
    res.status(500).json({ message: "Error al obtener talleres" });
  }
});

// 2. Obtener inscritos de un ciclo
router.get("/ciclo/:id/inscritos", async (req, res) => {
  const cicloId = req.params.id;
  try {
    const inscRes = await pool.query(
      `SELECT ti.id AS inscripcion_id, ti.fecha_inscripcion, ti.estado,
              e.id AS estudiante_id, e.nombre, e.apellidop, e.apellidom, e.carnet_identidad,
              e.cod_est, e.razon_social, e.nit,
              i.curso, i.sucursal
       FROM taller_inscripciones ti
       JOIN estudiantes e ON ti.estudiante_id = e.id
       JOIN inscripciones i ON i.estudiante_id = e.id AND i.gestion = (SELECT gestion FROM taller_fechas WHERE id = $1 LIMIT 1)
       WHERE ti.taller_fecha_id = $1`,
      [cicloId]
    );

    const data = await Promise.all(
      inscRes.rows.map(async (insc) => {
        const pagosRes = await pool.query(
          `SELECT mes, SUM(monto_pagado) AS monto_pagado, MAX(fecha_pago) AS fecha_pago
           FROM taller_pagos
           WHERE taller_inscripcion_id = $1
           GROUP BY mes
           ORDER BY mes`,
          [insc.inscripcion_id]
        );

        return {
          inscripcion_id: insc.inscripcion_id,
          fecha_inscripcion: insc.fecha_inscripcion,
          estado: insc.estado,
          estudiante: {
            id: insc.estudiante_id,
            nombre: insc.nombre,
            apellidop: insc.apellidop,
            apellidom: insc.apellidom,
            carnet_identidad: insc.carnet_identidad,
            cod_est: insc.cod_est,
            razon_social: insc.razon_social,
            nit: insc.nit,
            curso: insc.curso,
            sucursal: insc.sucursal,
          },
          pagos: pagosRes.rows.map((p) => ({
            mes: Number(p.mes),
            monto_pagado: parseFloat(p.monto_pagado),
            fecha_pago: p.fecha_pago,
          })),
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.error("Error obteniendo inscritos:", err);
    res.status(500).json({ message: "Error al obtener inscritos" });
  }
});

// 3. Registrar pago
router.post("/registrar", async (req, res) => {
  const {
    inscripcion_id,
    mes,
    monto_pagado,
    metodo_pago,
    observaciones,
    operador,
  } = req.body;

  if (!inscripcion_id || !mes || !monto_pagado || !metodo_pago)
    return res.status(400).json({ message: "Faltan datos obligatorios" });

  try {
    const pagosExistentes = await pool.query(
      `SELECT COALESCE(SUM(monto_pagado), 0) AS total_pagado
       FROM taller_pagos
       WHERE taller_inscripcion_id = $1 AND mes = $2`,
      [inscripcion_id, mes]
    );

    const montoEsperadoRes = await pool.query(
      `SELECT monto FROM taller_fechas_precios
       WHERE taller_fecha_id = (
         SELECT taller_fecha_id FROM taller_inscripciones WHERE id = $1
       ) AND mes = $2`,
      [inscripcion_id, mes]
    );

    if (montoEsperadoRes.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "No se encontró el monto esperado del mes" });
    }

    const totalPagadoAnterior = parseFloat(
      pagosExistentes.rows[0].total_pagado || 0
    );
    const montoEsperado = parseFloat(montoEsperadoRes.rows[0].monto);

    const nuevoTotal = totalPagadoAnterior + monto_pagado;

    if (nuevoTotal > montoEsperado) {
      return res.status(400).json({
        message: `El monto excede el total esperado del mes. Ya pagado: ${totalPagadoAnterior}, esperado: ${montoEsperado}`,
      });
    }

    await pool.query(
      `INSERT INTO taller_pagos (taller_inscripcion_id, mes, monto_pagado, metodo_pago, observaciones, operador)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        inscripcion_id,
        mes,
        monto_pagado,
        metodo_pago,
        observaciones || "",
        operador || "",
      ]
    );

    // Devuelve resumen actualizado del mes
    res.json({
      message: "Pago registrado correctamente",
      mes,
      total_pagado: nuevoTotal,
      monto_esperado: montoEsperado,
      restante: parseFloat((montoEsperado - nuevoTotal).toFixed(2)),
    });
  } catch (err) {
    console.error("Error registrando pago:", err);
    res.status(500).json({ message: "Error al registrar pago" });
  }
});

// 4. Cambiar estado de inscripción
router.put("/cambiar-estado", async (req, res) => {
  const { inscripcion_id, nuevo_estado } = req.body;
  if (!inscripcion_id || !nuevo_estado)
    return res.status(400).json({ message: "Faltan datos" });

  try {
    await pool.query(
      `UPDATE taller_inscripciones SET estado = $1 WHERE id = $2`,
      [nuevo_estado, inscripcion_id]
    );

    res.json({ message: "Estado actualizado" });
  } catch (err) {
    console.error("Error cambiando estado:", err);
    res.status(500).json({ message: "Error al cambiar estado" });
  }
});

// 5. Obtener detalle de ciclo
router.get("/ciclo/:id/detalle", async (req, res) => {
  try {
    const cicloId = req.params.id;
    const result = await pool.query(
      `SELECT estado, fecha_fin FROM taller_fechas WHERE id = $1`,
      [cicloId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Ciclo no encontrado" });

    const ciclo = result.rows[0];
    const estaCaducado = dayjs().isAfter(dayjs(ciclo.fecha_fin));

    res.json({ ...ciclo, estaCaducado });
  } catch (err) {
    console.error("Error detalle ciclo:", err);
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// 6. Obtener precios por mes del ciclo
router.get("/ciclo/:id/precios", async (req, res) => {
  const cicloId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT mes, monto FROM taller_fechas_precios WHERE taller_fecha_id = $1 ORDER BY mes`,
      [cicloId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error obteniendo precios del ciclo:", err);
    res.status(500).json({ message: "Error al obtener precios" });
  }
});

//VER PAGOS DETALLADOS
router.get("/pagos/:inscripcion_id/:mes", async (req, res) => {
  const { inscripcion_id, mes } = req.params;

  try {
    const pagosRes = await pool.query(
      `SELECT id, monto_pagado, fecha_pago, operador, metodo_pago, observaciones
       FROM taller_pagos
       WHERE taller_inscripcion_id = $1 AND mes = $2
       ORDER BY fecha_pago ASC`,
      [inscripcion_id, mes]
    );

    res.json(pagosRes.rows);
  } catch (err) {
    console.error("Error obteniendo pagos del mes:", err);
    res.status(500).json({ message: "Error al obtener pagos" });
  }
});

//Eliminar Pagos
router.delete("/pago/:id", async (req, res) => {
  const pagoId = req.params.id;

  try {
    const resPago = await pool.query(
      `SELECT fecha_pago FROM taller_pagos WHERE id = $1`,
      [pagoId]
    );

    if (resPago.rowCount === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    const fechaPago = new Date(resPago.rows[0].fecha_pago);
    const ahora = new Date();
    const diferenciaMin = (ahora - fechaPago) / (1000 * 60);

    if (diferenciaMin > 60) {
      return res.status(400).json({
        message: "No se puede eliminar el pago. Ya pasaron más de 60 minutos.",
      });
    }

    await pool.query(`DELETE FROM taller_pagos WHERE id = $1`, [pagoId]);
    res.json({ message: "Pago eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar pago:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
});

module.exports = router;
