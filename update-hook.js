const fs = require('fs');
let c = fs.readFileSync('src/hooks/useEgyptianDrugs.ts', 'utf8');

const importStr = `import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'`;

c = c.replace(`import { useState, useEffect } from 'react'`, importStr);

const fetchLogic = `fetchPromise = Promise.all([
          fetch('https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json').then(res => res.json()),
          getDocs(collection(db, 'market_prices')).then(snap => snap.docs.map(d => d.data())).catch(() => [])
        ]).then(([staticData, liveMarketData]) => {
          // Merge live market data over static data
          const marketMap = new Map();
          liveMarketData.forEach((m: any) => {
            marketMap.set(m.name.toLowerCase(), m.price);
          });
          
          const merged = staticData.map((d: EgyptianDrug) => {
            const livePrice = marketMap.get((d.commercial_name_en || '').toLowerCase());
            if (livePrice) {
              return { ...d, price_egp: livePrice };
            }
            return d;
          });
          
          // Add newly discovered drugs that aren't in the static DB
          liveMarketData.forEach((m: any) => {
            const exists = staticData.find((sd: any) => (sd.commercial_name_en || '').toLowerCase() === m.name.toLowerCase());
            if (!exists) {
              merged.push({
                commercial_name_en: m.name,
                commercial_name_ar: m.name,
                scientific_name: 'Market Updated',
                manufacturer: 'Updated Market Price',
                drug_class: 'N/A',
                route: 'N/A',
                price_egp: m.price
              });
            }
          });

          cachedDrugs = merged;
          return merged;
        }).catch(err => {
          console.error(err);
          fetchPromise = null;
          throw err;
        })`;

c = c.replace(/fetchPromise = fetch\([\s\S]*?\}\)/, fetchLogic);

fs.writeFileSync('src/hooks/useEgyptianDrugs.ts', c);
