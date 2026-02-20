import nodemailer from "nodemailer";
import config from "./env.config.js";

const transport = nodemailer.createTransport({
  host: config.emailConfig.host,
  port: config.emailConfig.port,
  secure: config.emailConfig.port === 465,
  auth: {
    user: config.emailConfig.user,
    pass: config.emailConfig.pass,
  },
});

export default transport;
