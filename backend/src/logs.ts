import fs from "fs";
import path from "path";
import morgan from "morgan";
import express from "express";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logs = (app: express.Application) => {
  app.use(
    morgan("combined", {
      skip: (_, res) => res.statusCode < 400,
    }),
  );

  app.use(
    morgan("combined", {
      stream: fs.createWriteStream(path.join(__dirname, "../logs/access.log"), {
        flags: "a",
      }),
    }),
  );

  app.use(
    morgan("combined", {
      skip: (_, res) => res.statusCode < 400,
      stream: fs.createWriteStream(path.join(__dirname, "../logs/error.log"), {
        flags: "a",
      }),
    }),
  );
};

export default logs;
