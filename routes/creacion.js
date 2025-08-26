const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Obtener todos los tipos de productos
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM tipos_producto ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tipos de producto" });
  }
});

// Crear nuevo tipo de producto
router.post("/", async (req, res) => {
  const { nombre, descripcion } = req.body;
  const nombreCapitalizado =
    nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();

  try {
    // Evitar nombres reservados
    const reservados = ["libros", "uniformes", "libro", "uniforme"];
    if (reservados.includes(nombre.toLowerCase())) {
      return res.status(400).json({
        error:
          "Ese nombre está reservado y no se puede usar como tipo de producto",
      });
    }

    const check = await pool.query(
      `SELECT * FROM tipos_producto WHERE LOWER(nombre) = LOWER($1)`,
      [nombre]
    );
    if (check.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Ya existe un tipo de producto con ese nombre" });
    }

    const result = await pool.query(
      `INSERT INTO tipos_producto (nombre, descripcion) VALUES ($1, $2) RETURNING *`,
      [nombreCapitalizado, descripcion || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al crear tipo de producto" });
  }
});

// Editar tipo de producto
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  const nombreCapitalizado =
    nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
  const nombreMinuscula = nombre.toLowerCase();

  const reservados = ["libros", "uniformes", "libro", "uniforme"];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Obtener tipo actual
    const actual = await client.query(
      `SELECT * FROM tipos_producto WHERE id = $1`,
      [id]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Tipo de producto no encontrado" });
    }

    const nombreActualCapitalizado = actual.rows[0].nombre;
    const nombreActualMinuscula = nombreActualCapitalizado.toLowerCase();

    // Validar nombres reservados
    if (
      reservados.includes(nombreMinuscula) &&
      nombreMinuscula !== nombreActualMinuscula
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error:
          "Ese nombre está reservado y no se puede usar como tipo de producto",
      });
    }

    // Validar duplicados
    const check = await client.query(
      `SELECT * FROM tipos_producto WHERE LOWER(nombre) = LOWER($1) AND id != $2`,
      [nombre, id]
    );
    if (check.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Ya existe un tipo de producto con ese nombre",
      });
    }

    // Actualizar en tipos_producto
    const result = await client.query(
      `UPDATE tipos_producto 
       SET nombre = $1, descripcion = $2 
       WHERE id = $3 
       RETURNING *`,
      [nombreCapitalizado, descripcion || null, id]
    );

    // Solo actualizar productos si el nombre cambió
    if (nombreMinuscula !== nombreActualMinuscula) {
      await client.query(
        `UPDATE productos 
         SET tipo = $1 
         WHERE LOWER(tipo) = $2`,
        [nombreMinuscula, nombreActualMinuscula]
      );
    }

    await client.query("COMMIT");

    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al editar tipo de producto" });
  } finally {
    client.release();
  }
});

// Eliminar tipo de producto (si no está en uso y no es tipo principal)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const tipo = await pool.query(
      `SELECT * FROM tipos_producto WHERE id = $1`,
      [id]
    );
    if (tipo.rows.length === 0)
      return res.status(404).json({ error: "Tipo no encontrado" });

    const nombre = tipo.rows[0].nombre;
    const nombreMinuscula = nombre.toLowerCase();

    // Proteger tipos principales
    if (["Libros", "Uniformes"].includes(nombre)) {
      return res.status(403).json({
        error: "Este tipo de producto no se puede eliminar (es principal)",
      });
    }

    const productos = await pool.query(
      `SELECT * FROM productos WHERE LOWER(tipo) = $1`,
      [nombreMinuscula]
    );

    if (productos.rows.length > 0) {
      return res.status(400).json({
        error: "No se puede eliminar: hay productos usando este tipo",
      });
    }

    await pool.query(`DELETE FROM tipos_producto WHERE id = $1`, [id]);
    res.json({ mensaje: "Tipo de producto eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar tipo de producto" });
  }
});

// Obtener tipos con campo "eliminable" (si no hay productos usándolo)
router.get("/verificables", async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT tp.*,
        NOT EXISTS (
            SELECT 1 FROM productos p
            WHERE LOWER(p.tipo) = LOWER(tp.nombre)
            OR LOWER(p.tipo) = LOWER(TRIM(TRAILING 's' FROM tp.nombre))
        ) AS eliminable
        FROM tipos_producto tp
        ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al verificar tipos" });
  }
});

module.exports = router;
