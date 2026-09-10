from pathlib import Path

from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm as MM
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "struk-tes-rawbt-58mm.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

font_regular = Path("C:/Windows/Fonts/arial.ttf")
font_bold = Path("C:/Windows/Fonts/arialbd.ttf")
pdfmetrics.registerFont(TTFont("Receipt", str(font_regular)))
pdfmetrics.registerFont(TTFont("ReceiptBold", str(font_bold)))

page_width = 58 * MM
page_height = 180 * MM

doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=(page_width, page_height),
    leftMargin=3 * MM,
    rightMargin=3 * MM,
    topMargin=3 * MM,
    bottomMargin=3 * MM,
)

base = ParagraphStyle(
    "base", fontName="Receipt", fontSize=7.4, leading=9.2,
    textColor=colors.black, alignment=TA_LEFT, spaceAfter=0,
)
center = ParagraphStyle("center", parent=base, alignment=TA_CENTER)
right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)
title = ParagraphStyle(
    "title", parent=center, fontName="ReceiptBold", fontSize=12,
    leading=14,
)
bold = ParagraphStyle("bold", parent=base, fontName="ReceiptBold")
small = ParagraphStyle("small", parent=center, fontSize=6.4, leading=8)

story = [
    Paragraph("CHIMINRO POS", title),
    Paragraph("STRUK TES PRINTER RAWBT", ParagraphStyle(
        "subtitle", parent=center, fontName="ReceiptBold", fontSize=8.2, leading=10
    )),
    Paragraph("Printer thermal 58 mm - ESC/POS", small),
    Spacer(1, 2 * MM),
    Paragraph("==========================", center),
]

info = Table(
    [
        [Paragraph("No. Struk", base), Paragraph("TEST-0001", right)],
        [Paragraph("Tanggal", base), Paragraph("09-09-2026 10:30", right)],
        [Paragraph("Kasir", base), Paragraph("mitra_user", right)],
        [Paragraph("Metode", base), Paragraph("Tunai", right)],
    ],
    colWidths=[18 * MM, 34 * MM],
)
info.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0.7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 0.7),
]))
story.extend([info, Paragraph("--------------------------------", center)])

items = Table(
    [
        [Paragraph("Chicken Mini Roll", bold), "", ""],
        [Paragraph("2 x Rp15.000", base), "", Paragraph("Rp30.000", right)],
        [Paragraph("Es Teh", bold), "", ""],
        [Paragraph("1 x Rp5.000", base), "", Paragraph("Rp5.000", right)],
        [Paragraph("Add-on: Saus pedas", base), "", Paragraph("Rp2.000", right)],
    ],
    colWidths=[28 * MM, 2 * MM, 22 * MM],
)
items.setStyle(TableStyle([
    ("SPAN", (0, 0), (2, 0)),
    ("SPAN", (0, 2), (2, 2)),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0.8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 0.8),
]))
story.extend([items, Paragraph("--------------------------------", center)])

totals = Table(
    [
        [Paragraph("Subtotal", base), Paragraph("Rp37.000", right)],
        [Paragraph("Diskon", base), Paragraph("- Rp2.000", right)],
        [Paragraph("TOTAL", bold), Paragraph("Rp35.000", ParagraphStyle(
            "total", parent=right, fontName="ReceiptBold", fontSize=9
        ))],
        [Paragraph("Dibayar", base), Paragraph("Rp50.000", right)],
        [Paragraph("Kembali", bold), Paragraph("Rp15.000", ParagraphStyle(
            "change", parent=right, fontName="ReceiptBold"
        ))],
    ],
    colWidths=[24 * MM, 28 * MM],
)
totals.setStyle(TableStyle([
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0.8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 0.8),
]))
story.extend([
    totals,
    Paragraph("==========================", center),
    Spacer(1, 1.5 * MM),
    Paragraph("Terima kasih", ParagraphStyle(
        "thanks", parent=center, fontName="ReceiptBold", fontSize=9, leading=11
    )),
    Paragraph("Simpan struk ini sebagai bukti transaksi.", small),
    Spacer(1, 2 * MM),
    Paragraph("Jika seluruh teks terbaca dan tidak terpotong, printer siap digunakan.", small),
])

doc.build(story)
print(OUTPUT)
