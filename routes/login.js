const express = require("express");
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const verificarToken = require("../middlewares/auth");

router.post("/", async (req, res) => {
  const { login, contrasenia } = req.body;

  try {
    const query = `
      SELECT * FROM usuarios 
      WHERE LOWER(nickname) = $1 OR LOWER(correo) = $1
    `;
    const result = await pool.query(query, [login.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const usuario = result.rows[0];

    // Comparar contraseña hasheada
    const match = await bcrypt.compare(contrasenia, usuario.contrasenia);
    if (!match) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Verificar estado si NO es administrador
    const esAdmin =
      usuario.rol === "Administrador" || usuario.rol === "Administradora";

    if (!esAdmin) {
      if (usuario.estado === "Pendiente") {
        return res.status(403).json({
          error: "Tu cuenta está en revisión. Espera aprobación.",
          estado: "Pendiente",
        });
      }

      if (usuario.estado === "Suspendido") {
        return res.status(403).json({
          error: "Tu cuenta está suspendida temporalmente.",
          estado: "Suspendido",
        });
      }

      if (usuario.estado === "Rechazado") {
        return res.status(403).json({
          error: "Tu cuenta fue rechazada por el administrador.",
          estado: "Rechazado",
        });
      }
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        sucursal: usuario.sucursal,
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "6h" }
    );

    res.json({
      message: "Autenticación exitosa",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidop: usuario.apellidop,
        apellidom: usuario.apellidom,
        rol: usuario.rol,
        sucursal: usuario.sucursal,
        nickname: usuario.nickname,
        estado: usuario.estado,
        correo: usuario.correo,
        genero: usuario.genero,
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Endpoint para renovar token
router.post("/renovar-token", verificarToken, async (req, res) => {
  try {
    const usuario = req.usuario;
    const query = "SELECT * FROM usuarios WHERE id = $1";
    const result = await pool.query(query, [usuario.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const usuarioDB = result.rows[0];

    // Verificar que el usuario esté activo (si aplica)
    if (
      usuarioDB.estado !== "Principal" &&
      usuarioDB.estado !== "No Principal" &&
      usuarioDB.estado !== "Aceptado"
    ) {
      return res.status(403).json({ error: "Usuario no está activo" });
    }

    // Generar NUEVO token con la misma información pero nuevo tiempo
    const nuevoToken = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        sucursal: usuario.sucursal,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "6h" }
    );

    res.json({
      message: "Token renovado exitosamente",
      token: nuevoToken,
      usuario: {
        id: usuarioDB.id,
        nombre: usuarioDB.nombre,
        apellidop: usuarioDB.apellidop,
        apellidom: usuarioDB.apellidom,
        rol: usuarioDB.rol,
        sucursal: usuarioDB.sucursal,
        nickname: usuarioDB.nickname,
        estado: usuarioDB.estado,
        correo: usuarioDB.correo,
        genero: usuarioDB.genero,
      },
    });
  } catch (error) {
    console.error("❌ Error renovando token:", error);
    res.status(500).json({ error: "Error al renovar token" });
  }
});

module.exports = router;
