const pool = require("../config/db");

const vaciarDinamicos = async () => {
  const query = `
    TRUNCATE TABLE
      compras_detalle,
      compras,
      pagos_compra,
      historial_precios,
      productos,
      tipos_producto,
      gastos,
      taller_pagos,
      taller_inscripciones,
      taller_fechas_precios,
      taller_fechas,
      talleres,
      horarios_profesor,
      materias,
      pagos_personal,
      contratos,
      historial_roles,
      personal,
      recibos,
      pagos,
      tarifas_personalizadas,
      tarifas,
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
    console.log(
      "✅ Datos dinámicos eliminados y secuencias reiniciadas correctamente (tablas fijas intactas).\n"
    );
  } catch (error) {
    console.error("❌ Error al truncar tablas dinámicas:", error);
  } finally {
    pool.end();
  }
};

vaciarDinamicos();
