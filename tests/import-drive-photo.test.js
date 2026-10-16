const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../scripts/import-drive-photo.js');
const jpeg=Buffer.concat([Buffer.from([0xFF,0xD8,0xFF,0xE0]),Buffer.alloc(32)]);
test('driveFileId accepts file/d, open?id and uc?id links only',()=>{
  assert.equal(I.driveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing'),'1AbCdEfGhIjKlMn');
  assert.equal(I.driveFileId('https://drive.google.com/open?id=1AbCdEfGhIjKlMn'),'1AbCdEfGhIjKlMn');
  assert.equal(I.driveFileId('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMn'),'1AbCdEfGhIjKlMn');
  assert.equal(I.driveFileId('https://evil.example/file/d/1AbCdEfGhIjKlMn'),null);
  assert.equal(I.driveFileId('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn'),null);
});
test('sniffImage trusts bytes, not headers',()=>{
  assert.equal(I.sniffImage(jpeg).type,'image/jpeg');
  assert.equal(I.sniffImage(Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),Buffer.alloc(8)])).ext,'png');
  assert.equal(I.sniffImage(Buffer.from('<html><body>sign in</body></html>')),null);
});
test('validateDownload rejects private pages, big files and non-images',()=>{
  assert.equal(I.validateDownload({status:200,contentType:'image/jpeg',buf:jpeg}),null);
  assert.match(I.validateDownload({status:200,contentType:'text/html; charset=utf-8',buf:jpeg}),/web page/);
  assert.match(I.validateDownload({status:404,contentType:'',buf:jpeg}),/HTTP 404/);
  assert.match(I.validateDownload({status:200,contentType:'image/jpeg',buf:Buffer.concat([jpeg,Buffer.alloc(I.MAX_BYTES)])}),/limit is 5 MB/);
  assert.match(I.validateDownload({status:200,contentType:'application/pdf',buf:Buffer.from('%PDF-1.4 something long enough')}),/not a JPEG/);
});
test('records publish by default (no approval step); --hold keeps one pending; dry run is the default',()=>{
  assert.equal(I.buildRecord({url:'u',pathname:'p',driveId:'d'}).status,'approved');
  assert.equal(I.buildRecord({url:'u',pathname:'p',status:'pending',driveId:'d'}).status,'pending');
  assert.equal(I.buildRecord({url:'u',pathname:'p',status:'weird',driveId:'d'}).status,'approved');
  const a=I.parseArgs(['--num','1','--url','x','--num','13','--url','y']);
  assert.deepEqual(a.pairs,[{num:1,url:'x'},{num:13,url:'y'}]);assert.equal(a.apply,false);assert.equal(a.hold,false);
  assert.throws(()=>I.parseArgs(['--url','x']));
  assert.deepEqual(I.parseArgs(['--num','13','--file','/tmp/a.jpg']).pairs,[{num:13,file:'/tmp/a.jpg'}]);
});
