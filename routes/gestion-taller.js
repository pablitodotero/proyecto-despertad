const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Crear un nuevo taller
router.post("/talleres", async (req, res) => {
  const { nombre, nivel, descripcion } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO talleres (nombre, nivel, descripcion)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre, nivel, descripcion]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear taller:", err);
    res.status(500).json({ message: "Error al crear taller" });
  }
});

// Obtener talleres filtrados por nivel y estado
router.get("/talleres", async (req, res) => {
  const { nivel, estado } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM talleres
       WHERE ($1::VARCHAR IS NULL OR nivel = $1)
       AND ($2::VARCHAR IS NULL OR estado = $2)
       ORDER BY nombre`,
      [nivel || null, estado || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener talleres:", err);
    res.status(500).json({ message: "Error al obtener talleres" });
  }
});

// Editar taller
router.put("/talleres/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, nivel, descripcion } = req.body;
  try {
    const result = await pool.query(
      `UPDATE talleres SET nombre = $1, nivel = $2, descripcion = $3
       WHERE id = $4 RETURNING *`,
      [nombre, nivel, descripcion, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al editar taller:", err);
    res.status(500).json({ message: "Error al editar taller" });
  }
});

// Cambiar estado activo/inactivo
router.patch("/talleres/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE talleres SET estado = $1 WHERE id = $2 RETURNING *`,
      [estado, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al cambiar estado:", err);
    res.status(500).json({ message: "Error al cambiar estado" });
  }
});

// Eliminar taller
router.delete("/talleres/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const inscripciones = await pool.query(
      `SELECT 1 FROM taller_inscripciones ti
       INNER JOIN taller_fechas tf ON ti.taller_fecha_id = tf.id
       WHERE tf.taller_id = $1 LIMIT 1`,
      [id]
    );

    if (inscripciones.rows.length > 0) {
      return res.status(409).json({
        message:
          "No se puede eliminar el taller porque tiene estudiantes inscritos.",
      });
    }

    await pool.query(`DELETE FROM talleres WHERE id = $1`, [id]);
    res.json({ message: "Taller eliminado" });
  } catch (err) {
    console.error("Error al eliminar taller:", err);
    res.status(500).json({ message: "Error al eliminar taller" });
  }
});

//Verificar si hay inscripcion
router.get("/talleres/:id/tiene-inscripciones", async (req, res) => {
  const { id } = req.params;
  try {
    const inscripciones = await pool.query(
      `SELECT 1 FROM taller_inscripciones ti
       INNER JOIN taller_fechas tf ON ti.taller_fecha_id = tf.id
       WHERE tf.taller_id = $1 LIMIT 1`,
      [id]
    );
    res.json({ tiene: inscripciones.rows.length > 0 });
  } catch (err) {
    console.error("Error al verificar inscripciones:", err);
    res.status(500).json({ message: "Error al verificar inscripciones" });
  }
});

// Obtener ciclos de un taller (por taller_id y gestion opcional)
router.get("/talleres/:id/ciclos", async (req, res) => {
  const { id } = req.params;
  const { gestion } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM taller_fechas
       WHERE taller_id = $1
       AND ($2::INT IS NULL OR gestion = $2)
       ORDER BY fecha_inicio`,
      [id, gestion || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener ciclos:", err);
    res.status(500).json({ message: "Error al obtener ciclos" });
  }
});

// Crear ciclo (asignar horario/fecha)
router.post("/talleres/:id/ciclos", async (req, res) => {
  const { id } = req.params;
  const { gestion, fecha_inicio, fecha_fin } = req.body;

  try {
    // Paso 1: Verificar si ya existe
    const existe = await pool.query(
      `SELECT id FROM taller_fechas 
       WHERE taller_id = $1 AND gestion = $2 AND fecha_inicio = $3 AND fecha_fin = $4`,
      [id, gestion, fecha_inicio, fecha_fin]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        message: "Ya existe un ciclo con estas fechas para el taller.",
        ciclo: existe.rows[0],
      });
    }

    // Paso 2: Insertar porque no existe
    const result = await pool.query(
      `INSERT INTO taller_fechas (taller_id, gestion, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, gestion, fecha_inicio, fecha_fin]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear ciclo:", err);
    res.status(500).json({ message: "Error al crear ciclo" });
  }
});

