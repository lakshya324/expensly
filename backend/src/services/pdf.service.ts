import { PDFParse } from "pdf-parse";
import { logInfo } from "../utils/logger.js";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    logInfo(`Extracted text from PDF (${(parsed.text ?? "").length} chars)`);
    return (parsed.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}
