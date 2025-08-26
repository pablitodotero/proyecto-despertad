const db = require("../config/db");

// VER SI TIENE DEUDAS PARA REINSCRIBIR CON MESES
exports.verificarDeudas = async (req, res) => {
  const { estudianteId } = req.params;

  try {
    const inscripcion = await db.query(
      `SELECT i.id, i.gestion, i.curso, i.sucursal
         FROM inscripciones i
         WHERE i.estudiante_id = $1 AND i.gestion < EXTRACT(YEAR FROM CURRENT_DATE)
         ORDER BY i.gestion DESC
         LIMIT 1`,
      [estudianteId]
    );

    if (inscripcion.rows.length === 0) {
      return res
        .status(404)
        .json({ mensaje: "No se encontró una inscripción previa." });
    }

    const { id: inscripcionId, gestion, curso, sucursal } = inscripcion.rows[0];

    const mensualidadesRes = await db.query(
      `SELECT concepto, monto
         FROM mensualidades_personalizadas
         WHERE inscripcion_id = $1`,
      [inscripcionId]
    );

    const mensualidadesPersonalizadas = {};
    mensualidadesRes.rows.forEach(({ concepto, monto }) => {
      mensualidadesPersonalizadas[concepto.toLowerCase()] = parseFloat(monto);
    });

    const tieneMensualidadesPersonalizadas =
      Object.keys(mensualidadesPersonalizadas).length > 0;

    const tarifaPersonalizada = await db.query(
      `SELECT costo_matricula, costo_mensualidad
         FROM tarifas_personalizadas
         WHERE inscripcion_id = $1`,
      [inscripcionId]
    );

    let costoMatricula = 0;
    let costoMensualidad = 0;

    if (tarifaPersonalizada.rows.length > 0) {
      ({
        costo_matricula: costoMatricula,
        costo_mensualidad: costoMensualidad,
      } = tarifaPersonalizada.rows[0]);
    } else {
      const grupoTarifa = await db.query(
        `SELECT grupo_tarifa_id
           FROM cursos_tarifarios
           WHERE nombre_curso = $1 AND sucursal = $2`,
        [curso, sucursal]
      );

      if (grupoTarifa.rows.length === 0) {
        return res
          .status(404)
          .json({ mensaje: "No se encontró el grupo tarifario." });
      }

      const { grupo_tarifa_id } = grupoTarifa.rows[0];

      const tarifa = await db.query(
        `SELECT costo_matricula, costo_mensualidad
           FROM tarifas
           WHERE gestion = $1 AND grupo_tarifa_id = $2`,
        [gestion, grupo_tarifa_id]
      );

      if (tarifa.rows.length === 0) {
        return res
          .status(404)
          .json({ mensaje: "No se encontró la tarifa estándar." });
      }

      ({
        costo_matricula: costoMatricula,
        costo_mensualidad: costoMensualidad,
      } = tarifa.rows[0]);
    }

    const pagos = await db.query(
      `SELECT concepto, SUM(monto_pagado) AS total_pagado
         FROM pagos
         WHERE inscripcion_id = $1
         GROUP BY concepto`,
      [inscripcionId]
    );

    const pagosPorConcepto = {};
    pagos.rows.forEach(({ concepto, total_pagado }) => {
      pagosPorConcepto[concepto.toLowerCase()] = parseFloat(total_pagado);
    });

    const detallesDeuda = [];

    // Verificar matrícula
    const matriculaEsperada =
      mensualidadesPersonalizadas["matrícula"] ?? parseFloat(costoMatricula);
    const pagadoMatricula = pagosPorConcepto["matrícula"] || 0;
    if (pagadoMatricula < matriculaEsperada) {
      detallesDeuda.push("Matrícula Incompleta");
    }

    // Verificar solo los conceptos que se esperan (dependiendo del caso)
    if (tieneMensualidadesPersonalizadas) {
      // Solo verificamos los conceptos personalizados distintos de "matrícula"
      for (const concepto in mensualidadesPersonalizadas) {
        if (concepto === "matrícula") continue;

        const esperado = mensualidadesPersonalizadas[concepto];
        const pagado = pagosPorConcepto[concepto] || 0;

        if (pagado < esperado) {
          detallesDeuda.push(
            `Mensualidad de ${
              concepto.charAt(0).toUpperCase() + concepto.slice(1)
            } Incompleta`
          );
        }
      }
    } else {
      // Lista general de meses a verificar si NO hay mensualidades personalizadas
      const mesesEsperados = [
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
      ];

      mesesEsperados.forEach((mes) => {
        const pagado = pagosPorConcepto[mes] || 0;
        if (pagado < costoMensualidad) {
          detallesDeuda.push(
            `Mensualidad de ${
              mes.charAt(0).toUpperCase() + mes.slice(1)
            } Incompleta`
          );
        }
      });
    }

    const tieneDeudas = detallesDeuda.length > 0;

    res.json({ tieneDeudas, detallesDeuda, gestion, curso, sucursal });
  } catch (error) {
    console.error("Error al verificar deudas:", error);
    res.status(500).json({ mensaje: "Error interno del servidor." });
  }
};
