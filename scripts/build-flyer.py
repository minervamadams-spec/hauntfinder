#!/usr/bin/env python3
"""Generate approved illustrated artwork with embedded factual text, never raster text.
Requires PyMuPDF and Node. Reads current app.js; fails on text overflow.
The archived approved-guide.pdf supplies artwork only, not listing facts.
"""
import hashlib,json,subprocess
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/flyer-sources'
data=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/public-data.cjs')]))
art=fitz.open(); doc=fitz.open()
for i in range(1,6):
 p=art.new_page(width=612,height=765);p.insert_image(p.rect,filename=str(SOURCE/f'artwork-{i}.jpeg'))
cream=(1,.965,.86); purple=(.38,.12,.58)
def newpage():
 p=doc.new_page(width=612,height=765)
 for name,file in [('Body','NimbusSansNarrow-Regular.otf'),('Heading','NimbusSansNarrow-Bold.otf')]:p.insert_font(fontname=name,fontfile=str(ROOT/'assets/fonts'/file))
 return p
def text(p,rect,value,size=13,bold=False,color=(.025,.025,.025),minimum=10):
 value=str(value).replace('\u2019',"'").replace('\u2013','-').replace('\u2014','-')
 while size>=minimum:
  shape=p.new_shape()
  if shape.insert_textbox(fitz.Rect(rect),value,fontname='Heading' if bold else 'Body',fontsize=size,color=color,lineheight=1.2)>=0:shape.commit();return
  size-=.5
 raise ValueError('Flyer text overflow: '+value)
def badge(p,rect,value,color=purple):
 r=fitz.Rect(rect);p.draw_rect(r,color=None,fill=color)
 # Center larger date lettering inside the existing purple badge.
 font='Heading';size=17 if '\n' in value else 13
 lines=value.split('\n');h=size*1.12*len(lines);y=r.y0+(r.height-h)/2+size
 f=fitz.Font(fontfile=str(ROOT/'assets/fonts/NimbusSansNarrow-Bold.otf'))
 for line in lines:
  w=f.text_length(line,fontsize=size);p.insert_text((r.x0+(r.width-w)/2,y),line,fontsize=size,fontname=font,color=(1,1,.94));y+=size*1.12

def flow(p,rect,rows,size=16):
 r=fitz.Rect(rect);font=fitz.Font(fontfile=str(ROOT/'assets/fonts/NimbusSansNarrow-Regular.otf'))
 for fs in [size-i*.5 for i in range(int((size-11)*2)+1)]:
  groups=[]
  for row in rows:
   lines=[];line=''
   for word in str(row).replace('–','-').replace('’',"'").split():
    nxt=(line+' '+word).strip()
    if line and font.text_length(nxt,fontsize=fs)>r.width-18:lines.append(line);line=word
    else:line=nxt
   if line:lines.append(line)
   groups.append(lines)
  h=sum(len(g)*fs*1.2+3 for g in groups)
  if h<=r.height:break
 else:raise ValueError('Visitor facts overflow: '+str(rows))
 y=r.y0+fs
 for i,lines in enumerate(groups):
  p.draw_circle((r.x0+4,y-fs*.3),3,color=None,fill=(.1,.08,.1))
  for line in lines:p.insert_text((r.x0+15,y),line,fontsize=fs,fontname='Body');y+=fs*1.2
  y+=3
def facts(x):
 out=[x['address'].removesuffix(', NJ'),' | '.join(filter(None,[x.get('dates'),x.get('times')])) or 'Dates and hours not specified.']
 visitor=' | '.join(x.get('flyerFeatures',x.get('levels',[])+x.get('type',[])+x.get('features',[])))
 if visitor:out.append(visitor)
 if x.get('flyerNotes',x.get('notes')):out.append(x.get('flyerNotes',x.get('notes')))
 if x.get('status') in ('temporarily_closed','weather_cancelled'):out.append(x.get('statusNote',x['status']))
 return out
def details(p,x,top,bottom,left=293,right=598):
 p.draw_rect(fitz.Rect(left,top,right,bottom),color=None,fill=cream)
 if x.get('placeholder'):
  p.draw_rect(fitz.Rect(15,top,598,bottom),color=None,fill=(.81,.81,.81));text(p,(80,top+36,565,bottom-12),'LISTING NUMBER AVAILABLE\nReserved for the next approved listing.',18,True,minimum=13);return
 text(p,(left+8,top+4,right-7,top+29),x['name'].upper(),20,True,minimum=13)
 if x.get('town'):badge(p,(right-115,bottom-22,right-8,bottom-4),x['town'].upper())
 flow(p,(left+10,top+29,right-12,bottom-23),facts(x))
def number(p,n,top,color):
 p.draw_circle((37,top+20),25,color=None,fill=color);text(p,(19,top,60,top+45),str(n),32,True,minimum=22)
