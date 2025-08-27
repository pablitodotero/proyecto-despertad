const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    // Prepara los adjuntos correctamente
    const brevoAttachments = attachments.map((attachment) => ({
      name: attachment.filename,
      content: attachment.content.toString("base64")
    }));

    // Crea el objeto sendSmtpEmail PASO A PASO
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    // Configura las propiedades UNA POR UNA
    sendSmtpEmail.sender = { 
      name: "SIREDE", 
      email: "pablo.crj.mss@gmail.com" 
    };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.htmlContent = html;
    
    if (brevoAttachments.length > 0) {
      sendSmtpEmail.attachment = brevoAttachments;
    }

    console.log("Enviando email con datos:", JSON.stringify(sendSmtpEmail, null, 2));

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Correo enviado con Brevo. Message ID: ", data.messageId);
    return data;
  } catch (error) {
    console.error("Error detallado al enviar correo con Brevo:");
    console.error("Status:", error.status);
    console.error("Mensaje:", error.response?.text || error.message);
    console.error("Cuerpo de error:", error.response?.body);
    throw error;
  }
}

module.exports = { sendEmail };
