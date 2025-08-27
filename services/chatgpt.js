//EMAIL (ACTUAL)
const nodemailer = require('nodemailer');

// Configura tu transporter con tus credenciales SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, 
  },
});

// Función genérica para enviar emails
async function sendEmail({ to, subject, text, html, attachments }) {
  try {
    const mailOptions = {
      from: `"SIREDE" <${process.env.EMAIL_USER}>`, // Remitente
      to,                 // Destinatario(s)
      subject,            // Asunto
      text,               // Mensaje de texto plano
      html,               // Mensaje de texto con formato HTML
      attachments,        // Adjuntos 
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado: ', info.messageId);
    return info;
  } catch (error) {
    console.error('Error al enviar correo:', error);
    throw error;
  }
}

module.exports = {
  sendEmail,
};


//BREVO 
const SibApiV3Sdk = require('sib-api-v3-sdk');
require('dotenv').config();

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

async function sendEmail(to, subject, htmlContent) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.sender = { email: process.env.BREVO_FROM };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Correo enviado con Brevo');
    return true;
  } catch (error) {
    console.error('Error al enviar correo con Brevo:', error);
    throw error;
  }
}

module.exports = { sendEmail };


//RESEND
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, subject, htmlContent) {
  try {
    const data = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to,
      subject,
      html: htmlContent,
    });

    console.log('Correo enviado con Resend:', data);
    return true;
  } catch (error) {
    console.error('Error al enviar correo con Resend:', error);
    throw error;
  }
}

module.exports = { sendEmail };


//SENDGRID
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to, subject, htmlContent) {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM,
      subject,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log('Correo enviado con SendGrid');
    return true;
  } catch (error) {
    console.error('Error al enviar correo con SendGrid:', error);
    throw error;
  }
}

module.exports = { sendEmail };