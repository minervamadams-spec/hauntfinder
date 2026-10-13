#!/usr/bin/env python3
"""Build data/zip-centroids.json from the Census 2023 ZCTA Gazetteer.

Downloads the national ZCTA file, keeps the launch states by 3-digit ZIP
prefix (NJ 070-089, NY 100-149, PA 150-196), rounds centroids to 4 decimals
and writes a deterministic JSON object: a "_meta" header plus 5-digit ZIP
keys mapped to [lat, lng]. Stdlib only.
"""
import io,json,ssl,urllib.request,zipfile
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip'
PREFIX_RANGES=((70,89),(100,149),(150,196))
def ssl_context():
    # python.org builds ship no default CA store; certifi provides one. The
    # download source is unchanged — this only supplies the trust anchors.
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None
def keep(geoid):
    if len(geoid)!=5 or not geoid.isdigit():return False
    p=int(geoid[:3])
    return any(a<=p<=b for a,b in PREFIX_RANGES)
def main():
    req=urllib.request.Request(SOURCE,headers={'User-Agent':'hauntfinder-zip-table/1.0 (hauntfinder update workflow)'})
    with urllib.request.urlopen(req,timeout=180,context=ssl_context()) as r:blob=r.read()
    z=zipfile.ZipFile(io.BytesIO(blob))
    name=next(n for n in z.namelist() if n.endswith('.txt'))
    out={}
    with z.open(name) as f:
        header=f.readline().decode('latin-1').rstrip('\n').split('\t')
        header=[h.strip() for h in header]
        gi,la,lo=header.index('GEOID'),header.index('INTPTLAT'),header.index('INTPTLONG')
        for raw in f:
            cols=raw.decode('latin-1').rstrip('\n').split('\t')
            if len(cols)<=max(gi,la,lo):continue
            geoid=cols[gi].strip()
            if not keep(geoid):continue
            out[geoid]=[round(float(cols[la]),4),round(float(cols[lo]),4)]
    data={'_meta':{'source':SOURCE,'vintage':'2023','generated':date.today().isoformat(),'states':['NJ','NY','PA'],'count':len(out)}}
    data.update((k,out[k]) for k in sorted(out))
    dest=ROOT/'data/zip-centroids.json'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(data,separators=(',',':'))+'\n')
    print(f'Wrote {len(out)} ZIP centroids to {dest}')
if __name__=='__main__':main()
