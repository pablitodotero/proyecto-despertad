const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Obtener pagos por ID de inscripción
router.get("/inscripcion/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM pagos WHERE inscripcion_id = $1 ORDER BY fecha_pago ASC",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    res.status(500).json({ error: "Error al obtener pagos del estudiante" });
  }
});

// Registrar nuevo pago y recibo
router.post("/registrar", async (req, res) => {
  const {
    inscripcion_id,
    concepto,
    monto_pagado,
    metodo_pago,
    observaciones,
    operador,
    sucursal,
  } = req.body;
  try {
    await pool.query("BEGIN");

    // Insertar el pago
    const nuevoPago = await pool.query(
      "INSERT INTO pagos (inscripcion_id, concepto, monto_pagado, metodo_pago, observaciones, operador, sucursal) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [
        inscripcion_id,
        concepto,
        monto_pagado,
        metodo_pago,
        observaciones,
        operador,
        sucursal,
      ]
    );

    const pago_id = nuevoPago.rows[0].id;

    // Obtener información del estudiante
    const estudiante = await pool.query(
      "SELECT e.id, e.nit, e.razon_social FROM estudiantes e JOIN inscripciones i ON e.id = i.estudiante_id WHERE i.id = $1",
      [inscripcion_id]
    );

    const { id: estudiante_id, nit, razon_social } = estudiante.rows[0];

    // Generar el siguiente código correlativo para el año actual
    const anio = new Date().getFullYear();
    const result = await pool.query(
      "SELECT codigo FROM recibos WHERE codigo LIKE $1 ORDER BY codigo DESC LIMIT 1",
      [`${anio}%`]
    );

    let nuevoCodigo;
    if (result.rows.length > 0) {
      const ultimoCodigo = parseInt(result.rows[0].codigo);
      nuevoCodigo = (ultimoCodigo + 1).toString();
    } else {
      nuevoCodigo = `${anio}00001`;
    }

    // Insertar el recibo
    await pool.query(
      "INSERT INTO recibos (pago_id, estudiante_id, nit, razon_social, codigo) VALUES ($1, $2, $3, $4, $5)",
      [pago_id, estudiante_id, nit, razon_social, nuevoCodigo]
    );

    await pool.query("COMMIT");

    res.status(201).json({
      message: "Pago y recibo registrados exitosamente.",
      codigo: nuevoCodigo,
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error al registrar el pago y recibo:", error);
    res.status(500).json({ error: "Error al registrar el pago y recibo." });
  }
});

// ELIMINAR PAGO Y RECIBO SOLO SI NO PASÓ MÁS DE 1 HORA
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Buscar la fecha del pago
    const resultado = await pool.query(
      "SELECT fecha_pago FROM pagos WHERE id = $1",
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ message: "Pago no encontrado." });
    }

    const fechaPago = new Date(resultado.rows[0].fecha_pago);
    const ahora = new Date();
    const diferenciaMs = ahora.getTime() - fechaPago.getTime();
    const unaHoraMs = 60 * 60 * 1000;

    // 2. Si pasó más de 1 hora, no se permite eliminar
    if (diferenciaMs > unaHoraMs) {
      return res.status(403).json({
        message:
          "No se puede eliminar el pago porque ha pasado más de 1 hora desde su registro.",
      });
    }

    // 3. Eliminar: recibo primero, luego el pago
    await pool.query("BEGIN");
    await pool.query("DELETE FROM recibos WHERE pago_id = $1", [id]);
    await pool.query("DELETE FROM pagos WHERE id = $1", [id]);
    await pool.query("COMMIT");

    res
      .status(200)
      .json({ message: "Pago y recibo eliminados correctamente." });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error al eliminar el pago y recibo:", error);
    res.status(500).json({ message: "Error al eliminar el pago y recibo." });
  }
});
module.exports = router;
