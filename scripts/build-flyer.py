#!/usr/bin/env python3
"""Append the current listings/events page to the approved three-page flyer."""

from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PDF = ASSETS / "hauntfinder-2026-listings.pdf"
TMP = ROOT / "tmp" / "flyer-build"
TMP.mkdir(parents=True, exist_ok=True)

W, H = 1224, 1530
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def fit_cover(image, size):
    image = image.convert("RGB")
    ratio = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def rounded_panel(draw, box):
    draw.rounded_rectangle(box, radius=24, fill="#fff6df", outline="#17121d", width=10)


def label(draw, xy, text, fill="#f58220"):
    x, y = xy
    bbox = draw.textbbox((0, 0), text.upper(), font=font(23, True))
    draw.rounded_rectangle((x, y, x + bbox[2] + 28, y + 38), radius=8, fill=fill)
    draw.text((x + 14, y + 4), text.upper(), font=font(23, True), fill="#17121d")


def line(draw, x, y, icon, text, size=25, bold=False):
    draw.text((x, y), icon, font=font(size, True), fill="#17121d")
    draw.text((x + 48, y), text, font=font(size, bold), fill="#17121d")


def build_page():
    subprocess.run([
        "pdftoppm", "-f", "1", "-l", "1", "-r", "144", "-png", "-singlefile",
        str(PDF), str(TMP / "approved-page")
    ], check=True, stdout=subprocess.DEVNULL)
    approved = Image.open(TMP / "approved-page.png").convert("RGB").resize((W, H), Image.Resampling.LANCZOS)

    page = Image.new("RGB", (W, H), "#120c2a")
    page.paste(approved.crop((0, 0, W, 405)), (0, 0))
    draw = ImageDraw.Draw(page)

    # Small category banner below the approved header.
    draw.rounded_rectangle((350, 372, 874, 435), radius=18, fill="#5d168f", outline="#f28b22", width=5)
    title = "NEW DISPLAY & COMMUNITY EVENT"
    tb = draw.textbbox((0, 0), title, font=font(26, True))
    draw.text(((W - (tb[2] - tb[0])) / 2, 388), title, font=font(26, True), fill="white")

    # Listing 9 panel.
    p1 = (25, 450, 1199, 805)
    rounded_panel(draw, p1)
    art = approved.crop((20, 45, 315, 360)).resize((410, 335), Image.Resampling.LANCZOS)
    page.paste(art, (35, 460))
    draw.rounded_rectangle((35, 460, 445, 795), radius=20, outline="#17121d", width=6)
    draw.ellipse((18, 428, 125, 535), fill="#f58220", outline="#17121d", width=5)
    draw.text((49, 442), "9", font=font(62, True), fill="#17121d")
    draw.text((480, 472), "CAPONE'S", font=font(42, True), fill="#17121d")
    label(draw, (982, 477), "Budd Lake")
    line(draw, 482, 535, "•", "22 Cedar Manor Ct, Budd Lake, NJ")
    line(draw, 482, 582, "•", "Opens October 1  |  After dusk")
    line(draw, 482, 629, "•", "Family Friendly  |  Drive-by")
    line(draw, 482, 676, "•", "Lights")

    # Best Buddies event panel.
    p2 = (25, 825, 1199, 1280)
    rounded_panel(draw, p2)
    event_art = fit_cover(Image.open(ASSETS / "best-buddies-trunk-or-treat.jpg"), (410, 435))
    page.paste(event_art, (35, 835))
    draw.rounded_rectangle((35, 835, 445, 1270), radius=20, outline="#17121d", width=6)
    draw.text((480, 850), "BEST BUDDIES", font=font(38, True), fill="#17121d")
    draw.text((480, 895), "SAFE TRICK OR TREAT", font=font(33, True), fill="#5d168f")
    label(draw, (998, 852), "Event", "#64c95d")
    line(draw, 482, 952, "•", "MOHS Track  |  18 Corey Road, Flanders", 23)
    line(draw, 482, 995, "•", "October 29, 2026  |  5:30 PM-7:00 PM", 23)
    line(draw, 482, 1038, "•", "$5 per child", 23, True)
    line(draw, 482, 1081, "•", "$1 off with a non-perishable food donation", 22)
    line(draw, 482, 1124, "•", "Open to all  |  Kid-friendly", 23)
    line(draw, 482, 1167, "•", "Registration not required", 23)

    # Footer matches the approved palette and repeats the live site address.
    draw.rounded_rectangle((185, 1312, 1039, 1476), radius=26, fill="#4d117b", outline="#f28b22", width=6)
    footer = "Find listings, events & plan your route:"
    fb = draw.textbbox((0, 0), footer, font=font(30, True))
    draw.text(((W - (fb[2] - fb[0])) / 2, 1335), footer, font=font(30, True), fill="white")
    url = "hauntfinder.vercel.app"
    ub = draw.textbbox((0, 0), url, font=font(44, True))
    draw.text(((W - (ub[2] - ub[0])) / 2, 1382), url, font=font(44, True), fill="#ffb13b")
    draw.text((1047, 1478), "PAGE 4 OF 4", font=font(18, True), fill="white")

    out = TMP / "page-4.png"
    page.save(out, quality=95)
    return out


def rebuild_pdf(page_path):
    new_page_pdf = TMP / "page-4.pdf"
    Image.open(page_path).convert("RGB").save(new_page_pdf, "PDF", resolution=144.0)
    reader = PdfReader(PDF)
    added = PdfReader(new_page_pdf)
    writer = PdfWriter()
    for page in reader.pages[:3]:
        writer.add_page(page)
    writer.add_page(added.pages[0])
    combined = TMP / "combined.pdf"
    with combined.open("wb") as stream:
        writer.write(stream)
    subprocess.run([
        "pdftoppm", "-jpeg", "-r", "96", "-jpegopt", "quality=48,progressive=y,optimize=y",
        str(combined), str(TMP / "compressed-page")
    ], check=True, stdout=subprocess.DEVNULL)
    out = canvas.Canvas(str(PDF), pagesize=(612, 765), pageCompression=1)
    for image in sorted(TMP.glob("compressed-page-*.jpg")):
        out.drawImage(str(image), 0, 0, width=612, height=765)
        out.showPage()
    out.save()


if __name__ == "__main__":
    rebuild_pdf(build_page())
