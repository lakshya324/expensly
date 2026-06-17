import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import express, { Request } from "express";

import { corsMiddleware } from "./middleware/cors.js";
import { requestContext } from "./middleware/requestContext.js";

export default function middlewares(app: express.Application) {
  app.use(requestContext);

  //! Security
  app.use(helmet());
  app.use(corsMiddleware);

  //! Fetching Client IP
  app.set("trust proxy", 1); // exactly one proxy hop (nginx proxy)

  //! Body Parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
}
