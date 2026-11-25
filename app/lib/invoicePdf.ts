import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { InvoiceData } from '@/app/lib/invoiceLink';

const GREEN = rgb(44 / 255, 160 / 255, 28 / 255);
const DARK = rgb(33 / 255, 37 / 255, 41 / 255);
const GRAY = rgb(108 / 255, 117 / 255, 125 / 255);
const RULE = rgb(210 / 255, 214 / 255, 220 / 255);
const STRIPE = rgb(247 / 255, 248 / 255, 250 / 255);

/** The standard PDF fonts only cover Latin-1/WinAnsi; drawing anything else throws. Strip invisible
 *  characters and swap the rest for "?" so a pasted emoji can't take the whole invoice down. */
const pdfSafe = (text?: string): string =>
  Array.from((text ?? '').replace(/[­​-‏‪-‮⁠-⁤﻿]/g, '').replace(/[  -  　]/g, ' '))
    .map((ch) => (ch.codePointAt(0)! <= 0xFF ? ch : '?')).join('');

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'America/New_York' });

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of pdfSafe(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-solutions.com').replace(/\/$/, '');
    const res = await fetch(`${base}/quickbooks_logo.png`);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** One-page, customer-facing invoice — styled like the admin's letterhead documents, minus any
 *  internal data (IP, signature metadata). */
export async function renderInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 in points
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const left = 57;
  const right = width - 57;

  // --- Letterhead ---
  let drewLogo = false;
  const logoBytes = await loadLogo();
  if (logoBytes) {
    try {
      const logo = await pdf.embedPng(logoBytes);
      const logoW = 130;
      page.drawImage(logo, { x: left, y: height - 70, width: logoW, height: logoW * (logo.height / logo.width) });
      drewLogo = true;
    } catch { /* fall back to the text mark below */ }
  }
  if (!drewLogo) page.drawText('QB ENTERPRISE', { x: left, y: height - 58, size: 18, font: bold, color: DARK });

  page.drawText('QB Enterprise', { x: right - bold.widthOfTextAtSize('QB Enterprise', 10), y: height - 42, size: 10, font: bold, color: DARK });
  for (const [i, line] of ['4650 S Hampton Rd, Suite 102, Dallas, TX 75232', 'contact@qbenterprise.us  |  (888) 829-8848'].entries()) {
    page.drawText(line, { x: right - regular.widthOfTextAtSize(line, 8), y: height - 55 - i * 11, size: 8, font: regular, color: GRAY });
  }
  page.drawLine({ start: { x: left, y: height - 88 }, end: { x: right, y: height - 88 }, thickness: 0.7, color: RULE });

  // --- Title + PAID badge ---
  page.drawText('INVOICE', { x: left, y: height - 118, size: 20, font: bold, color: DARK });
  page.drawRectangle({ x: right - 62, y: height - 124, width: 62, height: 20, color: GREEN });
  page.drawText('PAID', { x: right - 31 - bold.widthOfTextAtSize('PAID', 10) / 2, y: height - 117, size: 10, font: bold, color: rgb(1, 1, 1) });

  // --- Billed to ---
  let y = height - 152;
  page.drawText('BILLED TO', { x: left, y, size: 8, font: bold, color: GRAY });
  y -= 14;
  for (const line of [data.customerName, data.companyName, data.toEmail].filter(Boolean) as string[]) {
    page.drawText(pdfSafe(line), { x: left, y, size: 10, font: line === data.customerName ? bold : regular, color: DARK });
    y -= 13;
  }

  // --- Details table ---
  const rows: [string, string | undefined][] = [
    ['Invoice number', data.orderId],
    ['Invoice date', fmtDate(data.paidAt)],
    ['Payment method', data.paymentMethodLabel],
    ['Plan', data.planDetails],
    ['Number of users', data.numUsers ? String(data.numUsers) : undefined],
    ['Contract term', data.contractYears ? `${data.contractYears} Year${data.contractYears === 1 ? '' : 's'}` : undefined],
    ['Due date', data.dueDate ? fmtDate(data.dueDate) : undefined],
    ['License number', data.licenseNumber],
    ['Product number', data.productNumber],
  ];
  y -= 18;
  const valueX = left + 150;
  const valueWidth = right - valueX - 8;
  let idx = 0;
  for (const [label, value] of rows) {
    if (!value) continue;
    const lines = wrap(value, regular, 10, valueWidth);
    const rowH = lines.length * 13 + 9;
    if (idx % 2 === 0) page.drawRectangle({ x: left, y: y - rowH + 12, width: right - left, height: rowH, color: STRIPE });
    page.drawText(label.toUpperCase(), { x: left + 8, y, size: 8.5, font: bold, color: DARK });
    lines.forEach((l, li) => page.drawText(l, { x: valueX, y: y - li * 13, size: 10, font: regular, color: DARK }));
    y -= rowH;
    idx++;
  }

  // --- Total ---
  y -= 14;
  page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.7, color: RULE });
  const total = `$${data.amountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  page.drawText('TOTAL PAID (USD)', { x: left + 8, y: y - 12, size: 10, font: bold, color: DARK });
  page.drawText(total, { x: right - bold.widthOfTextAtSize(total, 16) - 8, y: y - 14, size: 16, font: bold, color: GREEN });

  // --- Footer ---
  const note = 'Thank you for your payment. This invoice was generated automatically and is valid without a signature. For questions or a copy for your records, contact contact@qbenterprise.us.';
  wrap(note, regular, 8.5, right - left).forEach((l, i) => page.drawText(l, { x: left, y: 70 - i * 11, size: 8.5, font: regular, color: GRAY }));

  return pdf.save();
}
