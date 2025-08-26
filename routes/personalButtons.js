const express = require("express");
const pool = require("../config/db");
const router = express.Router();

//PARA CAMBIAR ROL
router.put("/cambiar-rol", async (req, res) => {
  const { ci, nuevoRol } = req.body;

  if (!ci || !nuevoRol) {
    return res
      .status(400)
      .json({ message: "CI y nuevo rol son obligatorios." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Obtener ID del personal
    const resultPersonal = await client.query(
      "SELECT id FROM personal WHERE ci = $1",
      [ci]
    );

    if (resultPersonal.rowCount === 0) {
      throw new Error("Personal no encontrado");
    }

    const idPersonal = resultPersonal.rows[0].id;

    // Marcar todos los roles actuales como inactivos
    await client.query(
      `UPDATE historial_roles SET estado = 'inactivo' WHERE id_personal = $1 AND estado = 'activo'`,
      [idPersonal]
    );

    // Verificar si ya tiene el nuevo rol registrado
    const resultNuevoRol = await client.query(
      `SELECT id FROM historial_roles WHERE id_personal = $1 AND tipo_personal = $2`,
      [idPersonal, nuevoRol]
    );

    if (resultNuevoRol.rowCount > 0) {
      // Si ya existe, actualizar su estado a activo
      await client.query(
        `UPDATE historial_roles SET estado = 'activo' WHERE id = $1`,
        [resultNuevoRol.rows[0].id]
      );
    } else {
      // Si no existe, insertar nuevo rol
      await client.query(
        `INSERT INTO historial_roles (id_personal, tipo_personal, estado) VALUES ($1, $2, 'activo')`,
        [idPersonal, nuevoRol]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Rol cambiado exitosamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al cambiar rol:", error);
    res.status(500).json({ message: "Error interno al cambiar rol." });
  } finally {
    client.release();
  }
});

//VER HORARIOS DE UN CONTRATO
router.get("/contrato/:id_contrato", async (req, res) => {
  const { id_contrato } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        h.id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        m.nombre AS materia,
        c.nombre AS curso,
        c.nivel AS nivel_curso
      FROM horarios_profesor h
      LEFT JOIN materias m ON h.id_materia = m.id
      LEFT JOIN cursos c ON h.id_curso = c.id
      WHERE h.id_contrato = $1
      ORDER BY 
        CASE 
          WHEN dia_semana = 'lunes' THEN 1
          WHEN dia_semana = 'martes' THEN 2
          WHEN dia_semana = 'miércoles' THEN 3
          WHEN dia_semana = 'jueves' THEN 4
          WHEN dia_semana = 'viernes' THEN 5
          WHEN dia_semana = 'sábado' THEN 6
          ELSE 7
        END,
        h.hora_inicio
      `,
      [id_contrato]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener horarios:", error);
    res.status(500).json({ error: "Error al obtener horarios del contrato" });
  }
});

//VER PAGOS DE UN CONTRATO
router.get("/pagos-por-contrato/:id_contrato", async (req, res) => {
  const { id_contrato } = req.params;

  try {
    const pagosRaw = await pool.query(
      `
      SELECT 
        id, 
        mes, 
        fecha_pago, 
        monto_pagado, 
        observaciones,
        operador
      FROM pagos_personal
      WHERE id_contrato = $1
      ORDER BY mes, fecha_pago
    `,
      [id_contrato]
    );

    res.json(pagosRaw.rows); // <<< esta es la forma esperada por el frontend
  } catch (error) {
    console.error("Error al obtener pagos por contrato:", error);
    res.status(500).json({ error: "Error al obtener pagos por contrato" });
  }
});

//REGISTRAR PAGO
router.post("/registrar-pago", async (req, res) => {
  const {
    id_contrato,
    mes,
    monto_pagado,
    observaciones,
    fecha_pago,
    operador,
  } = req.body;

  if (
    !id_contrato ||
    !mes ||
    !monto_pagado ||
    !operador ||
    mes < 1 ||
    mes > 12
  ) {
    return res.status(400).json({ error: "Datos incompletos o inválidos" });
  }

  try {
    // Verificar que el contrato exista
    const existeContrato = await pool.query(
      "SELECT 1 FROM contratos WHERE id = $1",
      [id_contrato]
    );

    if (existeContrato.rowCount === 0) {
      return res.status(404).json({ error: "Contrato no encontrado" });
    }

    // Registrar el pago
    await pool.query(
      `
      INSERT INTO pagos_personal (id_contrato, mes, fecha_pago, monto_pagado, observaciones, operador)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        id_contrato,
        mes,
        fecha_pago || new Date(),
        monto_pagado,
        observaciones || null,
        operador,
      ]
    );

    res.status(201).json({ message: "Pago registrado correctamente" });
  } catch (error) {
    console.error("Error al registrar pago:", error);
    res.status(500).json({ error: "Error al registrar el pago" });
  }
});

//ELIMINAR PAGO
router.delete("/eliminar-pago/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pago = await pool.query(
      `SELECT fecha_pago FROM pagos_personal WHERE id = $1`,
      [id]
    );

    if (pago.rowCount === 0) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const fechaPago = new Date(pago.rows[0].fecha_pago);
    const ahora = new Date();
    const diferenciaEnMs = ahora - fechaPago;

    if (diferenciaEnMs > 60 * 60 * 1000) {
      return res
        .status(403)
        .json({ error: "El tiempo para eliminar ha expirado" });
    }

    await pool.query(`DELETE FROM pagos_personal WHERE id = $1`, [id]);

    res.json({ message: "Pago eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar pago:", error);
    res.status(500).json({ error: "Error al eliminar el pago" });
  }
});

