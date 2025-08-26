const express = require("express");
const pool = require("../config/db");

const router = express.Router();
const bcrypt = require("bcrypt");

const path = require("path");
const verificarToken = require("../middlewares/auth");

//Descargar Manual
router.get("/manual", verificarToken, (req, res) => {
  const rolQuery = req.query.rol?.toString().toLowerCase();
  const rolUsuario = req.usuario.rol.toLowerCase();
  const rol = rolQuery || rolUsuario;

  let fileName;
  if (rol.includes("admin")) fileName = "administrador.pdf";
  else if (rol.includes("director")) fileName = "director.pdf";
  else if (rol.includes("secretario")) fileName = "secretario.pdf";
  else return res.status(403).json({ message: "Rol no autorizado" });

  const filePath = path.join(__dirname, "..", "manuals", fileName);
  res.sendFile(filePath);
});

// Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM usuarios");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error obteniendo usuarios:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//Crear Usuario
router.post("/", async (req, res) => {
  const {
    nombre,
    apellidop,
    apellidom,
    nickname,
    genero,
    rol,
    correo,
    contrasenia,
    sucursal,
    estado,
  } = req.body;

  const correoLower = correo.toLowerCase();
  const nicknameLower = nickname.toLowerCase();

  try {
    // Hashear la contraseña antes de guardar
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(contrasenia, saltRounds);

    const query = `INSERT INTO usuarios 
      (nombre, apellidop, apellidom, nickname, genero, rol, correo, contrasenia, sucursal, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;

    const values = [
      nombre,
      apellidop,
      apellidom,
      nicknameLower,
      genero,
      rol,
      correoLower,
      hashedPassword,
      sucursal,
      estado,
    ];

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error creando usuario:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Verificar si un nickname existe
router.get("/checkNickname/:nickname", async (req, res) => {
  const nicknameParam = req.params.nickname.toLowerCase();
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS count FROM usuarios WHERE LOWER(nickname) = $1",
      [nicknameParam]
    );
    const count = parseInt(result.rows[0].count, 10);
    res.json({ exists: count > 0 });
  } catch (error) {
    console.error("❌ Error verificando nickname:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Verificar si un correo existe
router.get("/checkEmail/:correo", async (req, res) => {
  const correoParam = req.params.correo.toLowerCase(); 
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS count FROM usuarios WHERE LOWER(correo) = $1",
      [correoParam]
    );
    const count = parseInt(result.rows[0].count, 10);
    res.json({ exists: count > 0 });
  } catch (error) {
    console.error("❌ Error verificando correo:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//Obtener usuarios sin admins
router.get("/solo-visibles", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM usuarios 
      WHERE rol IS NOT NULL AND LOWER(rol) NOT IN ('administrador', 'administradora')
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error obteniendo usuarios visibles:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//Obtener solo admins
router.get("/admins", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM usuarios 
      WHERE LOWER(rol) IN ('administrador', 'administradora')
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error obteniendo admins:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Obtener un usuario por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error obteniendo usuario:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Eliminar un usuario por ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando usuario:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//CAMBIAR LOS 4 ESTADOS
router.put("/cambiar-estado/:id", async (req, res) => {
  const { id } = req.params;
  const { nuevoEstado } = req.body;

  try {
    const result = await pool.query(
      "UPDATE usuarios SET estado = $1 WHERE id = $2 RETURNING *",
      [nuevoEstado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ mensaje: "Estado actualizado", usuario: result.rows[0] });
  } catch (error) {
    console.error("❌ Error al cambiar estado:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//Aceptar usuario modificando rol
router.put("/aceptar/:id", async (req, res) => {
  const { id } = req.params;
  const { rol, sucursal } = req.body;

  try {
    const result = await pool.query(
      `UPDATE usuarios 
       SET estado = 'Aceptado', rol = $1, sucursal = $2 
       WHERE id = $3 
       RETURNING *`,
      [rol, sucursal, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ mensaje: "Usuario aceptado", usuario: result.rows[0] });
  } catch (error) {
    console.error("❌ Error aceptando usuario:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//PARA EDITAR
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const allowedFields = [
      "nombre",
      "apellidop",
      "apellidom",
      "nickname",
      "genero",
      "rol",
      "correo",
      "sucursal",
      "estado",
    ];
    const setClauses = [];
    const values = [];
    let index = 1;

    // Recorrer los campos permitidos y ver cuáles están en updates
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${index}`);
        values.push(updates[field]);
        index++;
      }
    }

    if (setClauses.length === 0) {
      return res
        .status(400)
        .json({ message: "No hay campos válidos para actualizar." });
    }

    // Completar query
    const sql = `
      UPDATE usuarios
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING *
    `;
    values.push(id);

    const result = await pool.query(sql, values);

    // Si no encontró el usuario
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    // Devolver el usuario actualizado
    const usuarioActualizado = result.rows[0];
    res.json({
      message: "Usuario actualizado exitosamente",
      usuario: usuarioActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res
      .status(500)
      .json({ message: "Ocurrió un error al actualizar el usuario" });
  }
});

