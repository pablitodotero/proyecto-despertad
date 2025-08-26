const express = require("express");
const pool = require("../config/db");
const router = express.Router();

//Listar pagos parciales y pendientes
router.get("/pendientes", async (req, res) => {
  const { gestion, sucursal, curso } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Gestión y sucursal son requeridos" });
  }

  try {
    let query = `
      WITH total_compra AS (
        SELECT compra_id, SUM(cantidad * precio_unitario) AS monto_total
        FROM compras_detalle
        GROUP BY compra_id
      ),
      total_pagado AS (
        SELECT compra_id, SUM(monto) AS pagado
        FROM pagos_compra
        GROUP BY compra_id
      )
      SELECT 
        c.id AS compra_id,
        c.fecha_compra,
        c.estado,
        i.curso, 
        e.nombre, e.apellidop, e.apellidom, e.carnet_identidad,
        COALESCE(tc.monto_total, 0) AS monto_total,
        COALESCE(tp.pagado, 0) AS pagado
      FROM compras c
      JOIN inscripciones i ON c.inscripcion_id = i.id
      JOIN estudiantes e ON i.estudiante_id = e.id
      LEFT JOIN total_compra tc ON tc.compra_id = c.id
      LEFT JOIN total_pagado tp ON tp.compra_id = c.id
      WHERE i.gestion = $1
        AND i.sucursal = $2
        AND c.estado IN ('Pendiente', 'Parcial')
    `;

    const params = [gestion, sucursal];

    if (curso) {
      query += ` AND i.curso = $3`;
      params.push(curso);
    }

    query += `
      ORDER BY c.fecha_compra DESC
    `;

    const result = await pool.query(query, params);

    res.json(
      result.rows.map((row, index) => ({
        numero: index + 1,
        compra_id: row.compra_id,
        fecha_compra: row.fecha_compra,
        estado: row.estado,
        curso: row.curso,
        estudiante: `${row.apellidop} ${row.apellidom}, ${row.nombre}`,
        ci: row.carnet_identidad,
        monto_total: Number(row.monto_total),
        pagado: Number(row.pagado),
        saldo: Number(row.monto_total) - Number(row.pagado),
      }))
    );
  } catch (error) {
    console.error("Error al obtener pendientes:", error);
    res.status(500).json({ error: "Error al obtener pendientes" });
  }
});

//Detalle de compra
router.get("/detalle-compra/:compra_id", async (req, res) => {
  const { compra_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
         p.nombre,
         p.descripcion,
         cd.cantidad,
         cd.precio_unitario,
         (cd.cantidad * cd.precio_unitario) AS subtotal
       FROM compras_detalle cd
       JOIN productos p ON cd.producto_id = p.id
       WHERE cd.compra_id = $1`,
      [compra_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener detalle de compra:", error);
    res.status(500).json({ error: "Error al obtener detalle de compra" });
  }
});

//Lista de pagos de compra
router.get("/pagos-compra/:compra_id", async (req, res) => {
  const { compra_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
         id AS pago_id,
         monto,
         metodo_pago,
         observacion,
         operador,
         to_char(fecha_pago, 'YYYY-MM-DD HH24:MI') AS fecha_pago
       FROM pagos_compra
       WHERE compra_id = $1
       ORDER BY fecha_pago`,
      [compra_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener pagos de compra:", error);
    res.status(500).json({ error: "Error al obtener pagos de compra" });
  }
});

//Eliminar Pagos
router.delete("/eliminar-pago/:pago_id", async (req, res) => {
  const { pago_id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verificar tiempo del pago
    const pago = await client.query(
      `SELECT fecha_pago FROM pagos_compra WHERE id = $1`,
      [pago_id]
    );

    if (pago.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const fechaPago = new Date(pago.rows[0].fecha_pago);
    const ahora = new Date();
    const diffMin = (ahora - fechaPago) / (1000 * 60);
    if (diffMin > 60) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "El pago no puede eliminarse después de 1 hora" });
    }

    // Obtener compra asociada
    const compra = await client.query(
      `SELECT compra_id FROM pagos_compra WHERE id = $1`,
      [pago_id]
    );

    const compra_id = compra.rows[0].compra_id;

    // Eliminar el pago
    await client.query(`DELETE FROM pagos_compra WHERE id = $1`, [pago_id]);

    // Recalcular estado de la compra
    const pagos = await client.query(
      `SELECT SUM(monto) AS total_pagado FROM pagos_compra WHERE compra_id = $1`,
      [compra_id]
    );
    const totalPagado = Number(pagos.rows[0].total_pagado) || 0;

    const detalles = await client.query(
      `SELECT SUM(cantidad * precio_unitario) AS total_compra
       FROM compras_detalle WHERE compra_id = $1`,
      [compra_id]
    );
    const totalCompra = Number(detalles.rows[0].total_compra) || 0;

    let estado = "Pendiente";
    if (totalPagado >= totalCompra) {
      estado = "Pagado";
    } else if (totalPagado > 0) {
      estado = "Parcial";
    }

    await client.query(`UPDATE compras SET estado = $1 WHERE id = $2`, [
      estado,
      compra_id,
    ]);

    await client.query("COMMIT");
    res.json({ mensaje: "Pago eliminado correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar pago:", error);
    res.status(500).json({ error: "Error al eliminar pago" });
  } finally {
    client.release();
  }
});

