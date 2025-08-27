const { Resend } = require("resend");
require("dotenv").config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html, attachments }) {
  try {
    const data = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to,
      subject,
      html,
      attachments,
    });

    console.log("Correo enviado con Resend:", data);
    return true;
  } catch (error) {
    console.error("Error al enviar correo con Resend:", error);
    throw error;
  }
}

module.exports = { sendEmail };