// cambiarContrasenia
router.post("/:id/cambiarContrasenia", async (req, res) => {
  const { id } = req.params;
  const { contraseniaActual, contraseniaNueva } = req.body;

  try {
    // 1. Obtener la contraseña actual de la BD
    const queryGet = "SELECT contrasenia FROM usuarios WHERE id = $1";
    const result = await pool.query(queryGet, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const contraseniaHasheada = result.rows[0].contrasenia;

    // 2. Verificar que la contraseña actual sea correcta
    const match = await bcrypt.compare(contraseniaActual, contraseniaHasheada);
    if (!match) {
      // Retornar un mensaje de error indicando que la contraseña actual no es la correcta.
      return res.status(400).json({ message: "CONTRASENIA_ACTUAL_INCORRECTA" });
    }

    // 3. Hashear la nueva contraseña
    const nuevaHasheada = await bcrypt.hash(contraseniaNueva, 10);

    // 4. Guardar la nueva contraseña en la BD
    const queryUpdate = `
      UPDATE usuarios
      SET contrasenia = $1
      WHERE id = $2
      RETURNING id, nombre, apellidop, apellidom, nickname, correo
    `;
    const resultUpdate = await pool.query(queryUpdate, [nuevaHasheada, id]);

    if (resultUpdate.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Usuario no encontrado al actualizar." });
    }

    // 5. Responder con éxito
    const usuarioActualizado = resultUpdate.rows[0];
    res.json({
      message: "Contraseña actualizada correctamente",
      usuario: usuarioActualizado,
    });
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    res
      .status(500)
      .json({ message: "Ocurrió un error al cambiar la contraseña" });
  }
});

//NUEVO CHECKNICKNAME
router.get("/checkNicknameU/:nickname", async (req, res) => {
  const nicknameParam = req.params.nickname.toLowerCase();
  const userId = req.query.userId;

  try {
    let query =
      "SELECT COUNT(*) AS count FROM usuarios WHERE LOWER(nickname) = $1";
    const params = [nicknameParam];

    if (userId) {
      query += " AND id <> $2";
      params.push(userId);
    }

    const result = await pool.query(query, params);
    const count = parseInt(result.rows[0].count, 10);
    res.json({ exists: count > 0 });
  } catch (error) {
    console.error("❌ Error verificando nickname:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//NUEVO CHECKGMAIL
router.get("/checkEmailU/:correo", async (req, res) => {
  const correoParam = req.params.correo.toLowerCase();
  const userId = req.query.userId;

  try {
    let query =
      "SELECT COUNT(*) AS count FROM usuarios WHERE LOWER(correo) = $1";
    const params = [correoParam];

    if (userId) {
      query += " AND id <> $2";
      params.push(userId);
    }

    const result = await pool.query(query, params);
    const count = parseInt(result.rows[0].count, 10);
    res.json({ exists: count > 0 });
  } catch (error) {
    console.error("❌ Error verificando correo:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

module.exports = router;
