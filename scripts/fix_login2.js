const fs = require('fs');
const f = 'src/app/clinic/[slug]/login/page.tsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  /<\/form>/,
  `          </>
            )}
          </form>`
);

fs.writeFileSync(f, c);
console.log('Fixed login form syntax!');
