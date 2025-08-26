const pool = require("../config/db");

const vaciarTablas = async () => {
  const query = `
    TRUNCATE TABLE
      compras_detalle,
      compras,
      pagos_compra,
      historial_precios,
      productos,
      tipos_producto,
      gastos,
      secciones_gasto,
      taller_pagos,
      taller_inscripciones,
      taller_fechas_precios,
      taller_fechas,
      talleres,
      horarios_profesor,
      cursos,
      materias,
      pagos_personal,
      turnos,
      contratos,
      historial_roles,
      personal,
      recibos,
      pagos,
      tarifas_personalizadas,
      cursos_tarifarios,
      tarifas,
      grupos_tarifas,
      estudiantes_encargados,
      encargados,
      inscripciones,
      estudiantes,
      reset_codes,
      usuarios
    RESTART IDENTITY CASCADE;
  `;

  try {
    await pool.query(query);
    console.log("✅ Datos eliminados y secuencias reiniciadas correctamente.");
  } catch (error) {
    console.error("❌ Error al truncar tablas:", error);
  } finally {
    pool.end();
  }
};

vaciarTablas();
