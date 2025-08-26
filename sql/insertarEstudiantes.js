const pool = require("../config/db");

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[randInt(0, arr.length - 1)];

// Datos base
const nombresMasculinos = [
  "Juan",
  "Carlos",
  "Luis",
  "Marco",
  "Gabriel",
  "Diego",
  "Jorge",
  "Pablo",
  "Andrés",
  "Sebastián",
];
const nombresFemeninos = [
  "Ana",
  "María",
  "Laura",
  "Sofía",
  "Valeria",
  "Lucía",
  "Camila",
  "Daniela",
  "Isabel",
  "Mónica",
];
const apellidos = [
  "López",
  "Vargas",
  "Flores",
  "García",
  "Martínez",
  "Rojas",
  "Castro",
  "Gutiérrez",
  "Pérez",
  "Torres",
];

const parentescos = [
  "Padre",
  "Madre",
  "Primo",
  "Prima",
  "Abuelo",
  "Abuela",
  "Hermano",
  "Hermana",
  "Tutor",
  "Tío",
  "Tía",
];

const cursosPrimaria = [
  "Maternal",
  "Inicial I",
  "Inicial II",
  "Primero",
  "Segundo",
  "Tercero",
  "Cuarto",
  "Quinto",
  "Sexto",
];
const cursosSecundaria = [
  "Primero",
  "Segundo",
  "Tercero",
  "Cuarto",
  "Quinto",
  "Sexto",
];

