const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { sendEmail } = require("../services/emailService");
const bcrypt = require("bcrypt");

// ========================================================
//  Generar código alfanumérico (6 caracteres)
// ========================================================
function generarCodigoAlfanumerico(longitud) {
  const caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let resultado = "";
  for (let i = 0; i < longitud; i++) {
    const randomIndex = Math.floor(Math.random() * caracteres.length);
    resultado += caracteres[randomIndex];
  }
  return resultado;
}

// ========================================================
//  1) POST /api/recover-password/forgot
//     - Usuario ingresa su correo o nickname
//     - Generamos un código, guardamos en reset_codes, enviamos mail
// ========================================================
router.post("/forgot", async (req, res) => {
  try {
    const { loginOrEmail } = req.body;
    if (!loginOrEmail) {
      return res.status(400).json({ message: "Falta el correo o nickname." });
    }

    // 1. Buscar usuario por correo o nickname
    const queryUser = `
      SELECT id, correo
      FROM usuarios
      WHERE correo = $1 OR nickname = $1
      LIMIT 1
    `;
    const result = await pool.query(queryUser, [loginOrEmail.toLowerCase()]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontró usuario con ese correo/nickname." });
    }
    const usuario = result.rows[0];

    // 2. Generar código y calcular fecha de expiración
    const code = generarCodigoAlfanumerico(6);
    const expiresAt = new Date();
    // Expira en 30 minutos
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const checkQuery = `
  SELECT id FROM reset_codes WHERE user_id = $1
  `;
    const existingCode = await pool.query(checkQuery, [usuario.id]);

    if (existingCode.rows.length > 0) {
      // Ya existe, hacemos UPDATE
      const updateQuery = `
    UPDATE reset_codes
    SET code = $1, expires_at = $2, used = false
    WHERE user_id = $3
  `;
      await pool.query(updateQuery, [code, expiresAt, usuario.id]);
    } else {
      // No existe, hacemos INSERT
      const insertQuery = `
    INSERT INTO reset_codes (user_id, code, expires_at)
    VALUES ($1, $2, $3)
  `;
      await pool.query(insertQuery, [usuario.id, code, expiresAt]);
    }

    // 4. Enviar correo
    const asunto = "Recuperación de contraseña";
    const textoPlano = `
      Se solicitó un restablecimiento de contraseña.
      Tu código es: ${code}
      Este código expira en 30 minutos.
    `;
    const html = `
      <p>Se solicitó un restablecimiento de contraseña.</p>
      <p>Tu código es: <strong>${code}</strong></p>
      <p>Este código expira en 30 minutos.</p>
    `;

    await sendEmail({
      to: usuario.correo,
      subject: asunto,
      text: textoPlano,
      html: html,
    });

    return res.json({ message: "Código enviado a tu correo." });
  } catch (error) {
    console.error("Error en /forgot:", error);
    return res
      .status(500)
      .json({ message: "Error al solicitar recuperación." });
  }
});

// ========================================================
//  2) POST /api/recover-password/verify
//     - Verificamos si el código es válido (no expirado, no usado)
//     - Si es válido, respondemos "Código válido"
// ========================================================
router.post("/verify", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: "Falta el código." });
    }

    const query = `
      SELECT user_id
      FROM reset_codes
      WHERE code = $1
        AND used = false
        AND expires_at > NOW()
      LIMIT 1
    `;
    const result = await pool.query(query, [code]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Código inválido o expirado." });
    }

    return res.json({ message: "Código válido" });
  } catch (error) {
    console.error("Error en /verify:", error);
    return res.status(500).json({ message: "Error al verificar el código." });
  }
});

// ========================================================
//  3) POST /api/recover-password/reset
//     - Cambiamos contraseña si el código existe y está válido
//     - Marcamos used = true
// ========================================================
router.post("/reset", async (req, res) => {
  try {
    const { code, nuevaContrasenia } = req.body;
    if (!code || !nuevaContrasenia) {
      return res
        .status(400)
        .json({ message: "Faltan datos (código o contraseña)." });
    }

    // 1. Verificar que el code esté en reset_codes, no usado y no expirado
    const query = `
      SELECT user_id
      FROM reset_codes
      WHERE code = $1
        AND used = false
        AND expires_at > NOW()
      LIMIT 1
    `;
    const result = await pool.query(query, [code]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Código inválido o expirado." });
    }
    const userId = result.rows[0].user_id;

    // 2. Hashear la nueva contraseña
    const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;
    if (!regex.test(nuevaContrasenia)) {
      return res.status(400).json({
        message:
          "La contraseña no cumple los requisitos mínimos: 8 caracteres, una mayúscula y un número.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaContrasenia, salt);

    // 3. Actualizar la contraseña del usuario
    const updateUserQuery = `
      UPDATE usuarios
      SET contrasenia = $1
      WHERE id = $2
    `;
    await pool.query(updateUserQuery, [hashedPassword, userId]);

    // 4. Marcar el code como used = true
    const updateCodeQuery = `
      UPDATE reset_codes
      SET used = true
      WHERE code = $1
    `;
    await pool.query(updateCodeQuery, [code]);

    return res.json({ message: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error("Error en /reset:", error);
    return res
      .status(500)
      .json({ message: "Error al restablecer la contraseña." });
  }
});

module.exports = router;
