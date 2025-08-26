const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middlewares/auth");
const router = express.Router();

//Buscar Estudiante por CI o Nombre
router.get("/buscar-estudiante", authMiddleware, async (req, res) => {
  const { query, sucursal } = req.query;
  const gestionActual = new Date().getFullYear();

  if (!query || !sucursal) {
    return res.status(400).json({
      error: "Parámetros incompletos: query y sucursal son requeridos",
    });
  }

  try {
    const sucursalSeleccionada = sucursal.toString().toLowerCase();
    let sqlSucursalFilter = "";
    const params = [gestionActual];

    if (sucursalSeleccionada === "primaria") {
      sqlSucursalFilter = `i.sucursal = $2`;
      params.push("Primaria");
    } else {
      // Secundaria busca en ambas
      sqlSucursalFilter = `(i.sucursal = 'Primaria' OR i.sucursal = 'Secundaria')`;
    }

    // Parámetro de búsqueda
    params.push(`%${query}%`);
    const paramBusquedaIndex = params.length;

    const result = await pool.query(
      `SELECT e.id, e.nombre, e.apellidop, e.apellidom, e.carnet_identidad,
              i.id AS inscripcion_id, i.curso, i.sucursal
       FROM estudiantes e
       JOIN inscripciones i ON i.estudiante_id = e.id
       WHERE i.gestion = $1 AND i.estado = 'Activo'
         AND ${sqlSucursalFilter}
         AND (
           e.carnet_identidad ILIKE $${paramBusquedaIndex} OR
           CONCAT(e.nombre, ' ', e.apellidop, ' ', e.apellidom) ILIKE $${paramBusquedaIndex}
         )
       LIMIT 10`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al buscar estudiante:", error);
    res.status(500).json({ error: "Error al buscar estudiante" });
  }
});

//Lista de Productos Activos por Sucursal
router.get("/productos", async (req, res) => {
  const { sucursal } = req.query;

  if (!sucursal) {
    return res.status(400).json({ error: "Sucursal es requerida" });
  }

  try {
    const result = await pool.query(
      `SELECT 
         p.*,
         m.nombre AS materia_nombre
       FROM productos p
       LEFT JOIN materias m ON p.materia_id = m.id
       WHERE p.activo = true AND (p.sucursal = $1 OR p.sucursal IS NULL)
       ORDER BY p.tipo, p.nombre`,
      [sucursal]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar productos:", error);
    res.status(500).json({ error: "Error al listar productos" });
  }
});

//Registrar compra, detalle y pago
router.post("/registrar", async (req, res) => {
  const { inscripcion_id, productos, pago } = req.body;
  const client = await pool.connect();

  if (!inscripcion_id || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    await client.query("BEGIN");

    // Validar inscripcion
    const insc = await client.query(
      `SELECT * FROM inscripciones WHERE id = $1 AND estado = 'Activo'`,
      [inscripcion_id]
    );
    if (insc.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Inscripción no válida" });
    }

    // Crear compra
    const compra = await client.query(
      `INSERT INTO compras (inscripcion_id) VALUES ($1) RETURNING id`,
      [inscripcion_id]
    );
    const compra_id = compra.rows[0].id;

    // Insertar detalles
    for (const prod of productos) {
      // Validar producto activo
      const prodCheck = await client.query(
        `SELECT * FROM productos WHERE id = $1 AND activo = true`,
        [prod.producto_id]
      );
      if (prodCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: `Producto no válido: ${prod.producto_id}` });
      }

      await client.query(
        `INSERT INTO compras_detalle (compra_id, producto_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [compra_id, prod.producto_id, prod.cantidad, prod.precio_unitario]
      );
    }

    // Registrar pago si existe
    if (pago && pago.monto > 0) {
      await client.query(
        `INSERT INTO pagos_compra (compra_id, monto, metodo_pago, observacion)
         VALUES ($1, $2, $3, $4)`,
        [
          compra_id,
          pago.monto,
          pago.metodo_pago || null,
          pago.observacion || null,
        ]
      );

      // Calcular total compra
      const totalCompra = productos.reduce(
        (sum, p) => sum + p.cantidad * p.precio_unitario,
        0
      );

      // Estado de compra
      let estado = "Pendiente";
      if (pago.monto >= totalCompra) {
        estado = "Pagado";
      } else if (pago.monto > 0) {
        estado = "Parcial";
      }

      await client.query(`UPDATE compras SET estado = $1 WHERE id = $2`, [
        estado,
        compra_id,
      ]);
    }

    await client.query("COMMIT");
    res.json({ mensaje: "Compra registrada correctamente", compra_id });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar compra:", error);
    res.status(500).json({ error: "Error al registrar compra" });
  } finally {
    client.release();
  }
});

//Registrar pagos
router.post("/registrar-pago", async (req, res) => {
  const { compra_id, monto, metodo_pago, observacion, operador } = req.body;
  const client = await pool.connect();

  if (!compra_id || !monto || monto <= 0 || !operador) {
    return res
      .status(400)
      .json({ error: "Datos de pago incompletos o inválidos" });
  }

  try {
    await client.query("BEGIN");

    // Insertar pago
    await client.query(
      `INSERT INTO pagos_compra (compra_id, monto, metodo_pago, observacion, operador)
       VALUES ($1, $2, $3, $4, $5)`,
      [compra_id, monto, metodo_pago, observacion, operador]
    );

    // Calcular total pagado
    const pagos = await client.query(
      `SELECT SUM(monto) AS total_pagado FROM pagos_compra WHERE compra_id = $1`,
      [compra_id]
    );
    const totalPagado = Number(pagos.rows[0].total_pagado) || 0;

    // Calcular total de la compra
    const detalles = await client.query(
      `SELECT SUM(cantidad * precio_unitario) AS total_compra
       FROM compras_detalle WHERE compra_id = $1`,
      [compra_id]
    );
    const totalCompra = Number(detalles.rows[0].total_compra) || 0;

    // Determinar nuevo estado
    let estado = "Pendiente";
    if (totalPagado >= totalCompra) {
      estado = "Pagado";
    } else if (totalPagado > 0) {
      estado = "Parcial";
    }

    await client.query(`UPDATE compras SET estado = $1 WHERE id = $2`, [
      estado,
      compra_id,
    ]);

    await client.query("COMMIT");
    res.json({ mensaje: "Pago registrado correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar pago:", error);
    res.status(500).json({ error: "Error al registrar pago" });
  } finally {
    client.release();
  }
});

module.exports = router;
