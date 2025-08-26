const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.post("/", async (req, res) => {
  const { estudiante_id, gestion, sucursal, curso } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO inscripciones (estudiante_id, gestion, sucursal, curso)
         VALUES ($1, $2, $3, $4) RETURNING *`,
      [estudiante_id, gestion, sucursal, curso]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error al registrar inscripción:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// GET /api/inscripciones/con-estudiantes
router.get("/con-estudiantes", async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT 
          e.*, 
          json_agg(json_build_object('gestion', i.gestion, 'sucursal', i.sucursal, 'curso', i.curso)) AS inscripciones
        FROM estudiantes e
        JOIN inscripciones i ON e.id = i.estudiante_id
        GROUP BY e.id
      `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener estudiantes con inscripciones:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.put("/update-curso", async (req, res) => {
  const { estudiante_id, gestion, curso } = req.body;

  try {
    const result = await pool.query(
      `UPDATE inscripciones SET curso = $1
         WHERE estudiante_id = $2 AND gestion = $3 RETURNING *`,
      [curso, estudiante_id, gestion]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Inscripción no encontrada" });
    }

    res.json({
      message: "Curso actualizado correctamente",
      inscripcion: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error al actualizar el curso:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

module.exports = router;
