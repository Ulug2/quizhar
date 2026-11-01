/** Reads an uploaded file into plain text, in the browser. */
export interface Extracted {
  /** Plain text for the rule-based parser. */
  text: string;
  /** Text with **bold** kept, for the AI parser (correct answers are often bold in Word files). */
  richText: string;
}

export async function extractFile(file: File): Promise<Extracted> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".doc")) throw new Error("Старый формат .doc не поддерживается. Сохрани файл как .docx или .pdf.");
  const text = await file.text();
  return { text, richText: text };
}

async function extractDocx(file: File): Promise<Extracted> {
  const { default: mammoth } = await import("mammoth/mammoth.browser.js");
  const arrayBuffer = await file.arrayBuffer();
  const [raw, html] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer }),
    mammoth.convertToHtml({ arrayBuffer }),
  ]);
  return { text: raw.value, richText: htmlToMarkedText(html.value) };
}

function htmlToMarkedText(html: string): string {
  const marked = html
    .replace(/<(strong|b)>/g, "**")
    .replace(/<\/(strong|b)>/g, "**")
    .replace(/<\/(p|li|h\d|tr)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n");
  const doc = new DOMParser().parseFromString(marked, "text/html");
  return doc.body.textContent ?? "";
}

async function extractPdf(file: File): Promise<Extracted> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : "");
    }
    text += "\n";
  }
  if (text.trim().length < 20) {
    throw new Error("В этом PDF нет текста (похоже на скан). Попробуй файл .docx или .txt.");
  }
  return { text, richText: text };
}
