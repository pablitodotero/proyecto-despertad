const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Registrar relación estudiante-encargado
router.post("/", async (req, res) => {
  const { estudiante_id, encargado_id, parentesco } = req.body;
  try {
    await pool.query(
      "INSERT INTO estudiantes_encargados (estudiante_id, encargado_id, parentesco) VALUES ($1, $2, $3)",
      [estudiante_id, encargado_id, parentesco]
    );
    res.json({ message: "Relación registrada exitosamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar relación" });
  }
});

//PRUEBA VISTA EDITAR ENCARGADO EXISTENTE
router.get("/todos", async (req, res) => {
  try {
    const encargados = await pool.query(
      `SELECT id, nombre, apellidop, apellidom, carnet_identidad, genero, celular, correo FROM encargados`
    );
    res.json(encargados.rows);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error obteniendo la lista de encargados" });
  }
});

// Obtener los encargados de un estudiante por su ID (PARA VER)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const encargados = await pool.query(
      `SELECT e.id, e.nombre, e.apellidop, e.apellidom, e.carnet_identidad, e.celular, e.correo, e.genero, ee.parentesco 
           FROM encargados e 
           JOIN estudiantes_encargados ee ON e.id = ee.encargado_id 
           WHERE ee.estudiante_id = $1`,
      [id]
    );
    res.json(encargados.rows);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error obteniendo los encargados del estudiante" });
  }
});

// Actualizar los datos de un encargado y su parentesco //RETURNING *`,
router.put("/encargado/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellidop,
      apellidom,
      carnet_identidad,
      celular,
      correo,
      parentesco,
      estudiante_id,
    } = req.body;

    // Actualizar datos del encargado
    const resultEncargado = await pool.query(
      `UPDATE encargados SET nombre = $1, apellidop = $2, apellidom = $3, 
           carnet_identidad = $4, celular = $5, correo = $6 WHERE id = $7 RETURNING *`,
      [nombre, apellidop, apellidom, carnet_identidad, celular, correo, id]
    );

    if (resultEncargado.rowCount === 0) {
      return res.status(404).json({ message: "Encargado no encontrado" });
    }

    // Actualizar el parentesco en la tabla de relación estudiantes_encargados
    await pool.query(
      `UPDATE estudiantes_encargados SET parentesco = $1 WHERE estudiante_id = $2 AND encargado_id = $3`,
      [parentesco, estudiante_id, id]
    );

    res.json({
      message: "Encargado actualizado correctamente",
      encargado: resultEncargado.rows[0],
      parentesco,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error actualizando el encargado" });
  }
});

// Eliminar la relación de un encargado con un estudiante y, si no tiene más relaciones, eliminar al encargado (En vista Editar)
router.delete("/encargado/:estudiante_id/:encargado_id", async (req, res) => {
  try {
    const { estudiante_id, encargado_id } = req.params;

    // Eliminar la relación en la tabla estudiantes_encargados
    await pool.query(
      `DELETE FROM estudiantes_encargados WHERE estudiante_id = $1 AND encargado_id = $2`,
      [estudiante_id, encargado_id]
    );

    // Verificar si el encargado sigue teniendo otras relaciones
    const relacionRestante = await pool.query(
      `SELECT COUNT(*) FROM estudiantes_encargados WHERE encargado_id = $1`,
      [encargado_id]
    );

    if (parseInt(relacionRestante.rows[0].count) === 0) {
      // No tiene más relaciones, eliminar al encargado
      await pool.query(`DELETE FROM encargados WHERE id = $1`, [encargado_id]);
    }

    res.json({ message: "Encargado eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error eliminando el encargado" });
  }
});

// Registrar una nueva relación entre estudiante y encargado
router.post("/asignar", async (req, res) => {
  try {
    const { estudiante_id, encargado_id, parentesco } = req.body;

    // Verificar si la relación ya existe
    const existeRelacion = await pool.query(
      `SELECT * FROM estudiantes_encargados WHERE estudiante_id = $1 AND encargado_id = $2`,
      [estudiante_id, encargado_id]
    );

    if (existeRelacion.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "El encargado ya está asignado a este estudiante" });
    }

    // Insertar la nueva relación
    await pool.query(
      `INSERT INTO estudiantes_encargados (estudiante_id, encargado_id, parentesco) VALUES ($1, $2, $3)`,
      [estudiante_id, encargado_id, parentesco]
    );

    res.json({ message: "Encargado asignado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error asignando el encargado" });
  }
});

module.exports = router;
