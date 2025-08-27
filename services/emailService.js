const brevo = require("@getbrevo/brevo");

// Configuración CORRECTA para la versión nueva
const defaultClient = brevo.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

let apiInstance = new brevo.TransactionalEmailsApi();

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    // Prepara destinatarios
    const toEmailList = Array.isArray(to) ? to : [to];
    const sendTo = toEmailList.map((email) => ({ email: email }));

    // Prepara adjuntos en base64 (si existen)
    const brevoAttachments = attachments.map((attachment) => ({
      name: attachment.filename || "attachment",
      content: attachment.content.toString("base64"),
    }));

    // Configura el email
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: "SIREDE",
      email: "pablo.crj.mss@gmail.com", // DEBE estar verificado en Brevo
    };
    sendSmtpEmail.to = sendTo;
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.htmlContent = html;

    if (brevoAttachments.length > 0) {
      sendSmtpEmail.attachment = brevoAttachments;
    }

    // Envía el correo
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Correo enviado con Brevo. Message ID: ", data.messageId);
    return data;
  } catch (error) {
    console.error("Error al enviar correo con Brevo:", error);
    throw error;
  }
}

module.exports = { sendEmail };
