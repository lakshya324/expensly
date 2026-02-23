import fs from "fs";
// import config from "./config/env.config.js";
// import { notifyServerRestart } from "./emails/mail/server.notify.email.js";

const setupEnvironment = () => {
  // Notify server restart in production
  // if (config.nodeEnv === "production") notifyServerRestart();

  // Create necessary directories if they don't exist
  if (!fs.existsSync("logs")) fs.mkdirSync("logs");
};

export default setupEnvironment;
