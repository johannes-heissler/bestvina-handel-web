/**
 * Exporting a view: SVG as it is, PNG and JPEG through a canvas, PDF with jsPDF and svg2pdf.js (loaded on demand).
 *
 * @module
 */
export type ExportFormat = "svg" | "png" | "jpeg" | "pdf";

export async function exportImage(svg: string, name: string, format: ExportFormat): Promise<void> {
  if (format === "svg") return download(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
  if (format === "pdf") return download(await toPdf(svg), `${name}.pdf`);
  const blob = await rasterize(svg, format === "png" ? "image/png" : "image/jpeg", 2);
  download(blob, `${name}.${format === "png" ? "png" : "jpg"}`);
}

/** Draws the SVG on a canvas at `scale` times its size. */
async function rasterize(svg: string, type: string, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.fillStyle = "#ffffff"; // JPEG has no transparency
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))), type, 0.95),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toPdf(svg: string): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const element = new DOMParser().parseFromString(svg, "image/svg+xml")
    .documentElement as unknown as SVGSVGElement;
  const width = Number(element.getAttribute("width") ?? 640);
  const height = Number(element.getAttribute("height") ?? 640);
  const pdf = new jsPDF({
    unit: "pt",
    format: [width, height],
    orientation: width > height ? "landscape" : "portrait",
  });
  await svg2pdf(element, pdf, { x: 0, y: 0, width, height });
  return pdf.output("blob");
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
