const express = require("express");
const pool = require("../config/db");
const router = express.Router();

//TARIFA DEL AÑO ACTUAL DEFINIDA
router.get("/verificar/:gestion", async (req, res) => {
  const { gestion } = req.params;
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM tarifas WHERE gestion = $1",
      [gestion]
    );
    const yaDefinidas = parseInt(result.rows[0].count) >= 3; 
    res.json({ yaDefinidas });
  } catch (error) {
    console.error("Error al verificar tarifas:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

//REGISTRAR TARIFA DEL AÑO ACTUAL
router.post("/registrar", async (req, res) => {
  const { gestion, tarifas } = req.body;

  if (!gestion || !Array.isArray(tarifas) || tarifas.length !== 3) {
    return res.status(400).json({ error: "Datos incompletos o inválidos." });
  }

  try {
    const existing = await pool.query(
      "SELECT COUNT(*) FROM tarifas WHERE gestion = $1",
      [gestion]
    );
    if (parseInt(existing.rows[0].count) > 0) {
      return res
        .status(400)
        .json({ error: "Las tarifas ya están definidas para esta gestión." });
    }

    const insertPromises = tarifas.map((t) =>
      pool.query(
        `INSERT INTO tarifas (gestion, grupo_tarifa_id, costo_matricula, costo_mensualidad) 
           VALUES ($1, $2, $3, $4)`,
        [gestion, t.grupoTarifaId, t.costoMatricula, t.costoMensualidad]
      )
    );

    await Promise.all(insertPromises);
    res.json({ success: true, message: "Tarifas registradas correctamente." });
  } catch (error) {
    console.error("Error al registrar tarifas:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

//HISTORIAL DE TARIFAS
router.get("/historial", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.gestion, g.nombre AS nombre, t.costo_matricula, t.costo_mensualidad 
         FROM tarifas t 
         JOIN grupos_tarifas g ON t.grupo_tarifa_id = g.id 
         ORDER BY t.gestion DESC, g.nombre`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener historial de tarifas:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

//OBTENER TARIFAS GESTION ANTERIOR
router.get("/tarifas-anteriores/:gestion", async (req, res) => {
  const { gestion } = req.params;
  try {
    const gestionAnterior = parseInt(gestion) - 1;
    const result = await pool.query(
      `SELECT t.grupo_tarifa_id, t.costo_matricula, t.costo_mensualidad 
         FROM tarifas t 
         WHERE t.gestion = $1`,
      [gestionAnterior]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener tarifas anteriores:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

module.exports = router;
