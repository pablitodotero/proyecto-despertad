const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Obtener todos los turnos
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, hora_inicio, hora_fin FROM turnos ORDER BY id"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener turnos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener turnos." });
  }
});

module.exports = router;
