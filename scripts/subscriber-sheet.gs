// Bound Google Apps Script for the PRIVATE MTO Community Finder Subscribers sheet.
// Keep CRON_SECRET in Project Settings > Script properties, never in this file.
const COMMUNITY_SITE = 'https://hauntfinder.vercel.app';

function configureCommunityAlerts() {
 const properties=PropertiesService.getScriptProperties();
 const secret=properties.getProperty('CRON_SECRET');
 if(!secret||secret.length<32)throw new Error('Add CRON_SECRET to Script properties first.');
 const sheet=SpreadsheetApp.getActiveSpreadsheet();
 properties.setProperty('SPREADSHEET_ID',sheet.getId());
 sheet.setSpreadsheetTimeZone('America/New_York');
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='dailyCommunityAlerts').forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('dailyCommunityAlerts').timeBased().atHour(17).nearMinute(0).everyDays(1).inTimezone('America/New_York').create();
 sheet.getSheetByName('Setup').getRange('B4').setValue('Scheduler installed; website connection and test still required');
 console.log('Configured private sheet and daily trigger around 5 PM Eastern.');
}

function jsonResult(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)}
function secureEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function doPost(e){
 try{
  if(!e.postData||e.postData.contents.length>250000)return jsonResult({ok:false});
  const envelope=JSON.parse(e.postData.contents),secret=PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
  if(!secret||typeof envelope.payload!=='string')return jsonResult({ok:false});
  const signature=Utilities.computeHmacSha256Signature(envelope.payload,secret).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  if(!secureEqual(envelope.signature,signature))return jsonResult({ok:false});
  const data=JSON.parse(envelope.payload);
  if(!Number.isFinite(data.timestamp)||Math.abs(Date.now()-data.timestamp)>300000)return jsonResult({ok:false});
  const sheet=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  if(data.action==='ping')return jsonResult({ok:Boolean(sheet.getSheetByName('Subscribers')&&sheet.getSheetByName('Deliveries'))});
  if(data.action!=='sync'||!Array.isArray(data.subscribers)||!Array.isArray(data.deliveries)||data.subscribers.length>100||data.deliveries.length>100)return jsonResult({ok:false});
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
   upsertRows(sheet.getSheetByName('Subscribers'),data.subscribers.map(s=>{
    if(!/^[a-f0-9]{64}$/.test(s.id)||!['pending','confirmed','unsubscribed'].includes(s.status)||typeof s.email!=='string')throw new Error('Invalid subscriber');
    return [s.id,s.email,(s.seasons||[]).join(', '),(s.categories||[]).join(', '),'Daily summary',s.status,dateCell(s.signedUpAt),dateCell(s.confirmedAt),dateCell(s.unsubscribedAt),dateCell(s.lastSentAt),dateCell(s.lastChangedAt),s.consentVersion||''];
   }),[6,7,8,9,10]);
   upsertRows(sheet.getSheetByName('Deliveries'),data.deliveries.map(d=>{
    if(!/^[a-f0-9]{64}$/.test(d.id))throw new Error('Invalid delivery');
    return [d.id,d.subscriberId,d.email,dateCell(d.sentAt||d.attemptedAt),(d.identities||[]).join(', '),d.status,d.messageId||''];
   }),[3]);
   sheet.getSheetByName('Setup').getRange('B4').setValue('Connected. Last sync: '+Utilities.formatDate(new Date(),'America/New_York','yyyy-MM-dd HH:mm'));
   return jsonResult({ok:true});
  }finally{lock.releaseLock()}
 }catch{return jsonResult({ok:false})}
}
function dateCell(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))throw new Error('Invalid date');return date}
function literalCell(value){return typeof value==='string'&&/^[=+@-]/.test(value)?"'"+value:value}
function upsertRows(sheet,rows,dateColumns){
 const last=sheet.getLastRow(),ids=last>1?sheet.getRange(2,1,last-1,1).getValues().flat():[],positions={};
 ids.forEach((id,i)=>positions[id]=i+2);let next=last+1;
 rows.forEach(row=>{
  const number=positions[row[0]]||next++;positions[row[0]]=number;
  if(number>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
  sheet.getRange(number,1,1,row.length).setValues([row.map(literalCell)]).setFontFamily('Arial').setFontSize(10);
  dateColumns.forEach(column=>sheet.getRange(number,column+1).setNumberFormat('mm/dd/yy hh:mm'));
 });
}
function checkCommunityAlerts(){
 const secret=PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
 const response=UrlFetchApp.fetch(COMMUNITY_SITE+'/api/newsletter-status',{headers:{Authorization:'Bearer '+secret},muteHttpExceptions:true});
 const result=JSON.parse(response.getContentText());
 console.log(JSON.stringify(result));
 if(response.getResponseCode()!==200)throw new Error('Connection check failed. Check Vercel variables and redeployment.');
}
function dailyCommunityAlerts(){
 const started=Date.now(),properties=PropertiesService.getScriptProperties(),secret=properties.getProperty('CRON_SECRET');
 let sent=0,held=0;
 do{
  const response=UrlFetchApp.fetch(COMMUNITY_SITE+'/api/new-listing-digest',{method:'post',headers:{Authorization:'Bearer '+secret},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Daily summary failed: HTTP '+response.getResponseCode()+'. Check the website connection.');
  const result=JSON.parse(response.getContentText());sent+=result.sent||0;held=Math.max(held,result.held||0);
  if(!result.more||result.busy||result.quotaReached)break;
  // Leave a retry for tomorrow rather than exceed Google's six-minute limit.
 }while(Date.now()-started<240000);
 const sheet=SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
 sheet.getSheetByName('Setup').getRange('B4').setValue('Last daily check: '+Utilities.formatDate(new Date(),'America/New_York','yyyy-MM-dd HH:mm')+'. Summaries sent: '+sent+'. Delivery holds: '+held+'.');
}
