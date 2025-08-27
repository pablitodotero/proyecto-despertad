const SibApiV3Sdk = require("sib-api-v3-sdk");
require('dotenv').config();
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Función de validación de email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    // Normalizar 'to' para que siempre sea un array
    const normalizedTo = Array.isArray(to) ? to : [to];

    // Validar que el array no esté vacío
    if (normalizedTo.length === 0) {
      throw new Error("El campo 'to' debe contener al menos un email.");
    }

    // Validar cada email
    const invalidEmails = normalizedTo.filter(
      (email) => typeof email !== "string" || !isValidEmail(email)
    );
    if (invalidEmails.length > 0) {
      throw new Error(`Email(s) inválido(s): ${invalidEmails.join(", ")}`);
    }

    // Preparar adjuntos
    const brevoAttachments = attachments.map((attachment) => ({
      name: attachment.filename,
      content: attachment.content.toString("base64"),
    }));

    // Configurar el correo
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: "SIREDE",
      email: process.env.BREVO_FROM,
    };
    sendSmtpEmail.to = normalizedTo.map((email) => ({ email }));
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.htmlContent = html;

    if (brevoAttachments.length > 0) {
      sendSmtpEmail.attachment = brevoAttachments;
    }

    // Enviar
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Correo enviado con Brevo. Message ID: ", data.messageId);
    return data;
  } catch (error) {
    console.error("Error al enviar correo con Brevo:");
    console.error("Destinatario:", to);
    console.error("Error completo:", error.message);
    throw error;
  }
}

module.exports = { sendEmail };
