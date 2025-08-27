//BREVO
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

//V2
/*const SibApiV3Sdk = require("sib-api-v3-sdk");
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

module.exports = { sendEmail };*/

//RESEND
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    const { data, error } = await resend.emails.send({
      from: "SIREDE <pablo.crj.mss@gmail.com>",
      to: to,
      subject: subject,
      text: text,
      html: html,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    });

    if (error) {
      throw error;
    }

    console.log("Correo enviado con Resend. ID: ", data.id);
    return data;
  } catch (error) {
    console.error("Error al enviar correo con Resend:", error);
    throw error;
  }
}

module.exports = { sendEmail };

//SENDGRID
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    const msg = {
      to: to,
      from: {
        name: "SIREDE",
        email: "pablo.crj.mss@gmail.com",
      },
      subject: subject,
      text: text,
      html: html,
      attachments: attachments.map((attachment) => ({
        content: attachment.content.toString("base64"),
        filename: attachment.filename,
        type: attachment.contentType,
        disposition: "attachment",
      })),
    };

    const response = await sgMail.send(msg);
    console.log(
      "Correo enviado con SendGrid. Status Code: ",
      response[0].statusCode
    );
    return response;
  } catch (error) {
    console.error("Error al enviar correo con SendGrid:", error);
    throw error;
  }
}

module.exports = { sendEmail };
