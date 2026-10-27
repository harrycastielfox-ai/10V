export function onePagePdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let content = "%PDF-1.7\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(content);
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(content);
  content += "xref\n0 4\n0000000000 65535 f \n";
  content += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  content += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(content);
}
