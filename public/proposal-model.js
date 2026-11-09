export const scenarios = {
 conservative: {label:'Conservative', note:'A measured start, led by existing customers and gradual repeat demand.', orders:[20,30,40,50,60,70,80,90,100,105,110,120]},
 base: {label:'Base case', note:'Consistent storytelling, successful product tests and a growing repeat audience.', orders:[35,50,75,100,125,150,175,200,225,250,275,300]},
 growth: {label:'Growth case', note:'A stronger response that requires proven acquisition, dependable stock and a capacity review.', orders:[50,75,100,140,180,220,260,300,350,400,450,500]}
};
export function calculate(scenario='base',aov=75,margin=55,ads=750){
 if(!scenarios[scenario]||![aov,margin,ads].every(Number.isFinite)||aov<=0||margin<0||margin>100||ads<0)throw new RangeError('Invalid planning assumptions');
 const fixed=2000+300+150+ads;
 const months=scenarios[scenario].orders.map((orders,index)=>{
 const sales=orders*aov,garments=sales*(1-margin/100),payments=sales*.035,shipping=sales*.08,packaging=sales*.02,returns=sales*.03,overage=Math.max(0,orders-75)*4;
 const cost=garments+payments+shipping+packaging+returns+fixed+overage;
 return {month:index+1,orders,sales,garments,payments,shipping,packaging,returns,overage,fixed,cost,result:sales-cost};
 });
 const annual=months.reduce((a,m)=>{for(const k of ['orders','sales','cost','result'])a[k]+=m[k];return a;},{orders:0,sales:0,cost:0,result:0});
 const contribution=aov*(margin/100-.165);
 const breakEvenOrders=contribution<=0?null:fixed/contribution<=75?Math.ceil(fixed/contribution):contribution<=4?null:Math.ceil((fixed-300)/(contribution-4));
 return {months,annual,fixed,launch:4600,afterLaunch:annual.result-4600,breakEvenOrders,breakEvenSales:breakEvenOrders===null?null:breakEvenOrders*aov};
}
