const pool = require("../config/db");

const eliminarTablas = async () => {
  const query = `
    DROP TABLE IF EXISTS
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
    CASCADE;
  `;

  try {
    await pool.query(query);
    console.log("✅ Todas las tablas fueron eliminadas correctamente.");
  } catch (error) {
    console.error("❌ Error eliminando tablas:", error);
  } finally {
    pool.end();
  }
};

eliminarTablas();
