export const scenarios = {
 conservative: {label:'Conservative', note:'A measured start, led by existing customers and gradual repeat demand.', orders:[20,30,40,50,60,70,80,90,100,105,110,120]},
 base: {label:'Base case', note:'Consistent storytelling, successful product tests and a growing repeat audience.', orders:[35,50,75,100,125,150,175,200,225,250,275,300]},
 growth: {label:'Growth case', note:'A stronger response that requires proven acquisition, dependable stock and a capacity review.', orders:[50,75,100,140,180,220,260,300,350,400,450,500]}
};
export const budget={management:2000,content:300,website:3000,photography:1250};
export function calculate(scenario='base',aov=75,ads=750){
 if(!scenarios[scenario]||![aov,ads].every(Number.isFinite)||aov<=0||ads<0)throw new RangeError('Invalid planning assumptions');
 const fixed=budget.management+budget.content+ads;
 const months=scenarios[scenario].orders.map((orders,index)=>{const sales=orders*aov,cost=fixed;return {month:index+1,orders,sales,cost,result:sales-cost};});
 const sum=rows=>rows.reduce((a,m)=>{for(const k of ['orders','sales','cost','result'])a[k]+=m[k];return a;},{orders:0,sales:0,cost:0,result:0});
 const annual=sum(months),sixMonth=sum(months.slice(0,6)),launch=budget.website+budget.photography;
 return {months,annual,sixMonth,fixed,launch,afterLaunch:annual.result-launch,sixMonthAfterLaunch:sixMonth.result-launch,coverageOrders:Math.ceil(fixed/aov),coverageSales:Math.ceil(fixed/aov)*aov};
}