//Crear precios de un ciclo
router.post("/ciclos/:id/precios", async (req, res) => {
  const { id } = req.params;
  const { mes, monto } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO taller_fechas_precios (taller_fecha_id, mes, monto)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, mes, monto]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear precio de ciclo:", err);
    res.status(500).json({ message: "Error al crear precio de ciclo" });
  }
});

//Verificar si existe fecha en ciclo
router.get("/talleres/:id/verificar-ciclo", async (req, res) => {
  const { id } = req.params;
  const { gestion, fecha_inicio, fecha_fin } = req.query;

  try {
    const result = await pool.query(
      `SELECT id FROM taller_fechas
       WHERE taller_id = $1 AND gestion = $2 AND fecha_inicio = $3 AND fecha_fin = $4`,
      [id, gestion, fecha_inicio, fecha_fin]
    );

    if (result.rows.length > 0) {
      return res.json(true);
    } else {
      return res.json(false);
    }
  } catch (err) {
    console.error("Error al verificar ciclo:", err);
    res.status(500).json({ message: "Error al verificar ciclo" });
  }
});

// Verificar existencia de taller por nombre y nivel
router.get("/talleres/verificar", async (req, res) => {
  const { nombre, nivel, id } = req.query;
  try {
    let query = `
      SELECT * FROM talleres
      WHERE LOWER(nombre) = LOWER($1) AND nivel = $2
    `;
    const params = [nombre, nivel];

    if (id) {
      query += ` AND id <> $3`;
      params.push(id);
    }

    const result = await pool.query(query, params);
    res.json({ existe: result.rows.length > 0 });
  } catch (err) {
    console.error("Error al verificar taller:", err);
    res.status(500).json({ message: "Error al verificar taller" });
  }
});

// Cambiar estado del ciclo
router.put("/ciclos/:id/cambiar-estado", async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado } = req.body;

  if (!nuevoEstado || !["Activo", "Inactivo"].includes(nuevoEstado)) {
    return res.status(400).json({ message: "Estado inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cicloRes = await client.query(
      `SELECT * FROM taller_fechas WHERE id = $1`,
      [id]
    );
    if (cicloRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ciclo no encontrado." });
    }

    const ciclo = cicloRes.rows[0];
    const fechaFin = new Date(ciclo.fecha_fin);
    const hoy = new Date();

    if (nuevoEstado === "Activo" && fechaFin < hoy) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "No se puede activar un ciclo cuya fecha fin ya expiró.",
      });
    }

    await client.query(`UPDATE taller_fechas SET estado = $1 WHERE id = $2`, [
      nuevoEstado,
      id,
    ]);

    await client.query("COMMIT");
    res.json({ message: `Ciclo ${nuevoEstado.toLowerCase()} correctamente.` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al cambiar estado:", err);
    res.status(500).json({ message: "Error al cambiar estado del ciclo." });
  } finally {
    client.release();
  }
});

// Eliminar ciclo
router.delete("/ciclos/:id", async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inscripcionesRes = await client.query(
      `SELECT COUNT(*) AS total FROM taller_inscripciones WHERE taller_fecha_id = $1`,
      [id]
    );

    if (parseInt(inscripcionesRes.rows[0].total) > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "No se puede eliminar el ciclo porque tiene inscripciones registradas.",
      });
    }

    const deleteRes = await client.query(
      `DELETE FROM taller_fechas WHERE id = $1`,
      [id]
    );

    if (deleteRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ciclo no encontrado." });
    }

    await client.query("COMMIT");
    res.json({ message: "Ciclo eliminado correctamente." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar ciclo:", err);
    res.status(500).json({ message: "Error al eliminar ciclo." });
  } finally {
    client.release();
  }
});

