const pool = require("../config/db");

const insertarUsuarios = async () => {
  try {
    //Contraseña: 1. bjvvY7VbkM#   2. s73s5fXbuc#
    const usuarios = [
      {
        nombre: "Nombres",
        apellidop: "Apellido",
        apellidom: "Apellido",
        nickname: "admin1",
        genero: "Masculino",
        rol: "Administrador",
        correo: "adminOne@example.com",
        contrasenia: "$2b$10$vk1zAmHsO1P9Y/6e7fFQQel7Jfer.BAyhGTQ3B9Ur98WHSZ94FTui",
        sucursal: "Primaria",
        estado: "Principal",
      },
      {
        nombre: "Nombres",
        apellidop: "Apellido",
        apellidom: "Apellido",
        nickname: "admin2",
        genero: "Femenino",
        rol: "Administradora",
        correo: "adminTwo@example.com",
        contrasenia: "$2b$10$b0Cx4kNZ/yHyeV1vdkPuSOkgQ3ht1r8xO70AriiXlusZMg7SwpLEu",
        sucursal: "Primaria",
        estado: "Principal",
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
