const pool = require("../config/db");

const datosFijos = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. grupos_tarifas
    await client.query(
      `INSERT INTO grupos_tarifas (id, nombre) VALUES
        (1, 'Maternal'),
        (2, 'Inicial y Primaria'),
        (3, 'Secundaria')
      ON CONFLICT (id) DO NOTHING;`
    );

    // 2. cursos (Primaria y Secundaria)
    await client.query(
      `INSERT INTO cursos (id, nombre, nivel) VALUES
        (1, 'Maternal', 'Primaria'),
        (2, 'Inicial I', 'Primaria'),
        (3, 'Inicial II', 'Primaria'),
        (4, 'Primero', 'Primaria'),
        (5, 'Segundo', 'Primaria'),
        (6, 'Tercero', 'Primaria'),
        (7, 'Cuarto', 'Primaria'),
        (8, 'Quinto', 'Primaria'),
        (9, 'Sexto', 'Primaria'),
        (10, 'Primero', 'Secundaria'),
        (11, 'Segundo', 'Secundaria'),
        (12, 'Tercero', 'Secundaria'),
        (13, 'Cuarto', 'Secundaria'),
        (14, 'Quinto', 'Secundaria'),
        (15, 'Sexto', 'Secundaria')
      ON CONFLICT (id) DO NOTHING;`
    );

    // 3. cursos_tarifarios
    await client.query(
      `INSERT INTO cursos_tarifarios (nombre_curso, sucursal, grupo_tarifa_id) VALUES
        ('Cuarto', 'Primaria', 2),
        ('Cuarto', 'Secundaria', 3),
        ('Inicial I', 'Primaria', 2),
        ('Inicial II', 'Primaria', 2),
        ('Maternal', 'Primaria', 1),
        ('Primero', 'Primaria', 2),
        ('Primero', 'Secundaria', 3),
        ('Quinto', 'Primaria', 2),
        ('Quinto', 'Secundaria', 3),
        ('Segundo', 'Primaria', 2),
        ('Segundo', 'Secundaria', 3),
        ('Sexto', 'Primaria', 2),
        ('Sexto', 'Secundaria', 3),
        ('Tercero', 'Primaria', 2),
        ('Tercero', 'Secundaria', 3)
      ON CONFLICT (nombre_curso, sucursal) DO NOTHING;`
    );

    // 4. secciones_gasto
    await client.query(
      `INSERT INTO secciones_gasto (id, nombre, estado) VALUES
        (1, 'Limpieza', 'activo'),
        (2, 'Cocina', 'activo'),
        (3, 'Oficina', 'activo'),
        (4, 'Escritorio', 'activo'),
        (5, 'Mantenimiento', 'activo'),
        (6, 'Otro', 'activo')
      ON CONFLICT (id) DO NOTHING;`
    );

    // 5. tipos_producto
    await client.query(
      `INSERT INTO tipos_producto (id, nombre, descripcion) VALUES
        (1, 'Libros', NULL),
        (2, 'Uniformes', NULL)
      ON CONFLICT (id) DO NOTHING;`
    );

    // 6. turnos
    await client.query(
      `INSERT INTO turnos (id, nombre, hora_inicio, hora_fin) VALUES
        (1, 'Temprano (6h)', '06:00:00', '12:00:00'),  
        (2, 'Matutino (8h)', '06:00:00', '14:00:00'),
        (3, 'Parcial (6h)', '07:00:00', '13:00:00'),
        (4, 'Completo (8h)', '07:00:00', '15:00:00'),
        (5, 'Intermedio (6h)', '08:00:00', '14:00:00'),
        (6, 'Continuo (8h)', '08:00:00', '16:00:00'),
        (7, 'Vespertino (6h)', '12:00:00', '18:00:00')
        ON CONFLICT (id) DO NOTHING;`
    );

    // -- Reset sequences to max id so future inserts continue correctly
    const seqResetQueries = [
      "SELECT setval(pg_get_serial_sequence('grupos_tarifas','id'), (SELECT MAX(id) FROM grupos_tarifas));",
      "SELECT setval(pg_get_serial_sequence('cursos','id'), (SELECT MAX(id) FROM cursos));",
      "SELECT setval(pg_get_serial_sequence('secciones_gasto','id'), (SELECT MAX(id) FROM secciones_gasto));",
      "SELECT setval(pg_get_serial_sequence('tipos_producto','id'), (SELECT MAX(id) FROM tipos_producto));",
      "SELECT setval(pg_get_serial_sequence('turnos','id'), (SELECT MAX(id) FROM turnos));",
    ];

    for (const q of seqResetQueries) {
      await client.query(q);
    }

    await client.query("COMMIT");
    console.log("✅ Datos fijos insertados correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error insertando datos fijos:", error);
  } finally {
    client.release();
  }
};

datosFijos();
