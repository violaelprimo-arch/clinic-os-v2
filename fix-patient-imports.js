const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/patient/page.tsx', 'utf8');
c = c.replace(
  "import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'",
  "import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from 'firebase/firestore'"
);
// Also remove duplicate doc, getDoc import if it exists further down.
c = c.replace(
  "import { doc, getDoc } from 'firebase/firestore'",
  "import { getDoc } from 'firebase/firestore'"
);
fs.writeFileSync('src/app/clinic/[slug]/patient/page.tsx', c);
