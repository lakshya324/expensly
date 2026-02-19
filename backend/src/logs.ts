import fs from "fs";
import path from "path";
import morgan from "morgan";
import express from "express";

const logs = (app: express.Application) => {
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
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
      skip: (req, res) => res.statusCode < 400,
      stream: fs.createWriteStream(path.join(__dirname, "../logs/error.log"), {
        flags: "a",
      }),
    }),
  );
};

export default logs;
