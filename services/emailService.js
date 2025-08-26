// services/emailService.js

const nodemailer = require('nodemailer');

// Configura tu transporter con tus credenciales SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,       // tu correo, por ejemplo 'miapp@gmail.com'
    pass: process.env.EMAIL_PASSWORD,   // tu contraseña de aplicación de Gmail
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
      html,               // Mensaje de texto con formato HTML (opcional)
      attachments,        // Adjuntos si los necesitas (PDF, imágenes, etc.)
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