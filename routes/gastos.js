const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//Registrar gasto
router.post("/", async (req, res) => {
  try {
    const {
      id_usuario,
      id_seccion,
      descripcion,
      observaciones,
      monto,
      fecha,
      sucursal,
    } = req.body;

    if (
      !id_usuario ||
      !id_seccion ||
      !descripcion ||
      !monto ||
      !fecha ||
      !sucursal
    ) {
      return res.status(400).json({ message: "Campos requeridos faltantes" });
    }

    await pool.query(
      `INSERT INTO gastos (id_usuario, id_seccion, descripcion, observaciones, monto, fecha, sucursal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id_usuario,
        id_seccion,
        descripcion,
        observaciones || "",
        monto,
        fecha,
        sucursal,
      ]
    );

    res.status(200).json({ message: "Gasto registrado correctamente" });
  } catch (error) {
    console.error("Error al registrar gasto:", error);
    res.status(500).json({ message: "Error interno al registrar gasto" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, id_seccion, sucursal } = req.query;

    if (!fechaInicio || !fechaFin || !sucursal) {
      return res.status(400).json({
        message:
          "Debes proporcionar una fecha o rango de fechas, y la sucursal.",
      });
    }

    const condiciones = [`g.sucursal = $1`, `g.fecha BETWEEN $2 AND $3`];
    const valores = [sucursal, fechaInicio, fechaFin];
    let i = 4;

    if (id_seccion) {
      condiciones.push(`g.id_seccion = $${i}`);
      valores.push(id_seccion);
    }

    const query = `
      SELECT 
        g.*, 
        u.nombre, 
        u.apellidop, 
        u.apellidom, 
        s.nombre AS seccion
      FROM gastos g
      LEFT JOIN usuarios u ON u.id = g.id_usuario
      JOIN secciones_gasto s ON s.id = g.id_seccion
      WHERE ${condiciones.join(" AND ")}
      ORDER BY g.fecha DESC, g.creado_en DESC
    `;

    const { rows } = await pool.query(query, valores);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error al obtener gastos:", error);
    res.status(500).json({ message: "Error interno al obtener gastos" });
  }
});

//Obtener secciones de gastos
router.get("/secciones", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre FROM secciones_gasto WHERE estado = 'activo' ORDER BY nombre`
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error al obtener secciones de gasto:", error);
    res.status(500).json({ message: "Error interno al obtener secciones" });
  }
});

//Eliminar Gasto
router.delete("/:id", async (req, res) => {
  const idGasto = req.params.id;
  const idUsuario = req.body.id_usuario;

  try {
    // 1. Obtener el gasto
    const { rows } = await pool.query(
      "SELECT creado_en, id_usuario FROM gastos WHERE id = $1",
      [idGasto]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    const gasto = rows[0];

    // 2. Validar que sea el mismo usuario
    if (!gasto.id_usuario || gasto.id_usuario !== idUsuario) {
      return res
        .status(403)
        .json({ message: "No tienes permisos para eliminar este gasto" });
    }

    // 3. Validar que no hayan pasado más de 60 minutos
    const creadoEn = new Date(gasto.creado_en);
    const ahora = new Date();
    const minutosTranscurridos = (ahora - creadoEn) / 1000 / 60;

    if (minutosTranscurridos > 60) {
      return res.status(403).json({
        message: "Ya no puedes eliminar este gasto (pasaron más de 60 minutos)",
      });
    }

    // 4. Eliminar el gasto
    await pool.query("DELETE FROM gastos WHERE id = $1", [idGasto]);

    res.status(200).json({ message: "Gasto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar gasto:", error);
    res.status(500).json({ message: "Error interno al eliminar el gasto" });
  }
});

module.exports = router;
