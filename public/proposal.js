const $=id=>document.getElementById(id);
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
window.addEventListener('hashchange',()=>{const i=slides.findIndex(s=>'#'+s.id===location.hash);if(i>=0)go(i,false);});
const initial=slides.findIndex(s=>'#'+s.id===location.hash);if(initial>=0)current=initial;updateNavigation();

function setProposalView(detailed,updateHash=true){
 document.body.classList.toggle('summary-view',!detailed);
 $('owner-summary').hidden=detailed;$('detailed-proposal').hidden=!detailed;
 $('summary-view').setAttribute('aria-pressed',String(!detailed));$('details-view').setAttribute('aria-pressed',String(detailed));
 if(!detailed){presenting=false;document.body.classList.remove('presenting');$('present').setAttribute('aria-pressed','false');$('present').textContent='Present';if(updateHash)history.replaceState(null,'','#overview');$('overview').scrollIntoView({behavior:'instant',block:'start'});}
 else{go(current,updateHash);}
}
$('summary-view').addEventListener('click',()=>setProposalView(false));
$('details-view').addEventListener('click',()=>setProposalView(true));
$('open-details').addEventListener('click',()=>setProposalView(true));
window.addEventListener('hashchange',()=>{if(location.hash==='#overview')setProposalView(false,false);else if(slides.some(s=>'#'+s.id===location.hash))setProposalView(true,false);});
setProposalView(initial>=0,false);
