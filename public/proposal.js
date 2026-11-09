import {calculate,scenarios} from './proposal-model.js?v=4';
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n),number=n=>new Intl.NumberFormat('en-US').format(n);
let scenario='base';
function result(id,value){const el=$(id);el.textContent=money(value);el.classList.toggle('negative',value<0);el.classList.toggle('positive',value>=0);}
function renderModel(){
 const aov=+$('aov').value,ads=+$('ads').value,m=calculate(scenario,aov,ads),last=m.months.at(-1);
 $('aov-value').textContent=money(aov);$('ads-value').textContent=money(ads);
 $('scenario-note').textContent=scenarios[scenario].note;$('year-sales').textContent=money(m.annual.sales);$('year-cost').textContent=money(m.annual.cost);result('year-result',m.annual.result);
 $('result-label').textContent='Before launch allocation and other business expenses';$('month-orders').textContent=number(last.orders)+' orders';$('traffic').textContent=number(last.orders/.02)+' sessions at illustrative 2% conversion';result('month-result',last.result);result('after-launch',m.afterLaunch);
 $('break-even').textContent=m.coverageSales===null?'Not reached':money(m.coverageSales);$('break-orders').textContent=m.coverageOrders===null?'Order contribution does not cover variable fulfillment':number(m.coverageOrders)+' orders cover listed monthly costs only';
 $('model-warning').textContent='Revenue less listed costs is not business profit. Other operating expenses are excluded. '+(last.orders>200?'Volume above 200 orders/month requires a capacity review; additional capacity costs are not modeled.':'Sales are illustrative, not guaranteed.');
 $('table-caption').textContent=scenarios[scenario].label+' — first 12 operating months';
 $('model-table').innerHTML=m.months.map(x=>`<tr><th scope="row">Month ${x.month}</th><td>${number(x.orders)}</td><td>${money(x.sales)}</td><td>${money(x.cost)}</td><td class="${x.result<0?'negative':'positive'}">${money(x.result)}</td></tr>`).join('')+`<tr><th scope="row">Year 1 total</th><td>${number(m.annual.orders)}</td><td>${money(m.annual.sales)}</td><td>${money(m.annual.cost)}</td><td class="${m.annual.result<0?'negative':'positive'}">${money(m.annual.result)}</td></tr>`;
 const mobile=window.innerWidth<600,w=mobile?600:1100,h=mobile?330:270,left=mobile?54:60,right=12,top=22,bottom=38,cw=w-left-right,ch=h-top-bottom,max=Math.ceil(Math.max(...m.months.flatMap(x=>[x.sales,x.cost]))/5000)*5000,step=cw/12;
 let svg=`<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
 for(let i=0;i<=4;i++){const v=max*i/4,y=top+ch*(1-i/4);svg+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="#ced0c5" stroke-width="1"/><text x="${left-10}" y="${y+4}" text-anchor="end" fill="#626962" font-family="Barlow,Arial" font-size="${mobile?14:12}">$${v>=1000?+(v/1000).toFixed(1)+'k':v}</text>`;}
 m.months.forEach((x,i)=>{const px=left+i*step+step*.25,py=top+ch*(1-x.sales/max);svg+=`<rect x="${px}" y="${py}" width="${step*.5}" height="${ch*x.sales/max}" rx="1" fill="#263d30"><title>Month ${x.month}: sales ${money(x.sales)}, costs ${money(x.cost)}, result ${money(x.result)}</title></rect><text x="${left+(i+.5)*step}" y="${h-13}" text-anchor="middle" fill="#626962" font-family="Barlow,Arial" font-size="${mobile?14:12}">${mobile?x.month:'M'+x.month}</text>`;});
 svg+=`<polyline points="${m.months.map((x,i)=>`${left+(i+.5)*step},${top+ch*(1-x.cost/max)}`).join(' ')}" fill="none" stroke="#9b3d2d" stroke-width="2.5"/>`;
 m.months.forEach((x,i)=>svg+=`<circle cx="${left+(i+.5)*step}" cy="${top+ch*(1-x.cost/max)}" r="3.5" fill="#9b3d2d"/>`);svg+='</svg>';$('model-chart').innerHTML=svg;
 $('model-chart').setAttribute('aria-label',`${scenarios[scenario].label}. Monthly net sales rise from ${money(m.months[0].sales)} to ${money(last.sales)}; monthly listed costs rise from ${money(m.months[0].cost)} to ${money(last.cost)}. Full figures in the following expandable table.`);
}
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{scenario=b.dataset.scenario;document.querySelectorAll('[data-scenario]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderModel();}));
for(const id of ['aov','ads'])$(id).addEventListener('input',renderModel);renderModel();
const slides=[...document.querySelectorAll('.slide')];let current=0,presenting=false;
slides.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' / '+s.dataset.title;$('section-picker').append(o);});
function updateNavigation(){slides.forEach((s,i)=>s.classList.toggle('active-slide',i===current));$('current-slide').textContent=String(current+1).padStart(2,'0');$('section-picker').value=current;$('previous').disabled=current===0;$('next-slide').disabled=current===slides.length-1;$('deck-progress').style.width=((current+1)/slides.length*100)+'%';}
function go(index,hash=true){current=Math.max(0,Math.min(index,slides.length-1));updateNavigation();if(hash)history.replaceState(null,'','#'+slides[current].id);slides[current].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
$('previous').addEventListener('click',()=>go(current-1));$('next-slide').addEventListener('click',()=>go(current+1));$('section-picker').addEventListener('change',e=>go(+e.target.value));
$('present').addEventListener('click',()=>{presenting=!presenting;document.body.classList.toggle('presenting',presenting);$('present').setAttribute('aria-pressed',String(presenting));$('present').innerHTML=presenting?'Exit presentation':'Present';updateNavigation();go(current,false);});
$('print').addEventListener('click',()=>window.print());
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const index=slides.findIndex(s=>'#'+s.id===a.getAttribute('href'));if(index>=0){e.preventDefault();go(index);}}));
window.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,button,summary')||!presenting)return;if(['ArrowRight','PageDown','ArrowLeft','PageUp','Home','End','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape')$('present').click();else go(e.key==='Home'?0:e.key==='End'?slides.length-1:current+(['ArrowRight','PageDown'].includes(e.key)?1:-1));}});
let ticking=false;window.addEventListener('scroll',()=>{if(document.body.classList.contains('summary-view')||presenting||ticking)return;ticking=true;requestAnimationFrame(()=>{let best=0;slides.forEach((s,i)=>{if(s.getBoundingClientRect().top<=window.innerHeight*.33)best=i;});if(best!==current){current=best;updateNavigation();}ticking=false;});},{passive:true});
window.addEventListener('resize',renderModel);window.addEventListener('hashchange',()=>{const i=slides.findIndex(s=>'#'+s.id===location.hash);if(i>=0)go(i,false);});
const initial=slides.findIndex(s=>'#'+s.id===location.hash);if(initial>=0)current=initial;updateNavigation();

