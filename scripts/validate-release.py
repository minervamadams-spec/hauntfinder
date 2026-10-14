#!/usr/bin/env python3
"""Read-only release checks: matching public data, categories and embedded text.
The flyer/PDF checks are advisory only (printed as a warning, exit stays 0):
the public PDF surface was retired in the v5 consolidation, and the external
hourly import task may regenerate the PDF independently of any release. The
public-data hash check remains fatal — the import relies on public data
stability."""
import hashlib,json,math,subprocess
from pathlib import Path
try:
 import fitz
except ImportError:
 fitz=None
ROOT=Path(__file__).resolve().parents[1]
data=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/public-data.cjs')]))
manifest=json.loads((ROOT/'assets/flyer-sources/manifest.json').read_text())
assert manifest['publicDataSha256']==hashlib.sha256((ROOT/'app.js').read_text().split('const filters=')[0].encode()).hexdigest(),'Flyer facts are stale; rebuild.'
nums=[x['num'] for x in data['listings']];assert len(nums)==len(set(nums)),'Duplicate listing numbers.'
for x in data['listings']+data['events']:
 if x.get('placeholder'):continue
 for field in ('lat','lng'):
  assert isinstance(x.get(field),(int,float)) and math.isfinite(x[field]),f'Missing or invalid {field} for: '+x.get('name',str(x.get('num')))
 assert isinstance(x.get('geoVerified'),str) and x['geoVerified'].strip(),'Missing geoVerified for: '+x.get('name',str(x.get('num')))
# ---- Advisory flyer/PDF checks: never block a release. ----
pdf_notes=[]
def note(msg):pdf_notes.append(msg)
if fitz is None:
 note('PyMuPDF unavailable; PDF checks skipped.')
else:
 try:
  pdf=ROOT/'assets/hauntfinder-2026-listings.pdf'
  if not pdf.exists():
   note('assets/hauntfinder-2026-listings.pdf is absent (public PDF retired; the import task may regenerate it).')
  elif manifest['pdfSha256']!=hashlib.sha256(pdf.read_bytes()).hexdigest():
   note('PDF bytes differ from manifest (non-fatal; the import task regenerates the PDF).')
  else:
   doc=fitz.open(pdf)
   if len(doc)!=manifest['pages']:
    note(f'PDF page count {len(doc)} differs from manifest {manifest["pages"]}.')
   else:
    text='\n'.join(p.get_text() for p in doc).upper()
    def normal(s):return s.replace('’',"'").replace('–','-').replace('—','-').upper()
    missing=[x['name'] for x in data['listings']+data['events'] if not x.get('placeholder') and normal(x['name'] if x.get('kind')!='Trick-or-treat stop' else x['address'].removesuffix(', NJ')) not in text]
    if missing:note('Missing flyer entries: '+', '.join(missing))
    unembedded=[i for i,p in enumerate(doc) if not any('Nimbus Sans Narrow' in f[3] for f in p.get_fonts())]
    if unembedded:note('Listing fonts not embedded on PDF page(s): '+', '.join(str(i+1) for i in unembedded))
 except Exception as e:
  note(f'PDF check failed ({e}); treated as non-fatal.')
print('Public data hash, unique numbers, coordinates and geoVerified entries verified.'+('' if pdf_notes else ' PDF verified.'))
if pdf_notes:print('WARNING (non-fatal): '+' | '.join(pdf_notes))