//Obtener todo para el toggle
router.get("/historial-talleres", async (req, res) => {
  const { gestion, nivel } = req.query;

  if (!gestion || !nivel) {
    return res.status(400).json({ message: "Se requiere gestión y nivel." });
  }

  try {
    // 1. Obtener talleres del nivel
    const talleresResult = await pool.query(
      `SELECT * FROM talleres 
       WHERE nivel = $1 
       ORDER BY nombre`,
      [nivel]
    );
    const talleres = talleresResult.rows;

    // 2. Para cada taller, obtener sus ciclos y precios
    const data = await Promise.all(
      talleres.map(async (taller) => {
        const ciclosResult = await pool.query(
          `SELECT *, 
            EXISTS (
              SELECT 1 FROM taller_inscripciones ti 
              WHERE ti.taller_fecha_id = tf.id
            ) AS tiene_inscripciones
           FROM taller_fechas tf
           WHERE tf.taller_id = $1 AND tf.gestion = $2
           ORDER BY tf.fecha_inicio`,
          [taller.id, gestion]
        );

        const ciclos = await Promise.all(
          ciclosResult.rows.map(async (ciclo) => {
            const preciosResult = await pool.query(
              `SELECT * FROM taller_fechas_precios
               WHERE taller_fecha_id = $1
               ORDER BY mes`,
              [ciclo.id]
            );

            return {
              ...ciclo,
              tiene_inscripciones: ciclo.tiene_inscripciones,
              precios: preciosResult.rows,
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
    console.error("Error al obtener historial de talleres:", err);
    res.status(500).json({ message: "Error al obtener historial de talleres" });
  }
});

// Editar ciclo: fechas y precios con validaciones de pagos
router.put("/ciclos/:id/editar", async (req, res) => {
  const { id } = req.params;
  const { fecha_inicio, fecha_fin, precios } = req.body;

  if (!fecha_inicio || !fecha_fin || !Array.isArray(precios)) {
    return res
      .status(400)
      .json({ message: "Datos incompletos para la edición." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cicloRes = await client.query(
      `SELECT * FROM taller_fechas WHERE id = $1`,
      [id]
    );
    if (cicloRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ciclo no encontrado." });
    }

    const ciclo = cicloRes.rows[0];

    if (ciclo.estado !== "Activo") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "No se puede editar un ciclo inactivo." });
    }

    const nuevaFechaInicio = new Date(fecha_inicio);
    const nuevaFechaFin = new Date(fecha_fin);

    if (nuevaFechaInicio > nuevaFechaFin) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La fecha de inicio no puede ser mayor a la de fin.",
      });
    }

    const anioInicio = nuevaFechaInicio.getFullYear();
    const anioFin = nuevaFechaFin.getFullYear();

    if (anioInicio !== ciclo.gestion || anioFin !== ciclo.gestion) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Las fechas deben corresponder al año de la gestión ${ciclo.gestion}.`,
      });
    }

    const pagosRes = await client.query(
      `SELECT tp.mes, SUM(tp.monto_pagado) AS total_pagado
       FROM taller_pagos tp
       INNER JOIN taller_inscripciones ti ON tp.taller_inscripcion_id = ti.id
       WHERE ti.taller_fecha_id = $1
       GROUP BY tp.mes`,
      [id]
    );

    const pagosPorMes = {};
    pagosRes.rows.forEach((row) => {
      pagosPorMes[row.mes] = parseFloat(row.total_pagado);
    });

    const nombresMeses = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    let nuevosMeses = [];
    let cursor = new Date(ciclo.gestion, nuevaFechaInicio.getMonth(), 1);
    const finCursor = new Date(ciclo.gestion, nuevaFechaFin.getMonth(), 1);

    while (cursor <= finCursor) {
      nuevosMeses.push(cursor.getMonth() + 1);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const mesPagado of Object.keys(pagosPorMes).map((m) => parseInt(m))) {
      if (!nuevosMeses.includes(mesPagado)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `No puedes eliminar el mes de ${nombresMeses[mesPagado]} porque ya existen pagos realizados en ese mes.`,
        });
      }
    }

    for (const precio of precios) {
      const { mes, monto } = precio;
      const totalPagado = pagosPorMes[mes] || 0;
      if (monto < totalPagado) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `El precio del mes de ${
            nombresMeses[mes]
          } no puede ser menor a Bs. ${totalPagado.toFixed(
            2
          )} porque ya se pagó esa cantidad`,
        });
      }
    }

    await client.query(
      `UPDATE taller_fechas SET fecha_inicio = $1, fecha_fin = $2 WHERE id = $3`,
      [fecha_inicio, fecha_fin, id]
    );

    await client.query(
      `DELETE FROM taller_fechas_precios WHERE taller_fecha_id = $1`,
      [id]
    );

    for (const precio of precios) {
      await client.query(
        `INSERT INTO taller_fechas_precios (taller_fecha_id, mes, monto) VALUES ($1, $2, $3)`,
        [id, precio.mes, precio.monto]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Ciclo actualizado correctamente." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al editar ciclo:", err);
    res.status(500).json({ message: "Error al editar ciclo." });
  } finally {
    client.release();
  }
});

module.exports = router;
