const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Obtener todos los estudiantes
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT *, EXTRACT(YEAR FROM AGE(fecha_nacimiento)) AS edad FROM estudiantes"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Función para generar el código del estudiante basado en el año actual y un número incremental
async function generarCodigoEstudiante() {
  const añoActual = new Date().getFullYear();
  const prefijo = `${añoActual}`;
  const query = `SELECT cod_est FROM estudiantes WHERE cod_est LIKE '${prefijo}%' ORDER BY cod_est DESC LIMIT 1`;

  try {
    const result = await pool.query(query);
    if (result.rows.length > 0) {
      const ultimoCodigo = result.rows[0].cod_est;
      const numero = parseInt(ultimoCodigo.slice(4)) + 1;
      return `${prefijo}${numero.toString().padStart(4, "0")}`;
    } else {
      return `${prefijo}0001`;
    }
  } catch (error) {
    console.error("Error generando el código del estudiante:", error);
    throw error;
  }
}

// Crear un nuevo estudiante con código automático PERO CON LA NUEVA BD
router.post("/", async (req, res) => {
  const {
    nombre,
    apellidop,
    apellidom,
    fecha_nacimiento,
    carnet_identidad,
    celular,
    correo,
    nit,
    razon_social,
    direccion,
    genero,
  } = req.body;

  try {
    const cod_est = await generarCodigoEstudiante();

    const result = await pool.query(
      `INSERT INTO estudiantes (nombre, apellidop, apellidom, fecha_nacimiento, carnet_identidad, celular, correo, nit, razon_social, direccion, genero, cod_est)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        nombre,
        apellidop,
        apellidom,
        fecha_nacimiento,
        carnet_identidad,
        celular,
        correo,
        nit,
        razon_social,
        direccion,
        genero,
        cod_est,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error al registrar estudiante:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Verificar si el Carnet de Identidad ya existe
router.get("/verificar-ci/:carnet_identidad", async (req, res) => {
  const { carnet_identidad } = req.params;
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM estudiantes WHERE carnet_identidad = $1",
      [carnet_identidad]
    );
    res.json({ existe: result.rows[0].count > 0 });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al verificar el Carnet de Identidad" });
  }
});

// Verificar si el NIT ya existe y obtener la Razón Social
router.get("/verificar-nit/:nit", async (req, res) => {
  const { nit } = req.params;
  try {
    const result = await pool.query(
      "SELECT razon_social FROM estudiantes WHERE nit = $1 LIMIT 1",
      [nit]
    );
    if (result.rows.length > 0) {
      res.json({ existe: true, razon_social: result.rows[0].razon_social });
    } else {
      res.json({ existe: false });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al verificar el NIT" });
  }
});

// Obtener los datos de un estudiante por ID junto con sus inscripciones PARA VER
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const estudianteQuery = await pool.query(
      "SELECT * FROM estudiantes WHERE id = $1",
      [id]
    );
    if (estudianteQuery.rows.length === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    const estudiante = estudianteQuery.rows[0];

    const inscripcionesQuery = await pool.query(
      "SELECT * FROM inscripciones WHERE estudiante_id = $1 ORDER BY gestion DESC",
      [id]
    );

    estudiante.inscripciones = inscripcionesQuery.rows;

    res.json(estudiante);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo el estudiante" });
  }
});

// Actualizar los datos de un estudiante (PARA EDITAR)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellidop,
      apellidom,
      fecha_nacimiento,
      carnet_identidad,
      celular,
      correo,
      nit,
      razon_social,
      direccion,
      genero,
      cod_est,
    } = req.body;

    const result = await pool.query(
      `UPDATE estudiantes SET nombre = $1, apellidop = $2, apellidom = $3, fecha_nacimiento = $4,
           carnet_identidad = $5, celular = $6, correo = $7,
           nit = $8, razon_social = $9, direccion = $10, genero = $11,
           cod_est = $12 WHERE id = $13 RETURNING *`,
      [
        nombre,
        apellidop,
        apellidom,
        fecha_nacimiento,
        carnet_identidad,
        celular,
        correo,
        nit,
        razon_social,
        direccion,
        genero,
        cod_est,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }
    res.json({
      message: "Estudiante actualizado correctamente",
      estudiante: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error actualizando el estudiante" });
  }
});

//Obtener estudiante por CI con su Mensualidad
router.get("/ci/:ci", async (req, res) => {
  const { ci } = req.params;
  try {
    // Obtener estudiante
    const estudianteResult = await pool.query(
      "SELECT * FROM estudiantes WHERE carnet_identidad = $1",
      [ci]
    );
    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }
    const estudiante = estudianteResult.rows[0];

    // Obtener inscripciones + tarifas asociadas
    const inscripcionesResult = await pool.query(
      `
      SELECT 
        i.*,
        tp.id AS tarifa_personalizada_id,
        tp.costo_matricula AS personalizada_matricula,
        tp.costo_mensualidad AS personalizada_mensualidad,
        t.costo_matricula AS tarifa_matricula,
        t.costo_mensualidad AS tarifa_mensualidad
      FROM inscripciones i
      LEFT JOIN tarifas_personalizadas tp ON tp.inscripcion_id = i.id
      LEFT JOIN cursos_tarifarios ct ON ct.nombre_curso = i.curso AND ct.sucursal = i.sucursal
      LEFT JOIN tarifas t ON t.gestion = i.gestion AND t.grupo_tarifa_id = ct.grupo_tarifa_id
      WHERE i.estudiante_id = $1
      ORDER BY i.gestion DESC
      `,
      [estudiante.id]
    );

    const inscripciones = inscripcionesResult.rows.map((row) => ({
      id: row.id,
      estudiante_id: row.estudiante_id,
      gestion: row.gestion,
      sucursal: row.sucursal,
      curso: row.curso,
      fecha_inscripcion: row.fecha_inscripcion,
      estado: row.estado,
      tarifa: {
        costo_matricula: row.tarifa_matricula,
        costo_mensualidad: row.tarifa_mensualidad,
      },
      tarifa_personalizada:
        row.personalizada_matricula !== null
          ? {
              id: row.tarifa_personalizada_id,
              costo_matricula: row.personalizada_matricula,
              costo_mensualidad: row.personalizada_mensualidad,
            }
          : null,
      mensualidades_personalizadas: [],
    }));

    // Obtener TODAS las mensualidades personalizadas para sus inscripciones
    const inscripcionIds = inscripciones.map((ins) => ins.id);
    if (inscripcionIds.length > 0) {
      const mensualidadesResult = await pool.query(
        `
        SELECT inscripcion_id, concepto, monto
        FROM mensualidades_personalizadas
        WHERE inscripcion_id = ANY($1)
        ORDER BY concepto
        `,
        [inscripcionIds]
      );

      // Agrupar por inscripción
      const mensualidadesPorInscripcion = {};
      for (const row of mensualidadesResult.rows) {
        if (!mensualidadesPorInscripcion[row.inscripcion_id]) {
          mensualidadesPorInscripcion[row.inscripcion_id] = [];
        }
        mensualidadesPorInscripcion[row.inscripcion_id].push({
          concepto: row.concepto,
          monto: parseFloat(row.monto),
        });
      }

      // Asignar al array original
      for (const inscripcion of inscripciones) {
        inscripcion.mensualidades_personalizadas =
          mensualidadesPorInscripcion[inscripcion.id] || [];
      }
    }

    estudiante.inscripciones = inscripciones;
    res.json(estudiante);
  } catch (error) {
    console.error("Error al buscar estudiante por CI:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

module.exports = router;