displays=[x for x in data['listings'] if x.get('kind')!='Trick-or-treat stop']
treats=[x for x in data['listings'] if x.get('kind')=='Trick-or-treat stop' and not x.get('placeholder')]
events=data['events'];colors=[(1,.52,.05),(.35,.83,.16),(.68,.26,.87)]
original=[[(218,401),(416,546),(557,680)],[(219,367),(381,506),(511,682)]]
for start in range(0,len(displays),3):
 p=newpage();group=displays[start:start+3]
 if start<6:
  p.show_pdf_page(p.rect,art,start//3)
  for i,x in enumerate(group):details(p,x,*original[start//3][i])
 else:
  p.show_pdf_page(p.rect,art,3);slots=[(229,366),(383,520),(535,673)]
  for i,(top,bottom) in enumerate(slots):
   if i>=len(group):
    p.show_pdf_page(fitz.Rect(8,top-4,604,bottom+4),art,3,clip=fitz.Rect(8,530,604,679),keep_proportion=False);continue
   x=group[i]
   if x['num']==7:p.show_pdf_page(fitz.Rect(9,top-2,289,bottom+2),art,2,clip=fitz.Rect(9,215,289,394),keep_proportion=False)
   elif not x.get('placeholder'):
    y=383 if x['num']==10 else 229
    p.show_pdf_page(fitz.Rect(9,top-2,289,bottom+2),art,3,clip=fitz.Rect(9,y,278,y+137),keep_proportion=False)
   details(p,x,top,bottom);number(p,x['num'],top,colors[i] if not x.get('placeholder') else (.62,.62,.62))
for start in range(0,len(events),4):
 p=newpage();p.show_pdf_page(p.rect,art,4)
 p.show_pdf_page(fitz.Rect(313,241,597,325),art,4,clip=fitz.Rect(16,241,300,325),keep_proportion=False)
 p.show_pdf_page(fitz.Rect(16,241,300,325),art,2,clip=fitz.Rect(16,405,290,602),keep_proportion=False)
 slots=[(16,328,300,462),(313,328,597,462),(16,562,300,694),(313,562,597,694)]
 for i,e in enumerate(events[start:start+4]):
  l,t,r,b=slots[i];p.draw_rect(fitz.Rect(l,t,r,b),color=None,fill=cream)
  text(p,(l+6,t+3,r-5,t+38),e['name'].upper(),18,True,minimum=13)
  lines=[e.get('eventType','') if e.get('eventType')!='Other' else '',e.get('hours',''),e.get('address','').removesuffix(', NJ'),' | '.join(filter(None,[e.get('cost'),e.get('attendance')])),e.get('flyerNotes',e.get('notes',''))]
  flow(p,(l+8,t+29,r-8,b-4),list(filter(None,lines)),14)
  label='OPEN\nDAILY' if e.get('ongoing') else 'OCT\n'+e['date'][8:10] if e['date'][5:7]=='10' else e['date'][5:7]+'\n'+e['date'][8:10]
  top=241 if i<2 else 473;badge(p,(l+2,top,l+67,top+56),label)
for start in range(0,len(treats),8):
 p=newpage();p.insert_image(p.rect,filename=str(ROOT/'assets/flyer-templates/treat-stops-approved.jpg'))
 for i in range(8):
  top=280+i*51.3
  p.draw_rect(fitz.Rect(141,top,565,top+49),color=None,fill=cream)
  if start+i>=len(treats):
   p.draw_rect(fitz.Rect(39,top,565,top+49),color=None,fill=cream);continue
  x=treats[start+i]
  p.draw_circle((83,top+23),19,color=None,fill=(.40,.85,.20));text(p,(69,top+5,105,top+42),str(x['num']),24,True)
  p.insert_text((150,top+17),x['address'].removesuffix(', NJ').upper(),fontsize=16,fontname='Heading')
  p.insert_text((150,top+32),' | '.join(filter(None,[x.get('dates'),x.get('times')])),fontsize=13,fontname='Body')
  p.insert_text((150,top+46),x.get('notes',''),fontsize=13,fontname='Body')
 # Remove the template-only wooden signs at the bottom right.
 p.draw_rect(fitz.Rect(520,688,612,762),color=None,fill=(.05,.035,.09))
for i,p in enumerate(doc):
 p.draw_rect(fitz.Rect(230,750,388,765),color=None,fill=(.06,.025,.12));text(p,(237,753,385,765),f'PAGE {i+1} OF {len(doc)} | UPDATED {data["date"]}',6,color=(1,1,1),minimum=6)
out=ROOT/'assets/hauntfinder-2026-listings.pdf';doc.save(out,garbage=4,deflate=True)
manifest={'source':'approved-guide.pdf','renderer':'scripts/build-flyer.py','pages':len(doc),'publicDataSha256':hashlib.sha256((ROOT/'app.js').read_text().split('const filters=')[0].encode()).hexdigest(),'pdfSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'displayIDs':[x['num'] for x in displays],'eventIDs':[x['id'] for x in events],'treatStopIDs':[x['num'] for x in treats],'updatedDate':data['date']}
(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(f'Built {len(doc)} illustrated pages with embedded listing fonts.')
