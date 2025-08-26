const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Obtener todos los cursos
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, nivel FROM cursos ORDER BY nombre"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener cursos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener cursos." });
  }
});

module.exports = router;
