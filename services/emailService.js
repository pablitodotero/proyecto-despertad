// emailServiceBrevo.js
require("dotenv").config();
const brevo = require("@getbrevo/brevo");

// Configuración del cliente Brevo
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new brevo.TransactionalEmailsApi();

/**
 * Enviar correo con Brevo
 * @param {Object} options
 * @param {string} options.to - Correo destino
 * @param {string} options.subject - Asunto del correo
 * @param {string} options.text - Texto plano
 * @param {string} options.html - HTML del correo
 * @param {Array} options.attachments - Archivos adjuntos [{ filename, content }]
 */
async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail({
      sender: { name: "SIREDE", email: "pablo.crj.mss@gmail.com" },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
      attachment: attachments.map((attachment) => ({
        name: attachment.filename,
        content: attachment.content.toString("base64"),
      })),
    });

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Correo enviado con Brevo. Message ID:", data.messageId);
    return data;
  } catch (error) {
    console.error(
      "❌ Error al enviar correo con Brevo:",
      error.response?.body || error.message
    );
    throw error;
  }
}

module.exports = { sendEmail };
