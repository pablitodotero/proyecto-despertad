const brevo = require("@getbrevo/brevo");
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new brevo.TransactionalEmailsApi();

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    // Brevo espera un array de objetos para destinatarios
    const sendSmtpEmail = new brevo.SendSmtpEmail({
      sender: { name: "SIREDE", email: "pablo.crj.mss@gmail.com" },
      to: [{ email: to }],
      subject: subject,
      textContent: text,
      htmlContent: html,
      // Para adjuntos, Brevo necesita un formato específico
      attachment: attachments.map((attachment) => ({
        name: attachment.filename,
        content: attachment.content.toString("base64"),
      })),
    });

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Correo enviado con Brevo. Message ID: ", data.messageId);
    return data;
  } catch (error) {
    console.error("Error al enviar correo con Brevo:", error);
    throw error;
  }
}

module.exports = { sendEmail };
