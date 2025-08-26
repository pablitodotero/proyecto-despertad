const pool = require("../config/db");

//CREAR PERSONAL Y CONTRATOS
exports.crearPersonal = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { personal, id_personal, contrato, materias, cursos, horarios } =
      req.body;
    let personalId;
    let tipoPersonal;
    let idHistorialRol;

    if (id_personal) {
      // Registrar contrato para personal existente
      personalId = id_personal;
      tipoPersonal = req.body.tipo_personal;

      // Buscar historial_roles activo para este tipo_personal
      const historialRolRes = await client.query(
        `SELECT id FROM historial_roles WHERE id_personal = $1 AND tipo_personal = $2 AND estado = 'activo'`,
        [personalId, tipoPersonal]
      );

      if (historialRolRes.rows.length === 0) {
        throw new Error(
          `No se encontró un historial de rol activo para el personal ID ${personalId} con tipo '${tipoPersonal}'`
        );
      }

      idHistorialRol = historialRolRes.rows[0].id;
    } else if (personal) {
      // Registrar nuevo personal (sin tipo_personal en tabla personal)
      const result = await client.query(
        `
        INSERT INTO personal (nombres, apellidop, apellidom, ci, fecha_nacimiento, observaciones, telefono)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [
          personal.nombres,
          personal.apellidop,
          personal.apellidom,
          personal.ci,
          personal.fechaNacimiento,
          personal.observaciones,
          personal.telefono,
        ]
      );

      personalId = result.rows[0].id;
      tipoPersonal = personal.tipo_personal;

      // Insertar en historial_roles (activo por defecto)
      const historialInsert = await client.query(
        `
        INSERT INTO historial_roles (id_personal, tipo_personal, estado)
        VALUES ($1, $2, 'activo')
        RETURNING id
        `,
        [personalId, tipoPersonal]
      );

      idHistorialRol = historialInsert.rows[0].id;
    } else {
      throw new Error(
        "Falta información de personal o ID de personal existente."
      );
    }

    // Insertar contrato con id_historial_rol
    const contratoRes = await client.query(
      `
      INSERT INTO contratos 
      (id_personal, id_historial_rol, gestion, tipo_contrato, id_turno, sucursal, sueldo_mensual, fecha_inicio, fecha_fin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
      `,
      [
        personalId,
        idHistorialRol,
        contrato.gestion,
        contrato.tipo_contrato,
        contrato.id_turno,
        contrato.sucursal,
        contrato.sueldoMensual,
        contrato.fechaInicio,
        contrato.fechaFin,
      ]
    );

    const contratoId = contratoRes.rows[0].id;

    // Insertar horarios si es profesor
    if (tipoPersonal === "profesor") {
      for (const h of horarios) {
        await client.query(
          `
          INSERT INTO horarios_profesor (id_contrato, id_materia, id_curso, dia_semana, hora_inicio, hora_fin)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            contratoId,
            h.idMateria,
            h.idCurso,
            h.diaSemana,
            h.horaInicio,
            h.horaFin,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: id_personal
        ? "Contrato registrado para personal existente."
        : "Personal y contrato registrados correctamente.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar personal:", error);
    res.status(500).json({ success: false, message: "Error en el servidor." });
  } finally {
    client.release();
  }
};

exports.verificarCI = async (req, res) => {
  const { ci } = req.params;
  try {
    const result = await pool.query(
      `
      SELECT 
        p.*, 
        hr.tipo_personal AS tipo_personal
      FROM personal p
      LEFT JOIN historial_roles hr 
        ON p.id = hr.id_personal AND hr.estado = 'activo'
      WHERE p.ci = $1
      `,
      [ci]
    );

    if (result.rows.length > 0) {
      const data = result.rows[0];
      res.json({ exists: true, data });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Error al verificar CI:", error);
    res.status(500).json({ success: false, message: "Error en el servidor." });
  }
};
