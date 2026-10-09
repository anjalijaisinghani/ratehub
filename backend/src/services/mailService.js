const nodemailer = require('nodemailer');
const mailConfig = require('../config/mail');

// During automated tests nothing is sent. Messages are collected here so tests can read them.
const outbox = [];
const clearOutbox = () => {
  outbox.length = 0;
};

let transporter;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      auth: mailConfig.user ? { user: mailConfig.user, pass: mailConfig.pass } : undefined,
      connectionTimeout: 5000, // never hang forever if the mail server is down
      socketTimeout: 10000,
    });
  }
  return transporter;
};

// Returns a promise. Callers usually do NOT wait for it (see accountService).
const sendMail = ({ to, subject, text, html }) => {
  if (process.env.NODE_ENV === 'test') {
    outbox.push({ to, subject, text, html });
    return Promise.resolve();
  }
  return getTransporter().sendMail({ from: mailConfig.from, to, subject, text, html });
};

module.exports = { sendMail, outbox, clearOutbox };