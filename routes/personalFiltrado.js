const express = require("express");
const pool = require("../config/db");
const router = express.Router();

//CONTRATOS CON FECHA INICIO Y TURNOS
router.get("/filtrado", async (req, res) => {
  const { gestion, rol, sucursal } = req.query;

  try {
    const result = await pool.query(
      `
    SELECT 
      p.id, p.nombres, p.apellidop, p.apellidom, p.ci,
      hr.tipo_personal AS rol_en_contrato,
      c.id AS contrato_id, c.gestion, c.tipo_contrato, c.id_turno, c.sucursal, c.sueldo_mensual,
      c.fecha_inicio, c.fecha_fin, c.observaciones,
      t.nombre AS turno_nombre, t.hora_inicio, t.hora_fin,
      activo.tipo_personal AS rol_actual
    FROM contratos c
    JOIN personal p ON c.id_personal = p.id
    JOIN historial_roles hr ON c.id_historial_rol = hr.id
    LEFT JOIN turnos t ON c.id_turno = t.id
    LEFT JOIN LATERAL (
      SELECT tipo_personal
      FROM historial_roles
      WHERE id_personal = p.id AND estado = 'activo'
      LIMIT 1
    ) activo ON true
    WHERE c.gestion = $1
      AND ($2::text IS NULL OR hr.tipo_personal = $2::text)
      AND ($3::text IS NULL OR c.sucursal = $3::text)
    ORDER BY p.apellidop, p.apellidom, p.nombres, c.fecha_inicio DESC;
      `,
      [gestion, rol || null, sucursal || null]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al filtrar personal:", error);
    res.status(500).json({ success: false, message: "Error en el servidor." });
  }
});

module.exports = router;
