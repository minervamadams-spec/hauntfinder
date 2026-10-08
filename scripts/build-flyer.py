#!/usr/bin/env python3
"""Restore verified illustrated source, refusing stale public facts.
See docs/flyer-rules.md before updating the source and manifest.
"""
import hashlib
import json
import shutil
from pathlib import Path
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'assets/flyer-sources'
manifest = json.loads((SOURCES / 'manifest.json').read_text())
public_data = (ROOT / 'app.js').read_text().split('const filters=')[0]
if hashlib.sha256(public_data.encode()).hexdigest() != manifest['publicDataSha256']:
    raise SystemExit('Public listings changed. Update and visually verify the approved source first; see docs/flyer-rules.md.')
source = SOURCES / manifest['source']
if len(PdfReader(source).pages) != manifest['pages']:
    raise SystemExit('Approved source page count does not match manifest.')
shutil.copyfile(source, ROOT / 'assets/hauntfinder-2026-listings.pdf')
print(f"Restored approved {manifest['pages']}-page flyer.")
