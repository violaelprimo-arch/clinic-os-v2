const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', 'utf8');

const fetchLogic = `          if (data.favoriteDrugs) {
            setFavoriteList(data.favoriteDrugs)
          } else {
            const defaults = STRUCTURED_DRUGS.filter(d => d.isFavorite).map(d => d.name)
            setFavoriteList(defaults)
          }`;

content = content.replace(
  `          if (data.favoriteDrugs) {
            setFavoriteList(data.favoriteDrugs)
          }`,
  fetchLogic
);

content = content.replace(
  "const isFav = favoriteList.includes(drug.name) || drug.isFavorite",
  "const isFav = favoriteList.includes(drug.name)"
);

fs.writeFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', content);
