const configured=()=>Boolean(process.env.RESEND_API_KEY&&process.env.ORDER_FROM_EMAIL&&process.env.ORDER_NOTIFICATION_EMAIL);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function orderEmailConfigured(){return configured();}

async function sendEmail({to,subject,text,html}){
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.ORDER_FROM_EMAIL,to:[to],subject,text,html}),signal:AbortSignal.timeout(10000)
  });
  return response.ok;
}

export async function sendOrderEmails(order,orderNumber,{sendStaff=true,sendCustomer=true}={}){
  if(!configured()) return {configured:false,customer:false,staff:false};
  const itemLines=order.items.length?order.items.map(x=>`• ${x.item}${x.qty?` — ${x.qty}`:''}`).join('\n'):'No specific items; see notes.';
  const itemsHtml=order.items.length?`<ul>${order.items.map(x=>`<li>${esc(x.item)}${x.qty?` — ${esc(x.qty)}`:''}</li>`).join('')}</ul>`:'<p>No specific items; see notes.</p>';
  const staffText=`New vessel supply request ${orderNumber}\n\nName: ${order.name}\nEmail: ${order.email}\nVessel / company: ${order.company||'Not provided'}\nNeeded by: ${order.neededBy||'Not specified'}\nHandoff: ${order.handoff}\n\nItems:\n${itemLines}\n\nNotes:\n${order.message||'None'}\n\nOpen the private NBSS order desk to review and update this request.`;
  const staffHtml=`<h2>New vessel supply request ${esc(orderNumber)}</h2><p><strong>${esc(order.name)}</strong> · <a href="mailto:${encodeURIComponent(order.email)}">${esc(order.email)}</a></p><p>Vessel / company: ${esc(order.company||'Not provided')}<br>Needed by: ${esc(order.neededBy||'Not specified')}<br>Handoff: ${esc(order.handoff)}</p><h3>Supply list</h3>${itemsHtml}<h3>Customer notes</h3><p>${esc(order.message||'None').replace(/\n/g,'<br>')}</p><p>Open the private NBSS order desk to review and update this request.</p>`;
  const customerText=`New Bedford Ship Supply received your request ${orderNumber}. This is a request for availability and pricing, not a confirmed order. The counter will follow up to confirm stock, price and handoff. For time-sensitive needs, call 508-994-2961.\n\nYour list:\n${itemLines}`;
  const customerHtml=`<p>New Bedford Ship Supply received your supply request.</p><p><strong>Reference: ${esc(orderNumber)}</strong></p><p>This is a request for availability and pricing, not a confirmed order. The counter will follow up to confirm stock, price and handoff. For time-sensitive needs, call <a href="tel:+15089942961">508-994-2961</a>.</p><h3>Your list</h3>${itemsHtml}`;
  const [staff,customer]=await Promise.all([
    sendStaff?sendEmail({to:process.env.ORDER_NOTIFICATION_EMAIL,subject:`New supply request ${orderNumber}`,text:staffText,html:staffHtml}).catch(()=>false):Promise.resolve(false),
    sendCustomer?sendEmail({to:order.email,subject:`NBSS received request ${orderNumber}`,text:customerText,html:customerHtml}).catch(()=>false):Promise.resolve(false)
  ]);
  return {
    configured:true,
    staff:staff===true,
    customer:customer===true
  };
}

