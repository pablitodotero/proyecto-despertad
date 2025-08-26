const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//Crear Producto
router.post("/crear", async (req, res) => {
  const {
    tipo,
    nombre,
    descripcion,
    curso,
    sucursal,
    materia_id,
    talla,
    activo,
    precio,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insert = await client.query(
      `INSERT INTO productos (
         tipo, nombre, descripcion, curso, sucursal,
         materia_id, talla, activo, precio
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true), $9)
       RETURNING id`,
      [
        tipo,
        nombre,
        descripcion,
        curso || null,
        sucursal || null,
        materia_id || null,
        talla || null,
        activo,
        precio,
      ]
    );

    const nuevoId = insert.rows[0].id;

    // Insertar en historial
    await client.query(
      `INSERT INTO historial_precios (producto_id, precio, operacion)
       VALUES ($1, $2, 'creacion')`,
      [nuevoId, precio]
    );

    await client.query("COMMIT");
    res.status(201).json({ mensaje: "Producto registrado correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear producto:", error);
    res.status(500).json({ error: "Error al crear producto" });
  } finally {
    client.release();
  }
});

//Listar Tipo Productos Dinámicos
router.get("/tipos-otros", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT nombre FROM tipos_producto
      WHERE LOWER(nombre) NOT IN ('libros', 'uniformes')
      ORDER BY LOWER(nombre)
    `);
    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al listar tipos_producto:", error);
    res.status(500).json({ error: "Error al obtener tipos de producto" });
  }
});

//Listar productos
router.get("/listar", async (req, res) => {
  const { tipo, sucursal, curso, activo } = req.query;

  let condiciones = [];
  let valores = [];
  let i = 1;

  if (tipo) {
    condiciones.push(`p.tipo = $${i++}`);
    valores.push(tipo);
  }
  if (sucursal) {
    condiciones.push(`p.sucursal = $${i++}`);
    valores.push(sucursal);
  }
  if (curso) {
    condiciones.push(`p.curso = $${i++}`);
    valores.push(curso);
  }
  if (activo !== undefined) {
    condiciones.push(`p.activo = $${i++}`);
    valores.push(activo === "true");
  }

  const where =
    condiciones.length > 0 ? "WHERE " + condiciones.join(" AND ") : "";

  try {
    const result = await pool.query(
      `SELECT p.*, m.nombre AS materia_nombre,
              (SELECT COUNT(*) FROM compras_detalle cd
               WHERE cd.producto_id = p.id) > 0 AS usado
       FROM productos p
       LEFT JOIN materias m ON p.materia_id = m.id
       ${where}
       ORDER BY p.tipo, p.nombre`,
      valores
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar productos:", error);
    res.status(500).json({ error: "Error al listar productos" });
  }
});

//Cambiar estado del producto
router.put("/cambiar-estado/:id", async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  try {
    const result = await pool.query(
      `UPDATE productos SET activo = $1 WHERE id = $2 RETURNING *`,
      [activo, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al cambiar estado de producto:", error);
    res.status(500).json({ error: "Error al cambiar estado" });
  }
});

//Eliminar producto
router.delete("/eliminar/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // Verificar si el producto está relacionado en compras
    const check = await client.query(
      `SELECT 1 FROM compras_detalle WHERE producto_id = $1 LIMIT 1`,
      [id]
    );

    if (check.rowCount > 0) {
      return res
        .status(400)
        .json({ error: "No se puede eliminar, el producto ya fue adquirido." });
    }

    // Eliminar producto
    await client.query(`DELETE FROM productos WHERE id = $1`, [id]);

    res.json({ mensaje: "Producto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.status(500).json({ error: "Error al eliminar producto." });
  } finally {
    client.release();
  }
});

//Editar
router.put("/editar/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  const client = await pool.connect();

  try {
    // Validar existencia del producto
    const result = await client.query(
      `SELECT id FROM productos WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Actualizar nombre y descripción
    await client.query(
      `UPDATE productos SET nombre = $1, descripcion = $2 WHERE id = $3`,
      [nombre, descripcion, id]
    );

    res.json({ mensaje: "Producto actualizado correctamente" });
  } catch (error) {
    console.error("Error al editar producto:", error);
    res.status(500).json({ error: "Error al editar producto" });
  } finally {
    client.release();
  }
});

//Historial de Precios
router.get("/historial-precios/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT precio, fecha AS fecha_registro, operacion
      FROM historial_precios
      WHERE producto_id = $1
      ORDER BY fecha DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener historial de precios:", error);
    res.status(500).json({ error: "Error al obtener historial de precios" });
  }
});

//Cambiar Precio
router.put("/cambiar-precio/:id", async (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Obtener el precio actual
    const current = await client.query(
      `SELECT precio FROM productos WHERE id = $1`,
      [id]
    );

    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    const precioActual = current.rows[0].precio;

    // Comparar
    if (Number(precioActual) === Number(precio)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error:
          "El nuevo precio es igual al actual. No se realizó ningún cambio.",
      });
    }

    // Actualizar el precio
    await client.query(`UPDATE productos SET precio = $1 WHERE id = $2`, [
      precio,
      id,
    ]);

    // Insertar en historial
    await client.query(
      `INSERT INTO historial_precios (producto_id, precio, operacion)
       VALUES ($1, $2, 'cambio')`,
      [id, precio]
    );

    await client.query("COMMIT");
    res.json({ mensaje: "Precio actualizado correctamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al cambiar precio:", error);
    res.status(500).json({ error: "Error al cambiar precio." });
  } finally {
    client.release();
  }
});

module.exports = router;
