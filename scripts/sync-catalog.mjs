import {writeFile} from 'node:fs/promises';
import {fetchCatalog} from '../lib/catalog.mjs';
const data=await fetchCatalog();
await writeFile(new URL('../data/catalog.json',import.meta.url),JSON.stringify({...data,updatedAt:new Date().toISOString()},null,2));
console.log(`Updated ${data.products.length} products. Run npm run build and commit the refreshed catalog.`);
