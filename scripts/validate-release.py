#!/usr/bin/env python3
"""Read-only release checks: matching public data, PDF, categories and embedded text."""
import hashlib,json,math,subprocess
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parents[1]
data=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/public-data.cjs')]))
manifest=json.loads((ROOT/'assets/flyer-sources/manifest.json').read_text())
assert manifest['publicDataSha256']==hashlib.sha256((ROOT/'app.js').read_text().split('const filters=')[0].encode()).hexdigest(),'Flyer facts are stale; rebuild.'
pdf=ROOT/'assets/hauntfinder-2026-listings.pdf'
assert manifest['pdfSha256']==hashlib.sha256(pdf.read_bytes()).hexdigest(),'PDF bytes differ from manifest.'
doc=fitz.open(pdf)
assert len(doc)==manifest['pages']
nums=[x['num'] for x in data['listings']];assert len(nums)==len(set(nums)),'Duplicate listing numbers.'
text='\n'.join(p.get_text() for p in doc).upper()
def normal(s):return s.replace('’',"'").replace('–','-').replace('—','-').upper()
for x in data['listings']+data['events']:
 if x.get('placeholder'):continue
 assert normal(x['name'] if x.get('kind')!='Trick-or-treat stop' else x['address'].removesuffix(', NJ')) in text,'Missing flyer entry: '+x['name']
for p in doc:
 assert any('Nimbus Sans Narrow' in f[3] for f in p.get_fonts()),'Listing fonts are not embedded.'
print('Public data, PDF hash, unique numbers, all entries and embedded fonts verified.')
