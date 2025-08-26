const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//CREAR TARIFA
router.post("/", async (req, res) => {
  const { inscripcion_id, costo_matricula, costo_mensualidad } = req.body;

  if (!inscripcion_id || !costo_matricula || !costo_mensualidad) {
    return res.status(400).json({ message: "Faltan datos requeridos." });
  }

  try {
    const existe = await pool.query(
      "SELECT * FROM tarifas_personalizadas WHERE inscripcion_id = $1",
      [inscripcion_id]
    );

    if (existe.rows.length > 0) {
      return res
        .status(409)
        .json({
          message: "Ya existe una tarifa personalizada para esta inscripción.",
        });
    }

    await pool.query(
      "INSERT INTO tarifas_personalizadas (inscripcion_id, costo_matricula, costo_mensualidad) VALUES ($1, $2, $3)",
      [inscripcion_id, costo_matricula, costo_mensualidad]
    );

    res
      .status(201)
      .json({ message: "Tarifa personalizada registrada correctamente." });
  } catch (error) {
    console.error("Error al crear tarifa personalizada:", error);
    res.status(500).json({ message: "Error del servidor." });
  }
});

//EDITAR TARIFA
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { costo_matricula, costo_mensualidad } = req.body;

  if (!costo_matricula || !costo_mensualidad) {
    return res.status(400).json({ message: "Faltan datos requeridos." });
  }

  try {
    await pool.query(
      "UPDATE tarifas_personalizadas SET costo_matricula = $1, costo_mensualidad = $2 WHERE id = $3",
      [costo_matricula, costo_mensualidad, id]
    );

    res
      .status(200)
      .json({ message: "Tarifa personalizada actualizada correctamente." });
  } catch (error) {
    console.error("Error al editar tarifa personalizada:", error);
    res.status(500).json({ message: "Error al editar tarifa personalizada." });
  }
});

//ELIMINAR TARIFA
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM tarifas_personalizadas WHERE id = $1", [id]);
    res
      .status(200)
      .json({ message: "Tarifa personalizada eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar tarifa personalizada:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar tarifa personalizada." });
  }
});

module.exports = router;
