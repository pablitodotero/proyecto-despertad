// routes/emailRoutes.js (por ejemplo)

const express = require("express");
const router = express.Router();
const { sendEmail } = require("../services/emailService");

router.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text, html, attachments } = req.body;

    const info = await sendEmail({ to, subject, text, html, attachments });

    return res
      .status(200)
      .json({ message: "Correo enviado exitosamente", info });
  } catch (error) {
    console.error("Error en /send-email:", error);
    return res.status(500).json({ message: "Error al enviar correo", error });
  }
});

module.exports = router;
