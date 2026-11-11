export const fees={website:3000,monthly:2000,adManagementRate:.15};

export function calculateCore(termMonths=6){
 if(!Number.isInteger(termMonths)||termMonths<1)throw new RangeError('Invalid term');
 return {website:fees.website,monthly:fees.monthly,termMonths,management:fees.monthly*termMonths,total:fees.website+fees.monthly*termMonths};
}

export function calculatePaidAds(adSpend){
 if(!Number.isFinite(adSpend)||adSpend<0)throw new RangeError('Invalid ad spend');
 const managementFee=adSpend*fees.adManagementRate;
 return {adSpend,managementFee,total:adSpend+managementFee};
}
