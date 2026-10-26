const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
const data=vm.runInNewContext(code+';({listings,events,CURRENT_SEASON,inCurrentSeason})');
// One shared current-season rule (defined in app.js): active-season confirmed
// and nominated records reach the release validator. Pending and unconfirmed stay out.
const {inCurrentSeason}=data;
data.listings=data.listings.filter(inCurrentSeason);
data.events=data.events.filter(inCurrentSeason);
delete data.CURRENT_SEASON;delete data.inCurrentSeason;
data.date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
process.stdout.write(JSON.stringify(data));
