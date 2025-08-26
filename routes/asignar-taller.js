const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//Obtener talleres y ciclos activos (gestión-nivel)
router.get("/inscripcion/talleres", async (req, res) => {
  const { gestion, nivel } = req.query;

  if (!gestion || !nivel) {
    return res.status(400).json({ message: "Se requiere gestión y nivel." });
  }

  try {
    const talleresRes = await pool.query(
      `SELECT * FROM talleres WHERE nivel = $1 ORDER BY nombre`,
      [nivel]
    );

    const talleres = await Promise.all(
      talleresRes.rows.map(async (taller) => {
        const ciclosRes = await pool.query(
          `SELECT * FROM taller_fechas 
           WHERE taller_id = $1 AND gestion = $2 AND estado = 'Activo'
           ORDER BY fecha_inicio`,
          [taller.id, gestion]
        );

        const ciclos = await Promise.all(
          ciclosRes.rows.map(async (ciclo) => {
            const preciosRes = await pool.query(
              `SELECT * FROM taller_fechas_precios 
               WHERE taller_fecha_id = $1 
               ORDER BY mes`,
              [ciclo.id]
            );
            return { ...ciclo, precios: preciosRes.rows };
          })
        );

        return { ...taller, ciclos };
      })
    );

    res.json(talleres);
  } catch (err) {
    console.error("Error al obtener talleres:", err);
    res.status(500).json({ message: "Error al obtener talleres" });
  }
});

//Buscar estudiante y validarlo
router.get("/inscripcion/estudiante", async (req, res) => {
  const { ci, gestion, nivel } = req.query;

  if (!ci || !gestion || !nivel) {
    return res.status(400).json({ message: "Faltan datos de búsqueda." });
  }

  try {
    const estRes = await pool.query(
      `SELECT * FROM estudiantes WHERE carnet_identidad = $1`,
      [ci]
    );

    if (estRes.rowCount === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado." });
    }

    const estudiante = estRes.rows[0];

    const inscRes = await pool.query(
      `SELECT * FROM inscripciones 
       WHERE estudiante_id = $1 AND gestion = $2 AND sucursal = $3 AND estado = 'Activo'`,
      [estudiante.id, gestion, nivel]
    );

    if (inscRes.rowCount === 0) {
      return res.status(400).json({
        message:
          "El estudiante no tiene inscripción activa en la gestión y sucursal seleccionada.",
      });
    }

    res.json({
      estudiante,
      inscripcion: inscRes.rows[0],
    });
  } catch (err) {
    console.error("Error al buscar estudiante:", err);
    res.status(500).json({ message: "Error al buscar estudiante" });
  }
});

//Registrar inscripción de un ciclo
router.post("/inscripcion/registrar", async (req, res) => {
  const { ciclo_id, estudiante_id } = req.body;

  if (!ciclo_id || !estudiante_id) {
    return res.status(400).json({ message: "Faltan datos de inscripción." });
  }

  try {
    // Verificar duplicado
    const dupRes = await pool.query(
      `SELECT * FROM taller_inscripciones 
       WHERE taller_fecha_id = $1 AND estudiante_id = $2`,
      [ciclo_id, estudiante_id]
    );

    if (dupRes.rowCount > 0) {
      return res
        .status(400)
        .json({ message: "El estudiante ya está inscrito en este ciclo." });
    }

    await pool.query(
      `INSERT INTO taller_inscripciones (taller_fecha_id, estudiante_id) 
       VALUES ($1, $2)`,
      [ciclo_id, estudiante_id]
    );

    res.json({ message: "Estudiante inscrito correctamente." });
  } catch (err) {
    console.error("Error al registrar inscripción:", err);
    res.status(500).json({ message: "Error al registrar inscripción" });
  }
});

module.exports = router;
