fetch('/api/subscriptions').then(r=>r.json()).then(d=>{if(d.available)document.querySelectorAll('[data-alerts-link]').forEach(x=>{x.hidden=false})}).catch(()=>{});
