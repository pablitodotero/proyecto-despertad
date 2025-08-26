const pool = require("../config/db");

const insertarUsuarios = async () => {
  try {
    // Definir los 5 usuarios a insertar
    //Contraseña: Qwer1234
    const usuarios = [
      {
        nombre: "Juan",
        apellidop: "Pérez",
        apellidom: "Gómez",
        nickname: "juan",
        genero: "Masculino",
        rol: "Administrador",
        correo: "juan.perez@example.com",
        contrasenia: "$2b$10$to0Us9sbCT3v0.IVfieWNO/Zrf2pot.TM6Bh8d/UQiN2a4.hME9pu",
        sucursal: "Primaria",
        estado: "Principal",
      },
      {
        nombre: "María",
        apellidop: "López",
        apellidom: "Rodríguez",
        nickname: "maria",
        genero: "Femenino",
        rol: "Administradora",
        correo: "maria.lopez@example.com",
        contrasenia: "$2b$10$to0Us9sbCT3v0.IVfieWNO/Zrf2pot.TM6Bh8d/UQiN2a4.hME9pu",
        sucursal: "Primaria",
        estado: "Principal",
      },
      {
        nombre: "Carlos",
        apellidop: "García",
        apellidom: "Martínez",
        nickname: "carlos",
        genero: "Masculino",
        rol: "Administrador",
        correo: "carlos.garcia@example.com",
        contrasenia: "$2b$10$to0Us9sbCT3v0.IVfieWNO/Zrf2pot.TM6Bh8d/UQiN2a4.hME9pu",
        sucursal: "Primaria",
        estado: "No Principal",
      },
      {
        nombre: "Ana",
        apellidop: "Torres",
        apellidom: "Vargas",
        nickname: "ana",
        genero: "Femenino",
        rol: "Directora",
        correo: "ana.torres@example.com",
        contrasenia: "$2b$10$to0Us9sbCT3v0.IVfieWNO/Zrf2pot.TM6Bh8d/UQiN2a4.hME9pu",
        sucursal: "Secundaria",
        estado: "Aceptado",
      },
      {
        nombre: "Ernesto",
        apellidop: "Fernández",
        apellidom: "Díaz",
        nickname: "ernestito",
        genero: "Masculino",
        rol: "Secretario",
        correo: "luis.fernandez@example.com",
        contrasenia: "$2b$10$to0Us9sbCT3v0.IVfieWNO/Zrf2pot.TM6Bh8d/UQiN2a4.hME9pu",
        sucursal: "Primaria",
        estado: "Aceptado",
      },
    ];

    // Insertar cada usuario
    for (const usuario of usuarios) {
      await pool.query(
        `INSERT INTO usuarios 
        (nombre, apellidop, apellidom, nickname, genero, rol, correo, contrasenia, sucursal, estado) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          usuario.nombre,
          usuario.apellidop,
          usuario.apellidom,
          usuario.nickname,
          usuario.genero,
          usuario.rol,
          usuario.correo,
          usuario.contrasenia,
          usuario.sucursal,
          usuario.estado,
        ]
      );
    }

    console.log("✅ 5 usuarios insertados correctamente.");
  } catch (error) {
    console.error("❌ Error insertando usuarios:", error);
  } finally {
    pool.end();
  }
};

insertarUsuarios();
