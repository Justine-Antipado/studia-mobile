// Pulls the readable text out of Word and PowerPoint files (.docx / .pptx are zip archives of XML),
// so the AI can summarise them. Legacy binary .doc / .ppt are not supported. PDFs do not go through
// here: Gemini reads them directly.
import JSZip from "jszip";

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Text of every `<tag>...</tag>` run, with a line break at each paragraph end tag. */
function runs(xml: string, tag: string, paragraph: string): string {
  const text = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>|</${paragraph}>`, "g");
  let out = "";
  for (const m of xml.matchAll(text)) out += m[1] !== undefined ? decode(m[1]) : "\n";
  return out;
}

export async function extractOfficeText(data: ArrayBuffer, extension: string): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  if (extension === "docx") {
    const xml = await zip.file("word/document.xml")?.async("string");
    return xml ? runs(xml, "w:t", "w:p").replace(/\n{3,}/g, "\n\n").trim() : "";
  }
  if (extension === "pptx") {
    const slides = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
    const parts: string[] = [];
    for (const [i, name] of slides.entries()) {
      const xml = await zip.file(name)!.async("string");
      parts.push(`Slide ${i + 1}:\n${runs(xml, "a:t", "a:p").trim()}`);
    }
    return parts.join("\n\n").trim();
  }
  return "";
}
