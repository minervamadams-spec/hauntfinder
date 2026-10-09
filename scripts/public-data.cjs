const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('const filters=')[0];
const data=vm.runInNewContext(code+';({listings,events})');
data.date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
process.stdout.write(JSON.stringify(data));