//ELIMINAR CONTRATOS SIN PAGOS
router.delete("/eliminar-contrato/:id_contrato", async (req, res) => {
  const { id_contrato } = req.params;

  try {
    const contrato = await pool.query(
      `SELECT gestion, id_personal FROM contratos WHERE id = $1`,
      [id_contrato]
    );

    if (contrato.rowCount === 0) {
      return res.status(404).json({ error: "Contrato no encontrado" });
    }

    const { gestion, id_personal } = contrato.rows[0];
    const gestionActual = new Date().getFullYear();

    if (gestion < gestionActual) {
      return res.status(403).json({
        error: "Solo puedes eliminar contratos de la gestión actual o futura",
      });
    }

    // Verificar si ya tiene pagos
    const pagos = await pool.query(
      "SELECT 1 FROM pagos_personal WHERE id_contrato = $1 LIMIT 1",
      [id_contrato]
    );

    if (pagos.rowCount > 0) {
      return res.status(403).json({
        error:
          "No puedes eliminar este contrato porque ya tiene pagos registrados",
      });
    }

    // Verificar si es el único contrato del personal
    const contratosRestantes = await pool.query(
      `SELECT 1 FROM contratos WHERE id_personal = $1 AND id != $2 LIMIT 1`,
      [id_personal, id_contrato]
    );

    if (contratosRestantes.rowCount === 0) {
      await pool.query("DELETE FROM contratos WHERE id = $1", [id_contrato]);
      await pool.query("DELETE FROM historial_roles WHERE id_personal = $1", [
        id_personal,
      ]);
      await pool.query("DELETE FROM personal WHERE id = $1", [id_personal]);
      return res.json({
        message: "Contrato y único personal eliminado correctamente",
      });
    }

    // Eliminar solo el contrato
    await pool.query("DELETE FROM contratos WHERE id = $1", [id_contrato]);

    return res.json({ message: "Contrato eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar contrato:", error);
    return res.status(500).json({ error: "Error al eliminar el contrato" });
  }
});

//EIDTAR CONTRATO
router.put("/editar-contrato/:id_contrato", async (req, res) => {
  const { id_contrato } = req.params;
  const {
    sueldo_mensual,
    tipo_contrato,
    id_turno,
    fecha_inicio,
    fecha_fin,
    observaciones,
  } = req.body;

  try {
    // Obtener el contrato actual
    const contratoResult = await pool.query(
      "SELECT gestion, id_historial_rol FROM contratos WHERE id = $1",
      [id_contrato]
    );

    if (contratoResult.rowCount === 0) {
      return res.status(404).json({ error: "Contrato no encontrado" });
    }

    const { gestion, id_historial_rol } = contratoResult.rows[0];

    // Obtener el rol asociado
    const rolResult = await pool.query(
      "SELECT tipo_personal FROM historial_roles WHERE id = $1",
      [id_historial_rol]
    );

    if (rolResult.rowCount === 0) {
      return res
        .status(400)
        .json({ error: "No se encontró el rol asociado al contrato" });
    }

    const rol = rolResult.rows[0]?.tipo_personal;

    // Validaciones
    const añoInicio = new Date(fecha_inicio).getFullYear();
    const añoFin = new Date(fecha_fin).getFullYear();

    if (añoInicio !== gestion || añoFin !== gestion) {
      return res.status(400).json({
        error: "Las fechas deben pertenecer a la gestión del contrato",
      });
    }

    if (new Date(fecha_inicio) > new Date(fecha_fin)) {
      return res.status(400).json({
        error: "La fecha de inicio debe ser menor a la fecha de finalización",
      });
    }

    if (
      isNaN(sueldo_mensual) ||
      sueldo_mensual <= 0 ||
      sueldo_mensual > 50000
    ) {
      return res.status(400).json({
        error: "El sueldo debe ser mayor a 0 y menor o igual a 50000",
      });
    }

    if (!["tiempo_completo", "medio_tiempo", null].includes(tipo_contrato)) {
      return res.status(400).json({ error: "Tipo de contrato inválido" });
    }

    if (rol !== "profesor") {
      if (tipo_contrato === "tiempo_completo" && id_turno !== null) {
        return res
          .status(400)
          .json({ error: "El turno debe ser null para tiempo completo" });
      }
      if (
        tipo_contrato === "medio_tiempo" &&
        (id_turno === null || isNaN(id_turno))
      ) {
        return res.status(400).json({
          error: "Debes seleccionar un turno válido para medio tiempo",
        });
      }
    }

    // Si es profesor, forzar tipo_contrato y id_turno a null
    const tipoFinal = rol === "profesor" ? null : tipo_contrato;
    const turnoFinal = rol === "profesor" ? null : id_turno;

    await pool.query(
      `UPDATE contratos
      SET sueldo_mensual = $1,
       tipo_contrato = $2,
       id_turno = $3,
       fecha_inicio = $4,
       fecha_fin = $5,
       observaciones = $6
      WHERE id = $7`,
      [
        sueldo_mensual,
        tipoFinal,
        turnoFinal,
        fecha_inicio,
        fecha_fin,
        observaciones,
        id_contrato,
      ]
    );

    return res.json({ message: "Contrato actualizado correctamente" });
  } catch (error) {
    console.error("Error al editar contrato:", error);
    return res.status(500).json({ error: "Error al editar el contrato" });
  }
});

//VER PERSONAL
router.get("/detalle/:id", async (req, res) => {
  const idPersonal = req.params.id;

  try {
    // 1. Obtener datos básicos del personal y su rol actual
    const personalQuery = await pool.query(
      `SELECT 
        p.id, p.nombres, p.apellidop, p.apellidom, p.ci, p.fecha_nacimiento, p.observaciones, p.telefono,
        hr.tipo_personal AS rol_actual
      FROM personal p
      LEFT JOIN historial_roles hr ON hr.id_personal = p.id AND hr.estado = 'activo'
      WHERE p.id = $1
      LIMIT 1`,
      [idPersonal]
    );

    if (personalQuery.rowCount === 0) {
      return res.status(404).json({ error: "Personal no encontrado" });
    }

    const personal = personalQuery.rows[0];

    // 2. Obtener roles anteriores (inactivos)
    const rolesQuery = await pool.query(
      `SELECT tipo_personal FROM historial_roles
       WHERE id_personal = $1 AND estado = 'inactivo'`,
      [idPersonal]
    );

    const roles_anteriores = rolesQuery.rows.map((r) => r.tipo_personal);

    // 3. Obtener contratos agrupados por gestion
    const contratosQuery = await pool.query(
      `SELECT 
        c.id, c.gestion, c.tipo_contrato, c.sucursal, c.sueldo_mensual,
        c.fecha_inicio, c.fecha_fin, c.observaciones,
        hr.tipo_personal AS rol,
        t.nombre AS turno_nombre, t.hora_inicio, t.hora_fin
      FROM contratos c
      JOIN historial_roles hr ON c.id_historial_rol = hr.id
      LEFT JOIN turnos t ON c.id_turno = t.id
      WHERE c.id_personal = $1
      ORDER BY c.gestion DESC, c.fecha_inicio ASC`,
      [idPersonal]
    );

    const contratos_por_anio = {};
    for (const contrato of contratosQuery.rows) {
      const anio = contrato.gestion;
      if (!contratos_por_anio[anio]) contratos_por_anio[anio] = [];

      contratos_por_anio[anio].push({
        id: contrato.id,
        tipo_contrato: contrato.tipo_contrato,
        rol: contrato.rol,
        sucursal: contrato.sucursal,
        sueldo_mensual: contrato.sueldo_mensual,
        fecha_inicio: contrato.fecha_inicio,
        fecha_fin: contrato.fecha_fin,
        turno: contrato.turno_nombre
          ? {
              nombre: contrato.turno_nombre,
              hora_inicio: contrato.hora_inicio,
              hora_fin: contrato.hora_fin,
            }
          : null,
        observaciones: contrato.observaciones,
      });
    }

    res.json({
      personal,
      roles_anteriores,
      contratos_por_anio,
    });
  } catch (error) {
    console.error("Error al obtener detalle del personal:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//EDITAR DATOS PERSONALES
router.put("/editar-info/:id", async (req, res) => {
  const id = req.params.id;
  const { nombres, apellidop, apellidom, ci, fecha_nacimiento, observaciones, telefono } =
    req.body;

  try {
    const result = await pool.query(
      `UPDATE personal
       SET nombres = $1,
           apellidop = $2,
           apellidom = $3,
           ci = $4,
           fecha_nacimiento = $5,
           observaciones = $6,
           telefono = $7
       WHERE id = $8`,
      [nombres, apellidop, apellidom, ci, fecha_nacimiento, observaciones, telefono, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Personal no encontrado" });
    }

    res.json({ message: "Información personal actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar información del personal:", error);
    res.status(500).json({ error: "Error al actualizar información personal" });
  }
});

//VERIFICAR CI EXISTENTE
router.get("/verificar-ci/:ci/:id", async (req, res) => {
  const { ci, id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id FROM personal WHERE ci = $1 AND id != $2 LIMIT 1`,
      [ci, id]
    );

    if (result.rowCount > 0) {
      return res.json({ existe: true });
    } else {
      return res.json({ existe: false });
    }
  } catch (error) {
    console.error("Error al verificar CI:", error);
    return res.status(500).json({ error: "Error al verificar CI" });
  }
});

//EDITAR CONTRATO, OBTENER HORARIOS
router.get("/horarios/:idContrato", async (req, res) => {
  const { idContrato } = req.params;
  try {
    const result = await pool.query(
      `SELECT h.id, h.id_materia, m.nombre AS materia_nombre, m.nivel AS materia_nivel,
              h.id_curso, c.nombre AS curso_nombre, c.nivel AS curso_nivel,
              h.dia_semana, h.hora_inicio, h.hora_fin
       FROM horarios_profesor h
       LEFT JOIN materias m ON m.id = h.id_materia
       LEFT JOIN cursos c ON c.id = h.id_curso
       WHERE h.id_contrato = $1
       ORDER BY h.dia_semana, h.hora_inicio`,
      [idContrato]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener horarios:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener horarios" });
  }
});

//EDITAR CONTRATO, INSERTAR HORARIO
router.post("/horarios", async (req, res) => {
  const {
    id_contrato,
    id_materia,
    id_curso,
    dia_semana,
    hora_inicio,
    hora_fin,
  } = req.body;

  try {
    // Validar solapamiento
    const conflicto = await pool.query(
      `SELECT 1 FROM horarios_profesor
       WHERE id_contrato = $1 AND dia_semana = $2 AND
             ((hora_inicio < $4 AND hora_fin > $3))`,
      [id_contrato, dia_semana, hora_fin, hora_inicio]
    );

    if (conflicto.rowCount > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Conflicto de horario detectado" });
    }

    // Insertar y devolver el ID
    const result = await pool.query(
      `INSERT INTO horarios_profesor (id_contrato, id_materia, id_curso, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [id_contrato, id_materia, id_curso, dia_semana, hora_inicio, hora_fin]
    );

    res.json({
      success: true,
      id: result.rows[0].id,
      message: "Horario agregado correctamente",
    });
  } catch (err) {
    console.error("Error al insertar horario:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar horario" });
  }
});

//EDITAR CONTRATO, BORRAR HORARIO
router.delete("/horarios/:idHorario", async (req, res) => {
  const { idHorario } = req.params;
  try {
    await pool.query(`DELETE FROM horarios_profesor WHERE id = $1`, [
      idHorario,
    ]);
    res.json({ success: true, message: "Horario eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar horario:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al eliminar horario" });
  }
});

module.exports = router;
