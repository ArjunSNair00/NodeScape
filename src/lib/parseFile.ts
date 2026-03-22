import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CHUNK_SIZE = 8_000;

export async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    if (pageText.trim()) parts.push(pageText.trim());
  }

  const full = parts.join("\n\n");
  if (!full.trim()) {
    throw new Error("No text found in PDF (may be a scanned image)");
  }
  return full;
}

export async function parseTextFile(file: File): Promise<string> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
  return text;
}

export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any single paragraph exceeds CHUNK_SIZE, split it by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= CHUNK_SIZE) {
      result.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let sub = "";
      for (const s of sentences) {
        if (sub.length + s.length + 1 > CHUNK_SIZE && sub.length > 0) {
          result.push(sub.trim());
          sub = s;
        } else {
          sub = sub ? sub + " " + s : s;
        }
      }
      if (sub.trim()) result.push(sub.trim());
    }
  }

  return result;
}
