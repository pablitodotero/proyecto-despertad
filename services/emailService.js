const SibApiV3Sdk = require("sib-api-v3-sdk");
require("dotenv").config();

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

async function sendEmail(to, subject, htmlContent) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = { email: process.env.BREVO_FROM };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Correo enviado con Brevo");
    return true;
  } catch (error) {
    console.error("Error al enviar correo con Brevo:", error);
    throw error;
  }
}

module.exports = { sendEmail };
