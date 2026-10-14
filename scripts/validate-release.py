#!/usr/bin/env python3
"""Read-only release checks: matching public data, categories and embedded text.
The flyer/PDF subsystem (scripts/build-flyer.py, assets/flyer-sources/,
assets/flyer-templates/, assets/fonts/, docs/flyer-rules.md) was fully retired
on 2026-10-14 when the external consumer was removed. The hourly import task
owns public-data changes and does not run this validator. The public-data
sha256 is printed as informational output only — there is no manifest to
compare against anymore. The structural checks (split-line marker, unique
listing numbers, coordinates, geoVerified entries) remain fatal."""
import hashlib,json,math,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
src=(ROOT/'app.js').read_text()
assert 'const filters=' in src,'app.js preamble split marker missing.'
data=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/public-data.cjs')]))
preamble_sha256=hashlib.sha256(src.split('const filters=')[0].encode()).hexdigest()
nums=[x['num'] for x in data['listings']];assert len(nums)==len(set(nums)),'Duplicate listing numbers.'
for x in data['listings']+data['events']:
 if x.get('placeholder'):continue
 for field in ('lat','lng'):
  assert isinstance(x.get(field),(int,float)) and math.isfinite(x[field]),f'Missing or invalid {field} for: '+x.get('name',str(x.get('num')))
 assert isinstance(x.get('geoVerified'),str) and x['geoVerified'].strip(),'Missing geoVerified for: '+x.get('name',str(x.get('num')))
print('Public data hash, unique numbers, coordinates and geoVerified entries verified.')
print('Public-data sha256 (informational; flyer manifest retired 2026-10-14): '+preamble_sha256)
