const pool = require("../config/db");

const crearTablas = async () => {
  const query = `
    -- TABLA DE USUARIOS
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      apellidop VARCHAR(100) NOT NULL,
      apellidom VARCHAR(100) NOT NULL,
      nickname VARCHAR(50) UNIQUE NOT NULL,
      genero VARCHAR(20) NOT NULL,
      rol VARCHAR(50) NOT NULL,
      correo VARCHAR(100) UNIQUE NOT NULL,
      contrasenia TEXT NOT NULL,
      sucursal VARCHAR(50) NOT NULL,
      estado VARCHAR(50) NOT NULL
    );

    -- Crea la tabla si no existe
    CREATE TABLE IF NOT EXISTS reset_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      code VARCHAR(10) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE
    );

    -- TABLA DE ESTUDIANTES
    CREATE TABLE IF NOT EXISTS estudiantes (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      apellidop VARCHAR(100) NOT NULL,
      apellidom VARCHAR(100) NOT NULL,
      fecha_nacimiento DATE NOT NULL,
      carnet_identidad VARCHAR(20) UNIQUE NOT NULL,
      celular VARCHAR(20),
      correo VARCHAR(100),
      nit VARCHAR(20),
      razon_social VARCHAR(200),
      direccion VARCHAR(200),
      genero VARCHAR(20),
      cod_est VARCHAR(10) UNIQUE NOT NULL
    );

    -- TABLA DE INSCRIPCIONES (Registra en qué gestión y curso está el estudiante)
    CREATE TABLE IF NOT EXISTS inscripciones (
      id SERIAL PRIMARY KEY,
      estudiante_id INT REFERENCES estudiantes(id) ON DELETE CASCADE,
      gestion INT NOT NULL,
      sucursal VARCHAR(50) NOT NULL,
      curso VARCHAR(50) NOT NULL,
      fecha_inscripcion DATE NOT NULL DEFAULT CURRENT_DATE,
      estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
      mes_inicio INT CHECK (mes_inicio BETWEEN 2 AND 11),
      mes_fin INT CHECK (mes_fin BETWEEN 2 AND 11)
    );

    -- TABLA DE ENCARGADOS (Responsables del estudiante)
    CREATE TABLE IF NOT EXISTS encargados (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      apellidop VARCHAR(100) NOT NULL,
      apellidom VARCHAR(100) NOT NULL,
      carnet_identidad VARCHAR(20) UNIQUE NOT NULL,
      celular VARCHAR(20),
      correo VARCHAR(100),
      genero VARCHAR(20)
    );

    -- TABLA INTERMEDIA ENTRE ESTUDIANTES Y ENCARGADOS (Asigna responsables con parentesco)
    CREATE TABLE IF NOT EXISTS estudiantes_encargados (
      estudiante_id INT REFERENCES estudiantes(id) ON DELETE CASCADE,
      encargado_id INT REFERENCES encargados(id) ON DELETE CASCADE,
      parentesco VARCHAR(50) NOT NULL,
      PRIMARY KEY (estudiante_id, encargado_id)
    );

    CREATE TABLE IF NOT EXISTS mensualidades_personalizadas (
      id SERIAL PRIMARY KEY,
      inscripcion_id INT NOT NULL REFERENCES inscripciones(id) ON DELETE CASCADE,
      concepto VARCHAR(20) NOT NULL,
      monto DECIMAL(10,2) NOT NULL,
      CHECK (
        concepto IN (
          'Matrícula', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre'
        )
      ),
      UNIQUE (inscripcion_id, concepto)
    );

    -- TABLA GRUPOS_TARIFAS
    CREATE TABLE IF NOT EXISTS grupos_tarifas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE  -- Ej: 'Maternal', 'Inicial y Primaria', 'Secundaria'
    );

    -- TABLA TARIFAS
    CREATE TABLE IF NOT EXISTS tarifas (
      id SERIAL PRIMARY KEY,
      gestion INT NOT NULL,
      grupo_tarifa_id INT NOT NULL REFERENCES grupos_tarifas(id) ON DELETE CASCADE,
      costo_matricula DECIMAL(10,2) NOT NULL,
      costo_mensualidad DECIMAL(10,2) NOT NULL,
      UNIQUE (gestion, grupo_tarifa_id)
    );

    -- TABLA CURSOS_TARIFARIOS
    CREATE TABLE IF NOT EXISTS cursos_tarifarios (
      nombre_curso VARCHAR(50) NOT NULL,
      sucursal VARCHAR(20) NOT NULL CHECK (sucursal IN ('Primaria', 'Secundaria')),
      grupo_tarifa_id INT NOT NULL REFERENCES grupos_tarifas(id),
      PRIMARY KEY (nombre_curso, sucursal)
    );

    -- TABLA DE TARIFAS PERSONALIZADAS (Solo si el estudiante tiene un precio especial)
    CREATE TABLE IF NOT EXISTS tarifas_personalizadas (
      id SERIAL PRIMARY KEY,
      inscripcion_id INT REFERENCES inscripciones(id) ON DELETE CASCADE,
      costo_matricula DECIMAL(10,2) NOT NULL,
      costo_mensualidad DECIMAL(10,2) NOT NULL
    );

    -- TABLA DE PAGOS (Registra cada pago realizado por el estudiante)
    CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      inscripcion_id INT REFERENCES inscripciones(id) ON DELETE CASCADE,
      concepto VARCHAR(50) NOT NULL,  -- Puede ser "Matrícula" o "Mensualidad (Mes)"
      monto_pagado DECIMAL(10,2) NOT NULL,
      fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      metodo_pago VARCHAR(50),  -- Opcional (Efectivo, Transferencia, etc.)
      observaciones TEXT,
      operador TEXT,
      sucursal VARCHAR(20) NOT NULL
    );

    -- TABLA DE RECIBOS (Guarda los comprobantes de pago)
    CREATE TABLE IF NOT EXISTS recibos (
      id SERIAL PRIMARY KEY,
      pago_id INT REFERENCES pagos(id) ON DELETE CASCADE,
      estudiante_id INT REFERENCES estudiantes(id) ON DELETE CASCADE,
      nit VARCHAR(20),
      razon_social VARCHAR(200),
      fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      codigo VARCHAR(20) UNIQUE
    );

    -- TABLA DE PERSONAL
    CREATE TABLE IF NOT EXISTS personal (
      id SERIAL PRIMARY KEY,
      nombres VARCHAR(100) NOT NULL,
      apellidop VARCHAR(100) NOT NULL,
      apellidom VARCHAR(100) NOT NULL,
      ci VARCHAR(30) NOT NULL,
      fecha_nacimiento DATE,
      observaciones TEXT,
      telefono VARCHAR(30) NOT NULL
    );

    -- TABLA TIPO PERSONAL
    CREATE TABLE IF NOT EXISTS historial_roles (
      id SERIAL PRIMARY KEY,
      id_personal INTEGER REFERENCES personal(id),
      tipo_personal VARCHAR(50) NOT NULL,
      estado VARCHAR(10) DEFAULT 'activo'  -- 'activo' o 'inactivo'
    );

    -- TABLA DE CONTRATOS (anual, por tipo de personal)
    CREATE TABLE IF NOT EXISTS contratos (
      id SERIAL PRIMARY KEY,
      id_personal INTEGER REFERENCES personal(id) ON DELETE CASCADE,
      id_historial_rol INTEGER REFERENCES historial_roles(id),
      gestion INTEGER NOT NULL, -- Año (2023, 2024, etc.)
      tipo_contrato VARCHAR(50), -- 'medio_tiempo', 'tiempo_completo' (NULL si es profesor)
      id_turno INTEGER, -- NULL si tiempo completo o profesor
      sucursal VARCHAR(50) NOT NULL,
      sueldo_mensual NUMERIC(10, 2) NOT NULL,
      fecha_inicio DATE,
      fecha_fin DATE,
      observaciones TEXT
    );

    -- TABLA DE TURNOS (para medio tiempo u otros)
    CREATE TABLE IF NOT EXISTS turnos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL,
      hora_inicio TIME NOT NULL,
      hora_fin TIME NOT NULL
    );

    -- TABLA DE PAGOS MENSUALES AL PERSONAL
    CREATE TABLE IF NOT EXISTS pagos_personal (
      id SERIAL PRIMARY KEY,
      id_contrato INTEGER REFERENCES contratos(id) ON DELETE CASCADE,
      mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
      fecha_pago TIMESTAMP,
      monto_pagado NUMERIC(10, 2),
      observaciones TEXT,
      operador TEXT
    );

    -- TABLA DE MATERIAS
    CREATE TABLE IF NOT EXISTS materias (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      nivel VARCHAR(20) NOT NULL, -- 'primaria' o 'secundaria'
      estado VARCHAR(10) NOT NULL DEFAULT 'activo'
    );

    -- TABLA DE CURSOS
    CREATE TABLE IF NOT EXISTS cursos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL,
      nivel VARCHAR(20) NOT NULL -- 'primaria' o 'secundaria'
    );

    -- TABLA DE HORARIOS PARA PROFESORES (asociado al contrato)
    CREATE TABLE IF NOT EXISTS horarios_profesor (
      id SERIAL PRIMARY KEY,
      id_contrato INTEGER REFERENCES contratos(id) ON DELETE CASCADE,
      id_materia INTEGER REFERENCES materias(id) ON DELETE SET NULL,
      id_curso INTEGER REFERENCES cursos(id) ON DELETE SET NULL,
      dia_semana VARCHAR(20) NOT NULL, -- 'lunes', 'martes', etc.
      hora_inicio TIME NOT NULL,
      hora_fin TIME NOT NULL
    );

    -- TABLA talleres
    CREATE TABLE IF NOT EXISTS talleres (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('Primaria', 'Secundaria', 'Ambos')),
      estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
      descripcion TEXT
    );

    -- TABLA taller_fechas (ciclos del taller)
    CREATE TABLE IF NOT EXISTS taller_fechas (
      id SERIAL PRIMARY KEY,
      taller_id INT REFERENCES talleres(id) ON DELETE CASCADE,
      gestion INT NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
      UNIQUE (taller_id, gestion, fecha_inicio, fecha_fin)
    );

    -- TABLA taller_fechas_precios (precio por mes de un ciclo)
    CREATE TABLE IF NOT EXISTS taller_fechas_precios (
      id SERIAL PRIMARY KEY,
      taller_fecha_id INT REFERENCES taller_fechas(id) ON DELETE CASCADE,
      mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
      monto DECIMAL(10,2) NOT NULL,
      UNIQUE (taller_fecha_id, mes)
    );

    -- TABLA taller_inscripciones (inscripciones de estudiantes al taller ciclo)
    CREATE TABLE IF NOT EXISTS taller_inscripciones (
      id SERIAL PRIMARY KEY,
      taller_fecha_id INT REFERENCES taller_fechas(id) ON DELETE CASCADE,
      estudiante_id INT REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha_inscripcion DATE DEFAULT CURRENT_DATE,
      estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
      UNIQUE (taller_fecha_id, estudiante_id)
    );

    -- TABLA taller_pagos (pagos de los estudiantes por mes)
    CREATE TABLE IF NOT EXISTS taller_pagos (
      id SERIAL PRIMARY KEY,
      taller_inscripcion_id INT REFERENCES taller_inscripciones(id) ON DELETE CASCADE,
      mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
      monto_pagado DECIMAL(10,2) NOT NULL,
      fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      metodo_pago VARCHAR(50),
      observaciones TEXT,
      operador TEXT
    );

    -- TABLA Secciones de gastos
    CREATE TABLE IF NOT EXISTS secciones_gasto (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) UNIQUE NOT NULL,
      estado VARCHAR(20) DEFAULT 'activo'
    );

    CREATE TABLE IF NOT EXISTS gastos (
      id SERIAL PRIMARY KEY,
      id_usuario INTEGER,
      id_seccion INTEGER REFERENCES secciones_gasto(id),
      descripcion TEXT NOT NULL,
      observaciones TEXT,
      monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      sucursal VARCHAR(50) NOT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT gastos_id_usuario_fkey
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id)
        ON DELETE SET NULL
    );

    -- Tipos de producto
    CREATE TABLE IF NOT EXISTS tipos_producto (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL,
      descripcion TEXT
    );

    -- Productos
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL, -- 'uniforme' o 'libro'
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      curso VARCHAR(50), -- solo libros
      sucursal VARCHAR(50), -- 'Primaria' o 'Secundaria', solo libros
      materia_id INT REFERENCES materias(id) ON DELETE SET NULL, -- solo libros
      talla VARCHAR(10), -- solo uniformes
      precio NUMERIC(10,2) NOT NULL, -- 💡 nuevo: precio actual
      activo BOOLEAN DEFAULT TRUE
    );

    -- Historial de precios
    CREATE TABLE IF NOT EXISTS historial_precios (
      id SERIAL PRIMARY KEY,
      producto_id INT REFERENCES productos(id) ON DELETE CASCADE,
      precio NUMERIC(10,2) NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      operacion VARCHAR(20) DEFAULT 'cambio' -- 'creacion' o 'cambio'
    );

    -- Compras (cabecera)
    CREATE TABLE IF NOT EXISTS compras (
      id SERIAL PRIMARY KEY,
      inscripcion_id INT REFERENCES inscripciones(id) ON DELETE CASCADE,
      fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
      estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' -- Pendiente | Parcial | Pagado
    );

    -- Detalles de productos comprados en una compra
    CREATE TABLE IF NOT EXISTS compras_detalle (
      id SERIAL PRIMARY KEY,
      compra_id INT REFERENCES compras(id) ON DELETE CASCADE,
      producto_id INT REFERENCES productos(id) ON DELETE CASCADE,
      cantidad INT NOT NULL DEFAULT 1,
      precio_unitario NUMERIC(10,2) NOT NULL
    );

    -- Pagos por compra
    CREATE TABLE IF NOT EXISTS pagos_compra (
      id SERIAL PRIMARY KEY,
      compra_id INT REFERENCES compras(id) ON DELETE CASCADE,
      fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      monto NUMERIC(10,2) NOT NULL,
      metodo_pago VARCHAR(50),
      observacion TEXT,
      operador VARCHAR(100)
    );

  `;

  try {
    await pool.query(query);
    console.log("✅ Tablas creadas exitosamente.");
  } catch (error) {
    console.error("❌ Error creando tablas:", error);
  } finally {
    pool.end();
  }
};

crearTablas();