//Recibo
router.get("/recibo-pago/:pago_id", async (req, res) => {
  const { pago_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        p.id AS pago_id,
        p.monto AS monto_pagado,
        p.metodo_pago,
        p.observacion,
        p.operador,
        p.fecha_pago,
        e.id AS estudiante_id,
        e.razon_social,
        e.nit,
        e.cod_est,
        e.nombre,
        e.apellidop,
        e.apellidom,
        i.sucursal,
        i.curso,
        to_char(p.fecha_pago, 'YYYY-MM-DD HH24:MI') AS fecha_emision
      FROM pagos_compra p
      JOIN compras c ON p.compra_id = c.id
      JOIN inscripciones i ON c.inscripcion_id = i.id
      JOIN estudiantes e ON i.estudiante_id = e.id
      WHERE p.id = $1
      `,
      [pago_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Recibo no encontrado" });
    }

    const row = result.rows[0];

    res.json({
      pago: {
        monto_pagado: Number(row.monto_pagado),
        metodo_pago: row.metodo_pago,
        observacion: row.observacion,
        operador: row.operador,
        concepto: `Pago por compra realizada el ${row.fecha_emision}`,
        sucursal: row.sucursal,
      },
      razon_social: row.razon_social,
      nit: row.nit,
      estudiante: {
        id: row.estudiante_id,
        cod_est: row.cod_est,
        nombre: row.nombre,
        apellidop: row.apellidop,
        apellidom: row.apellidom,
      },
      inscripcion: {
        sucursal: row.sucursal,
        curso: row.curso,
      },
      fecha_emision: row.fecha_emision,
      codigo: `RCP-${pago_id.toString().padStart(5, "0")}`,
    });
  } catch (error) {
    console.error("Error al obtener recibo:", error);
    res.status(500).json({ error: "Error al obtener recibo" });
  }
});

// Lista de Pagados
router.get("/pagados", async (req, res) => {
  const { gestion, sucursal, curso } = req.query;

  if (!gestion || !sucursal) {
    return res.status(400).json({ error: "Gestión y sucursal son requeridos" });
  }

  try {
    let query = `
      WITH total_compra AS (
        SELECT compra_id, SUM(cantidad * precio_unitario) AS monto_total
        FROM compras_detalle
        GROUP BY compra_id
      ),
      total_pagado AS (
        SELECT compra_id, SUM(monto) AS pagado
        FROM pagos_compra
        GROUP BY compra_id
      ),
      ultima_fecha_pago AS (
        SELECT compra_id, MAX(fecha_pago) AS ultima_fecha
        FROM pagos_compra
        GROUP BY compra_id
      ),
      sucursal_compra AS (
        SELECT cd.compra_id, MAX(p.sucursal) AS sucursal
        FROM compras_detalle cd
        JOIN productos p ON p.id = cd.producto_id
        GROUP BY cd.compra_id
      )
      SELECT 
        c.id AS compra_id,
        c.fecha_compra,
        c.estado,
        i.curso,
        i.sucursal AS sucursal_estudiante,
        sc.sucursal AS sucursal_compra,
        e.nombre, e.apellidop, e.apellidom, e.carnet_identidad,
        COALESCE(tc.monto_total, 0) AS monto_total,
        COALESCE(tp.pagado, 0) AS pagado,
        ufp.ultima_fecha
      FROM compras c
      JOIN inscripciones i ON c.inscripcion_id = i.id
      JOIN estudiantes e ON i.estudiante_id = e.id
      LEFT JOIN total_compra tc ON tc.compra_id = c.id
      LEFT JOIN total_pagado tp ON tp.compra_id = c.id
      LEFT JOIN ultima_fecha_pago ufp ON ufp.compra_id = c.id
      LEFT JOIN sucursal_compra sc ON sc.compra_id = c.id
      WHERE i.gestion = $1
        AND sc.sucursal = $2
        AND c.estado = 'Pagado'
    `;

    const params = [gestion, sucursal];

    if (curso) {
      query += ` AND i.curso = $3`;
      params.push(curso);
    }

    query += ` ORDER BY c.fecha_compra DESC`;

    const result = await pool.query(query, params);
    const ahora = new Date();

    res.json(
      result.rows.map((row, index) => {
        const fechaPago = row.ultima_fecha ? new Date(row.ultima_fecha) : null;
        let eliminable = false;

        if (fechaPago) {
          const diffMs = ahora.getTime() - fechaPago.getTime();
          const diffMin = diffMs / 60000;
          eliminable = diffMin <= 60;
        }

        return {
          numero: index + 1,
          compra_id: row.compra_id,
          fecha_compra: row.fecha_compra,
          estado: row.estado,
          curso: row.curso,
          estudiante: `${row.apellidop} ${row.apellidom}, ${row.nombre}`,
          ci: row.carnet_identidad,
          monto_total: Number(row.monto_total),
          pagado: Number(row.pagado),
          saldo: Number(row.monto_total) - Number(row.pagado),
          eliminable,
          ultima_fecha_pago: row.ultima_fecha,
          sucursal_estudiante: row.sucursal_estudiante,
          sucursal_compra: row.sucursal_compra,
        };
      })
    );
  } catch (error) {
    console.error("Error al obtener pagados:", error);
    res.status(500).json({ error: "Error al obtener pagados" });
  }
});

//Obtener fecha pago
router.get("/compras/:id/ultima-fecha-pago", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT MAX(fecha_pago) AS ultima_fecha FROM pagos_compra WHERE compra_id = $1`,
      [id]
    );

    const ultimaFecha = result.rows[0]?.ultima_fecha;

    if (!ultimaFecha) {
      return res.status(404).json({ error: "No se encontró fecha de pago" });
    }

    res.json({ ultimaFecha });
  } catch (error) {
    console.error("Error al obtener última fecha de pago:", error);
    res.status(500).json({ error: "Error interno" });
  }
});

//Eliminar compra
router.delete("/compras/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Eliminar pagos, detalles y la compra
    await pool.query("BEGIN");

    await pool.query("DELETE FROM pagos_compra WHERE compra_id = $1", [id]);
    await pool.query("DELETE FROM compras_detalle WHERE compra_id = $1", [id]);
    await pool.query("DELETE FROM compras WHERE id = $1", [id]);

    await pool.query("COMMIT");

    res.json({ message: "Compra eliminada correctamente" });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error al eliminar compra:", error);
    res.status(500).json({ error: "Error al eliminar compra" });
  }
});

module.exports = router;