function setProposalView(detailed,updateHash=true){
 document.body.classList.toggle('summary-view',!detailed);
 $('owner-summary').hidden=detailed;$('detailed-proposal').hidden=!detailed;
 $('summary-view').setAttribute('aria-pressed',String(!detailed));$('details-view').setAttribute('aria-pressed',String(detailed));
 if(!detailed){presenting=false;document.body.classList.remove('presenting');$('present').setAttribute('aria-pressed','false');$('present').textContent='Present';if(updateHash)history.replaceState(null,'','#overview');$('overview').scrollIntoView({behavior:'instant',block:'start'});}
 else{renderModel();go(current,updateHash);}
}
$('summary-view').addEventListener('click',()=>setProposalView(false));
$('details-view').addEventListener('click',()=>setProposalView(true));
$('open-details').addEventListener('click',()=>setProposalView(true));
$('summary-scenarios').innerHTML=Object.keys(scenarios).map(key=>{const m=calculate(key);return `<tr><th scope="row">${scenarios[key].label}</th><td>${number(m.sixMonth.orders)}</td><td>${money(m.sixMonth.sales)}</td><td>${money(m.sixMonth.cost+m.launch)}</td><td>${money(m.sixMonthAfterLaunch)}</td></tr>`;}).join('');
window.addEventListener('hashchange',()=>{if(location.hash==='#overview')setProposalView(false,false);else if(slides.some(s=>'#'+s.id===location.hash))setProposalView(true,false);});
setProposalView(initial>=0,false);
