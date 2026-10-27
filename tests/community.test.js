const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const app=read('app.js'),html=read('index.html'),submit=read('submit.html'),nominate=read('nominate.html'),claim=read('claim.html');
const css=read('community.css'),lib=require('../nominate-lib.js');
const data=vm.runInNewContext(app.split('const filters=')[0]+';({listings,events})');

// Same helper bodies the page uses, evaluated on their own so the tests exercise the real source.
function helpers(){
  const pick=n=>{const m=new RegExp('function '+n+'\\(.*?\\)\\{.*\\}(?=\\n)').exec(app);assert.ok(m,n+' present');return m[0]};
  const ctx={state:{community:true,route:[],selected:null},localStorage:{store:{},getItem(k){return this.store[k]??null}},gmapsDirections:a=>'https://maps/'+a,listingHoursText:x=>[x.dates,x.times].filter(Boolean).join(' · '),cardIconHTML:()=>'<div class="pin pin--display pin--card"></div>',listingStatusHTML:()=>'',distanceLabelHTML:()=>'<span class="card__distance">2 mi</span>',scarePips:levels=>`<span class="pips">${levels.join(' ')}</span>`,hfTagHTML:t=>`<span class="chip">${t}</span>`,featureChip:v=>`<span class="chip">${v}</span>`,listingPageHref:x=>'listing.html?id='+x.num};
  vm.createContext(ctx);
  vm.runInContext('const communityOpen=new Set();\n'+['safeListingText','isCommunity','removedHere','communityNameText','communityPinHTML','communityDetailsHTML','communityBodyHTML','communityCardHTML'].map(pick).join('\n')+";const COMMUNITY_BADGE='Spotted by the community, not submitted by the owner';",ctx);
  return ctx;
}
const sample={num:7,name:'Decorated House on Flanders Rd',town:'Mount Olive',address:'118 Flanders Rd, Mount Olive, NJ',source:'community',notes:'Giant inflatable spider on the roof.',spottedBy:'Jess',photo:'https://example.blob.vercel-storage.com/n/1.jpg',dates:'Evenings · lit until 9 PM',levels:[],type:[],features:[]};

