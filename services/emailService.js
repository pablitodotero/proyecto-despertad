const SibApiV3Sdk = require("sib-api-v3-sdk");
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      sender: { name: "SIREDE", email: "pablo.crj.mss@gmail.com" },
      to: [{ email: to }],
      subject: subject,
      textContent: text,
      htmlContent: html,
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
