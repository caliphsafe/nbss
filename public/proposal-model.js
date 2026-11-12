export const fees={website:3000,monthly:2500,startingAdSpend:1000,content:500,initialShoot:1250,adManagementRate:.15};

export function calculateCore(termMonths=6){
 if(!Number.isInteger(termMonths)||termMonths<1)throw new RangeError('Invalid term');
 return {website:fees.website,monthly:fees.monthly,termMonths,management:fees.monthly*termMonths,total:fees.website+fees.monthly*termMonths};
}

export function calculatePaidAds(adSpend){
 if(!Number.isFinite(adSpend)||adSpend<0)throw new RangeError('Invalid ad spend');
 const managementFee=adSpend*fees.adManagementRate;
 return {adSpend,managementFee,total:adSpend+managementFee};
}

export function calculateProgram(termMonths=6,adSpend=fees.startingAdSpend){
 const core=calculateCore(termMonths),paidAds=calculatePaidAds(adSpend);
 const marketing={adSpend:termMonths*paidAds.adSpend,adManagement:termMonths*paidAds.managementFee,content:termMonths*fees.content,initialShoot:fees.initialShoot};
 marketing.total=marketing.adSpend+marketing.adManagement+marketing.content+marketing.initialShoot;
 return {termMonths,monthlyManagement:fees.monthly,marketing,total:core.total+marketing.total};
}
