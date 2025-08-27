// routes/notificaciones.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { sendEmail } = require("../services/emailService");

// NOTIFICACION AL CAMBIAR EL ESTADO DE UN USUARIO
router.post("/estado-usuario", async (req, res) => {
  const { correo, nombreCompleto, accion } = req.body;

  if (!correo || !nombreCompleto || !accion) {
    return res.status(400).json({ message: "Faltan datos requeridos." });
  }

  let asunto = "Estado de tu cuenta en SIREDE";
  let mensaje = "";

  switch (accion) {
    case "aceptado":
      mensaje = `Estimado/a ${nombreCompleto}, el administrador ha aceptado tu cuenta.`;
      break;
    case "rechazado":
      mensaje = `Estimado/a ${nombreCompleto}, tu cuenta ha sido rechazada.`;
      break;
    case "eliminado":
      mensaje = `Estimado/a ${nombreCompleto}, el administrador decidió eliminar tu cuenta.`;
      break;
    default:
      return res.status(400).json({ message: "Acción no válida." });
  }

  const extra = "Si usted no tiene relación con este mensaje, puede ignorarlo.";
  const html = `<p>${mensaje}</p><p><em>${extra}</em></p>`;
  const text = `${mensaje}\n\n${extra}`;

  try {
    await sendEmail({ to: [correo], subject: asunto, text, html });
    return res.json({ message: "Correo enviado correctamente." });
  } catch (error) {
    console.error("Error al enviar correo:", error);
    return res.status(500).json({ message: "No se pudo enviar el correo." });
  }
});

// NOTIFICACION AL REGISTRARSE UN NUEVO USUARIO
router.post("/nuevo-registro", async (req, res) => {
  const { nombreCompleto } = req.body;

  if (!nombreCompleto) {
    return res
      .status(400)
      .json({ message: "Falta el nombre del solicitante." });
  }

  try {
    // Buscar correos de administradores principales
    const consulta = `
        SELECT correo FROM usuarios
        WHERE (rol = 'Administrador' OR rol = 'Administradora')
        AND estado = 'Principal'
      `;

    const resultado = await pool.query(consulta);
    const correos = resultado.rows.map((r) => r.correo);

    if (correos.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay administradores principales registrados." });
    }

    const asunto = "Nueva solicitud de registro en SIREDE";
    const mensaje = `El usuario ${nombreCompleto} está solicitando unirse a SIREDE. Por favor, verifica las solicitudes pendientes y acepta o rechaza según corresponda.`;
    const extra = "Si no reconoces este mensaje, simplemente ignóralo.";

    const html = `<p>${mensaje}</p><p><em>${extra}</em></p>`;
    const text = `${mensaje}\n\n${extra}`;

    await sendEmail({
      to: correos,
      subject: asunto,
      text,
      html,
    });

    return res.json({ message: "Notificación enviada a administradores." });
  } catch (error) {
    console.error("Error al notificar registro:", error);
    return res.status(500).json({ message: "Error al enviar notificación." });
  }
});

//ENVIAR RECIBOS POR CORREO
router.post("/enviar-recibo", async (req, res) => {
  const { destinatarios, nombres, mensaje, pdfBase64, nombreArchivo } =
    req.body;

  if (!destinatarios || !pdfBase64 || !nombreArchivo) {
    return res.status(400).json({ message: "Faltan datos requeridos." });
  }

  try {
    const attachment = {
      filename: nombreArchivo,
      content: pdfBase64.split("base64,")[1],
      encoding: "base64",
    };

    const html = `
        <p>${mensaje}</p>
        <p><strong>Destinatarios:</strong> ${nombres.join(", ")}</p>
        <p><em>Adjunto encontrará su recibo en formato PDF.</em></p>
      `;

    const text = `${mensaje}\n\nDestinatarios: ${nombres.join(
      ", "
    )}\nAdjunto encontrará su recibo.`;

    await sendEmail({
      to: destinatarios,
      subject: "Recibo de pago - SIREDE",
      text,
      html,
      attachments: [attachment],
    });

    return res.json({ message: "Correo(s) enviado(s) correctamente." });
  } catch (error) {
    console.error("Error al enviar correo con recibo:", error);
    return res.status(500).json({ message: "No se pudo enviar el correo." });
  }
});

module.exports = router;
