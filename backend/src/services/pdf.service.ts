import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    console.log("Extracted text from PDF:", parsed.text);
    return (parsed.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}