const generarEstudiantes = () => {
  const estudiantes = [];
  let codCounter = { 2023: 1, 2024: 1, 2025: 1 };

  for (let i = 0; i < 15; i++) {
    const esFemenino = i % 2 === 0;
    const nombre = randomChoice(
      esFemenino ? nombresFemeninos : nombresMasculinos
    );
    const apellidop = randomChoice(apellidos);
    const apellidom = randomChoice(apellidos);
    const fechaNacimiento = `${randInt(2007, 2021)}-${String(
      randInt(1, 12)
    ).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
    const carnetIdentidad = String(randInt(10 ** 4, 10 ** 15 - 1));

    // Nit & Razon Social
    const nitOptions = [
      { nit: "", razon: "" },
      { nit: "1234567", razon: "López" },
      { nit: "2345678", razon: "Vargas" },
      { nit: "3456789", razon: "Flores" },
    ];
    const { nit, razon } = randomChoice(nitOptions);

    // cod_est
    const year = randomChoice([2023, 2024, 2025]);
    const sequence = String(codCounter[year]++).padStart(4, "0");
    const codEst = `${year}${sequence}`;

    estudiantes.push({
      nombre,
      apellidop,
      apellidom,
      fechaNacimiento,
      carnetIdentidad,
      correo: "usuario@example.com",
      nit,
      razonSocial: razon,
      direccion: "Mi dirección",
      genero: esFemenino ? "Femenino" : "Masculino",
      codEst,
    });
  }
  return estudiantes;
};

// Generar encargados
const generarEncargados = () => {
  const encargados = [];
  for (let i = 0; i < 10; i++) {
    const esFemenino = i % 2 === 1;
    const nombre = randomChoice(
      esFemenino ? nombresFemeninos : nombresMasculinos
    );
    const apellidop = randomChoice(apellidos);
    const apellidom = randomChoice(apellidos);

    const carnetIdentidad = String(randInt(10 ** 4, 10 ** 15 - 1));
    const celular = `${randomChoice([6, 7])}${randInt(10 ** 5, 10 ** 7 - 1)}`;

    encargados.push({
      nombre,
      apellidop,
      apellidom,
      carnetIdentidad,
      celular,
      correo: "usuario@example.com",
      genero: esFemenino ? "Femenino" : "Masculino",
    });
  }
  return encargados;
};

// Generar inscripciones según reglas
const generarInscripciones = (estudianteIdMap) => {
  const inscripciones = [];

  estudianteIdMap.forEach((id, idx) => {
    const numInsc = randInt(1, 3);
    const years = [2023, 2024, 2025]
      .sort(() => Math.random() - 0.5)
      .slice(0, numInsc)
      .sort();

    let nivelActual = "Primaria";
    let cursoIdx = randInt(0, cursosPrimaria.length - 1);

    years.forEach((year, i) => {
      // elegir sucursal / curso
      let sucursal = nivelActual;
      let curso;

      if (sucursal === "Primaria") {
        curso = cursosPrimaria[cursoIdx];
        // Avanza para la siguiente inscripción
        cursoIdx = Math.min(cursoIdx + 1, cursosPrimaria.length - 1);
        // Si pasa Sexto de Primaria, cambiar a Secundaria Primero
        if (curso === "Sexto") {
          nivelActual = "Secundaria";
          cursoIdx = 0;
        }
      } else {
        // Secundaria
        curso = cursosSecundaria[cursoIdx];
        cursoIdx = Math.min(cursoIdx + 1, cursosSecundaria.length - 1);
      }

      inscripciones.push({
        estudiante_id: id,
        gestion: year,
        sucursal,
        curso,
        fecha_inscripcion: `${year}-01-01`,
      });
    });
  });

  return inscripciones;
};

// Vincular estudiantes con encargados
const generarEstudiantesEncargados = (estudianteIdMap, encargadoIdMap) => {
  const rel = [];
  estudianteIdMap.forEach((estId) => {
    const numEnc = randInt(1, 3);
    const encargadosElegidos = [];

    while (encargadosElegidos.length < numEnc) {
      const encId = randomChoice(encargadoIdMap);
      if (!encargadosElegidos.includes(encId)) encargadosElegidos.push(encId);
    }

    encargadosElegidos.forEach((encId) => {
      rel.push({
        estudiante_id: estId,
        encargado_id: encId,
        parentesco: randomChoice(parentescos),
      });
    });
  });
  return rel;
};

// Inserción en BBDD
const insertarEstudiantes = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Estudiantes
    const estudiantes = generarEstudiantes();
    const estudianteIdMap = [];

    for (const est of estudiantes) {
      const res = await client.query(
        `INSERT INTO estudiantes
          (nombre, apellidop, apellidom, fecha_nacimiento, carnet_identidad, correo, nit, razon_social, direccion, genero, cod_est)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id;`,
        [
          est.nombre,
          est.apellidop,
          est.apellidom,
          est.fechaNacimiento,
          est.carnetIdentidad,
          est.correo,
          est.nit || null,
          est.razonSocial || null,
          est.direccion,
          est.genero,
          est.codEst,
        ]
      );
      estudianteIdMap.push(res.rows[0].id);
    }

    // 2. Encargados
    const encargados = generarEncargados();
    const encargadoIdMap = [];

    for (const enc of encargados) {
      const res = await client.query(
        `INSERT INTO encargados (nombre, apellidop, apellidom, carnet_identidad, celular, correo, genero)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id;`,
        [
          enc.nombre,
          enc.apellidop,
          enc.apellidom,
          enc.carnetIdentidad,
          enc.celular,
          enc.correo,
          enc.genero,
        ]
      );
      encargadoIdMap.push(res.rows[0].id);
    }

    // 3. Inscripciones
    const inscripciones = generarInscripciones(estudianteIdMap);
    for (const ins of inscripciones) {
      await client.query(
        `INSERT INTO inscripciones (estudiante_id, gestion, sucursal, curso, fecha_inscripcion, estado)
         VALUES ($1,$2,$3,$4,$5,'Activo');`,
        [
          ins.estudiante_id,
          ins.gestion,
          ins.sucursal,
          ins.curso,
          ins.fecha_inscripcion,
        ]
      );
    }

    // 4. Tabla intermedia estudiantes_encargados
    const rel = generarEstudiantesEncargados(estudianteIdMap, encargadoIdMap);
    for (const row of rel) {
      await client.query(
        `INSERT INTO estudiantes_encargados (estudiante_id, encargado_id, parentesco)
         VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING;`,
        [row.estudiante_id, row.encargado_id, row.parentesco]
      );
    }

    await client.query("COMMIT");
    console.log("✅ Sección Estudiantes cargada correctamente.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error cargando datos de estudiantes:", err);
  } finally {
    client.release();
  }
};

insertarEstudiantes();