test('community card: compact address line; details, disclaimer and claim expand together',()=>{
  const c=helpers(),h=c.communityCardHTML(sample);
  assert.ok(h.includes('card card--compact card--community'),'same compact card shell as a standard display');
  assert.ok(h.includes('class="card__address"')&&h.includes('118 Flanders Rd, Mount Olive ↗'),'address is the purple directions line');
  assert.ok(h.includes('card__distance'),'distance sits on the address line');
  assert.equal(h.includes('>WHERE<')||h.includes('>BEST<')||h.includes('>WHY<'),false,'no WHERE/BEST/WHY table');
  assert.ok(/<div class="community__expand" hidden>/.test(h),'notes, disclaimer and claim are collapsed');
  const why=h.indexOf('community__why'),badge=h.indexOf('community__badge'),claim=h.indexOf('community__claim');
  assert.ok(why>0&&badge>why&&claim>badge,'expanded order is notes, then the disclaimer, then claim');
  assert.ok(h.includes('Spotted by the community, not submitted by the owner'),'disclaimer kept');
  assert.ok(h.includes('Spotted by Jess'),'nickname shown in the expanded details');
  assert.ok(h.includes('Is this your house? Claim it or remove it')&&h.includes('href="claim.html?id=7"'),'claim or remove link');
  assert.ok(h.includes('community__photo'),'photo frame when a photo exists');
  assert.ok(h.includes('data-community-toggle="7"')&&h.includes('>Details<'),'details control on the hours row');
  assert.ok(app.includes("if(card.hasAttribute('data-community'))toggleCommunityCard(n);if(matchMedia('(max-width:1023px)').matches)return;selectListing(n,true)"),'card click expands, and the mobile select guard stays');
  assert.match(css,/\.card--community \.community__expand\[hidden\]\{display:none!important\}/);
});
test('community card: no photo means no frame, no nickname means no byline',()=>{
  const c=helpers(),h=c.communityCardHTML({...sample,photo:undefined,spottedBy:undefined});
  assert.equal(h.includes('community__photo'),false);assert.equal(h.includes('community__by'),false);
  assert.ok(h.includes('Spotted by the community, not'),'badge still present');
});
test('community card: photo must be https and text is escaped',()=>{
  const c=helpers();
  assert.equal(c.communityCardHTML({...sample,photo:'javascript:alert(1)'}).includes('community__photo'),false);
  assert.equal(c.communityCardHTML({...sample,notes:'<img src=x onerror=1>'}).includes('<img src=x'),false);
});
test('community pin: own art, on-route art, number is the listing number',()=>{
  const h=helpers().communityPinHTML(7);
  assert.ok(h.includes('assets/pins/pin-community.svg')&&h.includes('assets/pins/pin-community-route.svg')&&h.includes('>7<'));
  assert.match(css,/pin--community\.is-on-route \.pin__art--route\{display:block\}/);
  assert.match(css,/\.pin__cnum\{[^}]*800 11px\/13px var\(--f-cond\);color:#FF7A1A/,'number Barlow Condensed 800 in #FF7A1A');
  assert.match(css,/is-on-route \.pin__cnum\{color:#A6E22E\}/,'on-route number is lime');
  assert.match(css,/community-icon \.pin\.pin--community\{position:absolute;left:50%;bottom:0;width:30px;height:35px/,'30x35 on mobile');
  assert.match(css,/min-width:768px\)\{html body \.community-icon \.pin\.pin--community\{width:34px;height:40px/,'34x40 on desktop');
  assert.ok(app.includes('iconSize:[44,44],iconAnchor:[22,44]'),'44x44 tap area, bottom-centre anchor');
});
test('filter: Community spotted shows only those listings; the default shows every listing including nominated ones',()=>{
  const chrome=read('chrome-filters.js');
  assert.ok(app.includes('community:false'),'off by default, so nominated listings stay in the full list');
  assert.equal(html.includes('communityChip'),false,'no floating chip over the map');
  assert.ok(chrome.includes("railSection('Community',railChip('community','community','Community spotted',state.community===true))"),'chip lives in the filter rail');
  assert.ok(chrome.includes("if(action==='community')setCommunity(state.community===false);"),'toggle handler');
  assert.ok(chrome.includes("railSection('Scare level',scares)+railSection('Community'"),'its own group, after scare level');
  assert.ok(/function railActiveCount\(\)\{return \(state\.community\?1:0\)/.test(chrome),'selecting it counts as an active filter');
  assert.ok(chrome.includes("if(e.target.closest('[data-rail-clear]')){state.community=false;"),'Clear all filters restores the default');
  assert.ok(app.includes("if(x.hidden||removedHere(x))return false;if(state.category==='displays'&&state.community&&!isCommunity(x))return false;"),'only-community filter');
  const m=/function removedHere\(x\)\{[^\n]*\}/.exec(app)[0];
  const ctx={localStorage:{getItem:()=>JSON.stringify([7])}};vm.createContext(ctx);vm.runInContext(m,ctx);
  assert.equal(ctx.removedHere({num:7}),true);assert.equal(ctx.removedHere({num:8}),false);
  const sc=/function setCommunity\(on\)\{[^\n]*\}/.exec(app)[0],c2={state:{community:false,selected:1},listings:[{num:1},{num:7,source:'community'}],isCommunity:x=>!!x&&x.source==='community',hid:false,hidePeek:()=>{c2.hid=true}};
  vm.createContext(c2);vm.runInContext(sc+';setCommunity(true)',c2);
  assert.equal(c2.state.community,true);assert.equal(c2.state.selected,null);assert.equal(c2.hid,true,'an owner listing drops out of the only-community view');
  c2.hid=false;c2.state.selected=7;vm.runInContext('setCommunity(false)',c2);
  assert.equal(c2.state.community,false);assert.equal(c2.state.selected,7);assert.equal(c2.hid,false,'clearing the filter keeps a community listing, which is still shown');
});
test('entry points: map button, submit.html last choice after Shops, map key row',()=>{
  assert.ok(submit.indexOf('data-type-link="shop"')<submit.indexOf('data-type-link="spotted"'),'A house I spotted comes after Shops');
  assert.ok(submit.indexOf('data-type-link="spotted"')<submit.indexOf('Treat stops and events can only be added by the host.'),'right next to the host line');
  assert.ok(html.includes('href="nominate.html">')&&html.includes('Spotted a great house? Nominate it'));
  assert.ok(submit.includes('A house I spotted')&&submit.includes('You saw a great display that isn’t yours. Nominate it and we’ll take a look.')&&submit.includes('href="nominate.html"'));
  assert.ok(submit.includes('Treat stops and events can only be added by the host.'));
  assert.ok(html.includes('Spotted by the community</li>'));
});
test('nomination form: exact copy and required fields',()=>{
  for(const t of ['Nominate a display','Saw a decorated house worth a visit? Tell us where it is. We check every nomination before it goes on the map.','Displays only. Events and treat stops need to come from the host.','No people or license plates, please.','Nickname only, no full names.','Kept private. Never shown on the site or shared.','This is visible from a public street and I’m not trespassing.','SEND NOMINATION','USE MY LOCATION','TAKE OR ADD A PHOTO','JPG, PNG or HEIC · up to 8 MB','Type the street address','FINDING THE NEAREST ADDRESS…','We only use the street address, never your exact GPS point. The pin goes on the street out front, not on the house.','ABOUT YOU · ALL OPTIONAL','EMAIL ME WHEN IT’S LIVE'])assert.ok(nominate.includes(t),t);
  assert.ok(nominate.includes('NICKNAME'));
  assert.equal(/type="tel"|phone/i.test(nominate+claim),false,'no phone field anywhere');
  const e=lib.validateNomination({street:'',town:'',publicStreet:false});
  assert.deepEqual(Object.keys(e).sort(),['location','publicStreet','town'],'location, town and the checkbox are the only required fields');
  assert.deepEqual(lib.validateNomination({street:'118 Flanders Rd',town:'Mount Olive',publicStreet:true}),{});
});
test('location rules: exact Census match, New Jersey only, street address not coordinates',()=>{
  const nj=lib.parseMatched('118 FLANDERS RD, MOUNT OLIVE, NJ, 07828');
  assert.deepEqual(nj,{street:'118 Flanders Rd',town:'Mount Olive',state:'NJ',zip:'07828'});assert.equal(lib.isNewJersey(nj),true);
  assert.equal(lib.isNewJersey(lib.parseMatched('40 MAIN ST, EASTON, PA, 18042')),false);
  assert.equal(lib.isNewJersey(lib.parseMatched('1 X ST, NEW YORK, NJ, 10001')),false,'NJ zip range is checked too');
  assert.equal(lib.parseMatched('nonsense'),null);
  assert.equal(lib.COPY.outsideNJ,'Hauntfinder only covers New Jersey for now.');
  assert.equal(lib.COPY.noMatch,'We couldn’t find a street address there. Please type it in.');
  const js=read('nominate.js');
  assert.ok(js.includes('censusExact')&&!/lat\s*:\s*pos\.coords/.test(js),'GPS is only used to find an address');
  assert.equal(/localStorage|console\.(log|info)/.test(js),false,'nothing about the nominator is stored or logged');
});
test('sent screen: after review, with and without an email',()=>{
  assert.equal(lib.sentMessage('118 Flanders Rd',true),'Your nomination for the house on Flanders Rd is waiting for review. It shows up on the map after we’ve checked it, not right away. Since you left your email, we’ll let you know when it’s live.');
  assert.equal(lib.sentMessage('118 Flanders Rd',false),'Your nomination for the house on Flanders Rd is waiting for review. It shows up on the map after we’ve checked it, not right away. Check back on the map after it’s reviewed.');
  for(const t of ['Thanks for the tip!','NOMINATE ANOTHER HOUSE','BACK TO THE MAP'])assert.ok(nominate.includes(t));
});
test('claim or remove: address, two choices, optional private email; remove hides at once',()=>{
  for(const t of ['Is this your house?','A neighbor nominated your display. You can take over the listing or ask us to remove it.','Claim it','Make it your own listing. You can add your hours, scare level and notes.','Remove it','The pin comes off the map as soon as you send this, while we confirm.','Kept private. Never shown on the site. Only used to reply about this request.','SEND REQUEST','It’s off the map.','We’ll confirm with our next review. Sorry for the surprise, and happy Halloween.','Thanks, we’ll be in touch.','The listing stays as it is until we’ve checked the request. Want to add details now?'])assert.ok(claim.includes(t),t);
  assert.deepEqual(Object.keys(lib.validateClaim({address:'a',request:'',email:''})),['request']);
  assert.deepEqual(lib.validateClaim({address:'a',request:'remove',email:''}),{});
  const store={};const st={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}};
  lib.rememberHidden(st,7);lib.rememberHidden(st,9);lib.rememberHidden(st,7);
  assert.deepEqual(lib.loadHidden(st),[7,9]);
  const js=read('claim.js');assert.ok(js.indexOf("rememberHidden")>js.indexOf('postForm'),'hidden only after the request is sent');
  assert.ok(/request === 'remove'\) N\.rememberHidden/.test(js),'claim leaves the listing unchanged');
});
test('forms: nothing is sent until the new Google Forms are configured; bodies carry only mapped fields',async()=>{
  assert.equal(lib.formConfigured({action:'',entries:{}}),false);
  await assert.rejects(()=>lib.postForm({action:'',entries:{}},{street:'x'},async()=>{throw new Error('must not send')}),/aren’t open/);
  const cfg={action:'https://docs.google.com/forms/d/e/ABC_def-1/formResponse',entries:{street:'entry.1',email:'entry.2'}};
  assert.equal(lib.formConfigured(cfg),true);
  let sent;await lib.postForm(cfg,{street:'118 Flanders Rd',email:'',other:'x'},async(u,o)=>{sent={u,o}});
  assert.equal(sent.u,cfg.action);assert.equal(sent.o.body,'entry.1=118+Flanders+Rd','empty and unmapped values are dropped');
  assert.equal(lib.formConfigured({action:'https://evil.example/formResponse',entries:{a:'b'}}),false,'only Google Forms endpoints');
});
test('photos: re-encoded to JPEG in the browser (drops EXIF/GPS); nomination uploads are JPEG-only, rate-limited, nothing published, no 13th function',()=>{
  assert.match(read('nominate-lib.js'),/toBlob\(.*'image\/jpeg'/s);
  const api=read('api/upload.js'),n=api.slice(api.indexOf('async function nominationToken'),api.indexOf('module.exports=async function handler'));
  assert.ok(n.includes("'image/jpeg'")&&n.includes('rate:nomination-photo')&&n.includes('nominations\\/'));
  assert.equal(/LPUSH|PHOTOS_KEY/.test(n),false,'never writes to the published photo lists');
  assert.ok(api.includes("if(String(tokenPayload||'').includes('\"nomination\":true'))return;"),'completion hook publishes nothing');
  assert.equal(fs.existsSync(path.join(ROOT,'api/nomination-photo.js')),false);
  assert.ok(fs.readdirSync(path.join(ROOT,'api')).filter(f=>f.endsWith('.js')).length<=12,'Hobby plan allows 12 serverless functions');
  assert.equal(read('nominations-config.js').includes("photoApi: '/api/upload'"),true);
  assert.equal(lib.MAX_PHOTO_BYTES,8*1024*1024);
});
test('data: shipped listings carry no email or phone; community records keep owner-listing shape',()=>{
  const dump=JSON.stringify(data.listings);
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(dump),false,'no email address in any listing');
  assert.equal(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(dump),false,'no phone number in any listing');
  for(const x of data.listings.filter(v=>v.source==='community')){
    assert.ok(Array.isArray(x.levels)&&Array.isArray(x.type)&&Array.isArray(x.features),'arrays keep every filter working');
    assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(x.name),false,'public display title, not an email');
    assert.equal(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(x.name),false,'public display title, not a phone number');
    assert.ok(typeof x.geoVerified==='string'&&/census/i.test(x.geoVerified),'Census-verified');
    assert.equal('email' in x||'phone' in x,false);
    if(x.spottedBy)assert.ok(!/@/.test(x.spottedBy));
    assert.equal(/Contest House/.test(x.name+' '+(x.notes||'')+' '+(x.address||'')),false,'Contest House is not part of the public listing text');
  }
  assert.equal(data.listings.length,117);
  const first=data.listings.find(x=>x.num===41),last=data.listings.find(x=>x.num===109);
  assert.equal(first.address,'35 Morse Avenue, Bloomfield, NJ 07003');
  assert.equal(first.lat,40.78496575);
  assert.equal(last.address,'13 Monmouth Avenue, Freehold, NJ 07728');
  assert.equal(last.geoVerified.includes('13 MONMOUTH AVE, FREEHOLD'),true);
  const parade=data.events.find(e=>e.id==='hackettstown-halloween-downtown-2026-10-31');
  const trunk=data.events.find(e=>e.id==='menlha-trunk-or-treat-2026-10-30');
  assert.equal(parade.eventType,'Parade');
  assert.equal(trunk.eventType,'Trunk-or-treat');
});
test('app.js and the config carry no contact data',()=>{
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(read('nominations-config.js')+read('nominate.js')+read('claim.js')),false);
});
