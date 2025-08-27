const SibApiV3Sdk = require("sib-api-v3-sdk");
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
    // Validar que 'to' sea un array de strings válidos
    if (!Array.isArray(to) || to.length === 0) {
      throw new Error("El campo 'to' debe ser un array con al menos un email.");
    }

    const invalidEmails = to.filter(
      (email) => typeof email !== "string" || !isValidEmail(email)
    );
    if (invalidEmails.length > 0) {
      throw new Error(`Email(s) inválido(s): ${invalidEmails.join(", ")}`);
    }

    const brevoAttachments = attachments.map((attachment) => ({
      name: attachment.filename,
      content: attachment.content.toString("base64"),
    }));

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "SIREDE",
      email: "pablo.crj.mss@gmail.com",
    };

    // Convertir array de emails en array de objetos { email: string }
    sendSmtpEmail.to = to.map((email) => ({ email }));

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.htmlContent = html;

    if (brevoAttachments.length > 0) {
      sendSmtpEmail.attachment = brevoAttachments;
    }

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
