const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Obtener todas las materias solo con estado Activo
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, nivel FROM materias WHERE estado = 'activo' ORDER BY nombre"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener materias:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener materias." });
  }
});

// Crear materia
router.post("/", async (req, res) => {
  const { nombre, nivel } = req.body;

  try {
    const exists = await pool.query(
      "SELECT * FROM materias WHERE LOWER(nombre) = LOWER($1) AND nivel = $2",
      [nombre.trim(), nivel]
    );

    if (exists.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "La materia ya existe con ese nombre y nivel." });
    }

    await pool.query(
      "INSERT INTO materias (nombre, nivel, estado) VALUES ($1, $2, $3)",
      [nombre.trim(), nivel, "activo"]
    );

    res.status(201).json({ message: "Materia creada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear materia." });
  }
});

// Obtener lista de materias
router.get("/lista", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM materias ORDER BY nivel, estado DESC, nombre"
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener materias." });
  }
});

// Cambiar estado
router.put("/:id/estado", async (req, res) => {
  const { id } = req.params;

  try {
    const materia = await pool.query(
      "SELECT estado FROM materias WHERE id = $1",
      [id]
    );

    if (materia.rows.length === 0) {
      return res.status(404).json({ message: "Materia no encontrada." });
    }

    const nuevoEstado =
      materia.rows[0].estado === "activo" ? "inactivo" : "activo";

    await pool.query("UPDATE materias SET estado = $1 WHERE id = $2", [
      nuevoEstado,
      id,
    ]);

    res.json({ message: `Materia actualizada a estado ${nuevoEstado}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al cambiar estado." });
  }
});

// Eliminar materia solo si no está siendo usada en horarios_profesor
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si está en uso en horarios_profesor
    const usoHorarios = await pool.query(
      "SELECT COUNT(*) FROM horarios_profesor WHERE id_materia = $1",
      [id]
    );

    if (parseInt(usoHorarios.rows[0].count) > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar: la materia está en uso en horarios de profesores.",
      });
    }

    // Verificar si está en uso en productos (solo libros)
    const usoProductos = await pool.query(
      "SELECT COUNT(*) FROM productos WHERE materia_id = $1",
      [id]
    );

    if (parseInt(usoProductos.rows[0].count) > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar: la materia está asociada a productos (libros).",
      });
    }

    // Si no está en uso, eliminar
    await pool.query("DELETE FROM materias WHERE id = $1", [id]);
    res.json({ message: "Materia eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar la materia:", error);
    res.status(500).json({ message: "Error al eliminar la materia." });
  }
});

// Obtener IDs de materias que no están en uso en horarios_profesor
router.get("/no-en-uso", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id
      FROM materias
      WHERE id NOT IN (
        SELECT DISTINCT id_materia FROM horarios_profesor WHERE id_materia IS NOT NULL
      )
      AND id NOT IN (
        SELECT DISTINCT materia_id FROM productos WHERE materia_id IS NOT NULL
      )
    `);
    res.json(result.rows.map((row) => row.id)); // solo IDs
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al verificar materias no usadas." });
  }
});

//Editar Materia
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  try {
    if (!nombre || nombre.trim() === "") {
      return res
        .status(400)
        .json({ message: "El nombre no puede estar vacío." });
    }

    // Obtener nivel de la materia actual
    const actual = await pool.query(
      "SELECT nivel FROM materias WHERE id = $1",
      [id]
    );
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: "Materia no encontrada." });
    }

    const nivel = actual.rows[0].nivel;

    // Verificar duplicado en ese mismo nivel
    const existe = await pool.query(
      "SELECT * FROM materias WHERE LOWER(nombre) = LOWER($1) AND nivel = $2 AND id != $3",
      [nombre.trim(), nivel, id]
    );

    if (existe.rows.length > 0) {
      return res.status(400).json({
        message: "Ya existe una materia con ese nombre en este nivel.",
      });
    }

    // Actualizar
    await pool.query("UPDATE materias SET nombre = $1 WHERE id = $2", [
      nombre.trim(),
      id,
    ]);

    res.json({ message: "Materia actualizada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar materia." });
  }
});

//Obtener materias por nivel y activos
router.get("/nivel", async (req, res) => {
  const { nivel } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM materias WHERE nivel = $1 AND estado = 'activo' ORDER BY nombre`,
      [nivel]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener materias por nivel:", error);
    res.status(500).json({ error: "Error al obtener materias" });
  }
});

module.exports = router;
