const express = require("express");
const pool = require("../config/db");

const router = express.Router();
const controller = require("../controllers/tarifasController");

//VER LA TARIFA DEPENDIENDO AL CURSO, SUCURSAL Y GESTION
router.get("/", async (req, res) => {
  const { gestion, curso, sucursal } = req.query;

  try {
    if (!gestion || !curso || !sucursal) {
      return res.status(400).json({ error: "Faltan parámetros." });
    }

    const result = await pool.query(
      `
      SELECT t.costo_matricula, t.costo_mensualidad
      FROM cursos_tarifarios ct
      JOIN tarifas t ON t.grupo_tarifa_id = ct.grupo_tarifa_id
      WHERE ct.nombre_curso = $1
        AND ct.sucursal = $2
        AND t.gestion = $3
      LIMIT 1
      `,
      [curso, sucursal, gestion]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res
        .status(404)
        .json({ error: "No se encontró tarifa para ese curso y año." });
    }
  } catch (error) {
    console.error("Error al obtener tarifa específica:", error);
    res.status(500).json({ error: "Error interno al buscar tarifa." });
  }
});

//VER SI TIENE DEUDAS
router.get("/:estudianteId/verificar-deudas", controller.verificarDeudas);

module.exports = router;
