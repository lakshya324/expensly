import OpenAI from "openai";
import config from "./env.config.js";

export const openai = new OpenAI({ apiKey: config.openai.apiKey });