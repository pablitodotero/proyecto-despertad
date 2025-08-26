const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Obtener todos los encargados
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM encargados");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Registrar un nuevo encargado
router.post("/", async (req, res) => {
  const {
    nombre,
    apellidop,
    apellidom,
    carnet_identidad,
    celular,
    correo,
    genero,
  } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO encargados (nombre, apellidop, apellidom, carnet_identidad, celular, correo, genero) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [nombre, apellidop, apellidom, carnet_identidad, celular, correo, genero]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al registrar encargado" });
  }
});

// Verificar si el Carnet de Identidad ya existe
router.get("/verificar-ci/:carnet_identidad", async (req, res) => {
  const { carnet_identidad } = req.params;
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM encargados WHERE carnet_identidad = $1",
      [carnet_identidad]
    );
    res.json({ existe: result.rows[0].count > 0 });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al verificar el Carnet de Identidad" });
  }
});

// Crear un nuevo encargado y asignarlo a un estudiante con su parentesco
router.post("/crear", async (req, res) => {
  try {
    const {
      nombre,
      apellidop,
      apellidom,
      carnet_identidad,
      celular,
      correo,
      genero,
      parentesco,
      estudiante_id,
    } = req.body;

    // Insertar el nuevo encargado
    const resultEncargado = await pool.query(
      `INSERT INTO encargados (nombre, apellidop, apellidom, carnet_identidad, celular, correo, genero) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, apellidop, apellidom, carnet_identidad, celular, correo, genero]
    );

    const nuevoEncargado = resultEncargado.rows[0];

    // Asignar el nuevo encargado al estudiante con el parentesco
    await pool.query(
      `INSERT INTO estudiantes_encargados (estudiante_id, encargado_id, parentesco) VALUES ($1, $2, $3)`,
      [estudiante_id, nuevoEncargado.id, parentesco]
    );

    res.json({
      message: "Encargado creado y asignado correctamente",
      encargado: nuevoEncargado,
      parentesco,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creando el encargado" });
  }
});

module.exports = router;
