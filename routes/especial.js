const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//Crear caso especial y eliminar tarifa personalizada (si aplica)
router.post("/mensualidades/especial", async (req, res) => {
  const { inscripcion_id, mes_inicio, mes_fin, mensualidades } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Actualizar la inscripción con mes_inicio y mes_fin
    await client.query(
      `
      UPDATE inscripciones
      SET mes_inicio = $1, mes_fin = $2
      WHERE id = $3
    `,
      [mes_inicio, mes_fin, inscripcion_id]
    );

    // 2. Eliminar tarifa personalizada si existe
    await client.query(
      `
      DELETE FROM tarifas_personalizadas
      WHERE inscripcion_id = $1
    `,
      [inscripcion_id]
    );

    // 3. Eliminar mensualidades anteriores si ya había algo
    await client.query(
      `
      DELETE FROM mensualidades_personalizadas
      WHERE inscripcion_id = $1
    `,
      [inscripcion_id]
    );

    // 4. Insertar mensualidades nuevas
    for (const mensualidad of mensualidades) {
      const { concepto, monto } = mensualidad;

      await client.query(
        `
        INSERT INTO mensualidades_personalizadas (inscripcion_id, concepto, monto)
        VALUES ($1, $2, $3)
      `,
        [inscripcion_id, concepto, monto]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Caso especial registrado con éxito." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar caso especial:", error);
    res.status(500).json({ error: "Error al registrar el caso especial." });
  } finally {
    client.release();
  }
});

// Eliminar caso especial completamente
router.delete("/mensualidades/especial/:id", async (req, res) => {
  const inscripcion_id = req.params.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Eliminar mensualidades personalizadas
    await client.query(
      `
      DELETE FROM mensualidades_personalizadas
      WHERE inscripcion_id = $1
    `,
      [inscripcion_id]
    );

    // 2. Quitar mes_inicio y mes_fin de la inscripción
    await client.query(
      `
      UPDATE inscripciones
      SET mes_inicio = NULL, mes_fin = NULL
      WHERE id = $1
    `,
      [inscripcion_id]
    );

    await client.query("COMMIT");
    res.status(200).json({ message: "Caso especial eliminado correctamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar caso especial:", error);
    res.status(500).json({ error: "Error al eliminar el caso especial." });
  } finally {
    client.release();
  }
});

module.exports = router;
