const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// 🔸 Obtener recibo por ID de pago con todos los datos necesarios
router.get("/pago/:pagoId", async (req, res) => {
  const { pagoId } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.id AS recibo_id, r.nit, r.razon_social, r.fecha_emision, r.codigo,
                p.monto_pagado, p.concepto, p.metodo_pago, p.fecha_pago, p.operador, p.inscripcion_id,
                e.nombre, e.apellidop, e.apellidom,
                i.curso, i.sucursal
         FROM recibos r
         JOIN pagos p ON r.pago_id = p.id
         JOIN estudiantes e ON r.estudiante_id = e.id
         JOIN inscripciones i ON p.inscripcion_id = i.id
         WHERE r.pago_id = $1`,
      [pagoId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Recibo no encontrado para este pago." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener recibo:", error);
    res.status(500).json({ error: "Error al obtener el recibo." });
  }
});

router.get("/recibo/:pago_id", async (req, res) => {
  const { pago_id } = req.params;
  try {
    const recibo = await pool.query(
      "SELECT * FROM recibos WHERE pago_id = $1",
      [pago_id]
    );
    if (recibo.rows.length === 0) {
      return res.status(404).json({ message: "Recibo no encontrado" });
    }
    res.json(recibo.rows[0]);
  } catch (error) {
    console.error("Error al obtener recibo:", error);
    res.status(500).json({ message: "Error al obtener recibo" });
  }
});

module.exports = router;
