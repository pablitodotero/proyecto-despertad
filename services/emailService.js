const brevo = require("@getbrevo/brevo"); // Importación CORRECTA

// Configura la API Key
const apiKey = brevo.ApiClient.instance.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY; // Usa tu variable de entorno

// Crea una instancia del API de Emails Transaccionales
const apiInstance = new brevo.TransactionalEmailsApi();

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    // Prepara los destinatarios en el formato que Brevo espera (un array de objetos)
    const toEmailList = Array.isArray(to) ? to : [to];
    const sendTo = toEmailList.map((email) => ({ email: email }));

    // Prepara los adjuntos en el formato base64 que Brevo requiere
    const brevoAttachments = attachments.map((attachment) => ({
      name: attachment.filename || "attachment",
      content: attachment.content.toString("base64"), // Conversión a base64 OBLIGATORIA
    }));

    // Configura el objeto de envío
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "SIREDE", email: "pablo.crj.mss@gmail.com" }; // EMAIL VERIFICADO en panel de Brevo
    sendSmtpEmail.to = sendTo;
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.htmlContent = html;

    // Solo agregar la propiedad 'attachment' si hay adjuntos
    if (brevoAttachments.length > 0) {
      sendSmtpEmail.attachment = brevoAttachments;
    }

    // Envía el correo
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Correo enviado con Brevo. Message ID: ", data.messageId);
    return data;
  } catch (error) {
    console.error("Error detallado al enviar correo con Brevo:");
    console.error("Mensaje:", error.message);
    console.error("Código de respuesta:", error?.response?.statusCode);
    console.error("Cuerpo de la respuesta:", error?.response?.body);
    throw error; // Relanza el error para manejarlo arriba
  }
}

module.exports = { sendEmail };
