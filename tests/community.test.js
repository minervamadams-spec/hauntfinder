const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const app=read('app.js'),html=read('index.html'),submit=read('submit.html'),nominate=read('nominate.html'),claim=read('claim.html');
const css=read('community.css'),lib=require('../nominate-lib.js');
const data=vm.runInNewContext(app.split('const filters=')[0]+';({listings})');

// Same helper bodies the page uses, evaluated on their own so the tests exercise the real source.
function helpers(){
  const pick=n=>{const m=new RegExp('function '+n+'\\(.*?\\)\\{.*\\}(?=\\n)').exec(app);assert.ok(m,n+' present');return m[0]};
  const ctx={state:{community:true,route:[],selected:null},localStorage:{store:{},getItem(k){return this.store[k]??null}},gmapsDirections:a=>'https://maps/'+a,listingHoursText:x=>x.dates||''};
  vm.createContext(ctx);
  vm.runInContext(['safeListingText','isCommunity','removedHere','communityNameText','communityPinHTML','communityBodyHTML','communityCardHTML'].map(pick).join('\n')+";const COMMUNITY_BADGE='Spotted by the community, not submitted by the owner';",ctx);
  return ctx;
}
const sample={num:7,name:'Decorated House on Flanders Rd',town:'Mount Olive',address:'118 Flanders Rd, Mount Olive, NJ',source:'community',notes:'Giant inflatable spider on the roof.',spottedBy:'Jess',photo:'https://example.blob.vercel-storage.com/n/1.jpg',dates:'Evenings · lit until 9 PM',levels:[],type:[],features:[]};

test('community card: badge, WHERE/BEST/WHY in order, nickname, claim link',()=>{
  const c=helpers(),h=c.communityCardHTML(sample);
  assert.ok(h.includes('Spotted by the community, not submitted by the owner'),'badge on every community card');
  const where=h.indexOf('>WHERE<'),best=h.indexOf('>BEST<'),why=h.indexOf('>WHY<');
  assert.ok(where>0&&best>where&&why>best,'rows in order WHERE, BEST, WHY');
  assert.ok(h.includes('Spotted by Jess'),'nickname shown');
  assert.ok(h.includes('Is this your house? Claim it or remove it')&&h.includes('href="claim.html?id=7"'),'claim or remove link');
  assert.ok(h.includes('community__photo'),'photo frame when a photo exists');
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
  assert.match(css,/\.pin__cnum\{[^}]*800 17px\/20px var\(--f-cond\);color:#FF7A1A/,'number Barlow Condensed 800 in #FF7A1A');
  assert.match(css,/is-on-route \.pin__cnum\{color:#A6E22E\}/,'on-route number is lime');
  assert.match(css,/pin--community\{width:46px;height:54px/);assert.match(css,/min-width:768px\)\{html body \.pin\.pin--community\{width:58px;height:68px/);
  assert.ok(app.includes('iconAnchor:[w/2,h]'),'community anchor is bottom centre');
});
test('filter: community chip is its own toggle, default on, hides only community; hidden listings never show',()=>{
  assert.ok(app.includes('community:true'),'on by default');
  assert.ok(html.includes('id="communityChip" aria-pressed="true"')&&html.includes('Community spotted'));
  assert.ok(app.includes("if(x.hidden||removedHere(x))return false;if(isCommunity(x)&&!state.community)return false;"),'matchFilter order');
  assert.equal(/state\.filter=.*communityChip/.test(app),false,'chip does not touch the scare-level filter');
  const m=/function removedHere\(x\)\{[^\n]*\}/.exec(app)[0];
  const ctx={localStorage:{getItem:()=>JSON.stringify([7])}};vm.createContext(ctx);vm.runInContext(m,ctx);
  assert.equal(ctx.removedHere({num:7}),true);assert.equal(ctx.removedHere({num:8}),false);
});
test('entry points: map button, submit.html third choice, map key row',()=>{
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
test('photos: re-encoded to JPEG in the browser (drops EXIF/GPS); API accepts JPEG only, rate-limited, nothing published',()=>{
  assert.match(read('nominate-lib.js'),/toBlob\(.*'image\/jpeg'/s);
  const api=read('api/nomination-photo.js');
  assert.ok(api.includes("ALLOWED_TYPES=['image/jpeg']")&&api.includes('MAX_MINTS_PER_HOUR')&&api.includes('nominations\\/'));
  assert.equal(/LPUSH|photos:/.test(api),false,'never writes to the published photo lists');
  assert.equal(lib.MAX_PHOTO_BYTES,8*1024*1024);
});
test('data: shipped listings carry no email or phone; community records keep owner-listing shape',()=>{
  const dump=JSON.stringify(data.listings);
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(dump),false,'no email address in any listing');
  assert.equal(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(dump),false,'no phone number in any listing');
  for(const x of data.listings.filter(v=>v.source==='community')){
    assert.ok(Array.isArray(x.levels)&&Array.isArray(x.type)&&Array.isArray(x.features),'arrays keep every filter working');
    assert.match(x.name,/^Decorated House on /,'named by street, never by the owner');
    assert.ok(typeof x.geoVerified==='string'&&/census/i.test(x.geoVerified),'Census-verified');
    assert.equal('email' in x||'phone' in x,false);
    if(x.spottedBy)assert.ok(!/@/.test(x.spottedBy));
  }
});
test('app.js and the config carry no contact data',()=>{
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(read('nominations-config.js')+read('nominate.js')+read('claim.js')),false);
});
