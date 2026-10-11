const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/layout.tsx', 'utf8');

if (!c.includes("clinicData.isActive === false")) {
  c = c.replace(
    /if \(!snapshot\.empty\) \{\s*setClinic\(\{ id: snapshot\.docs\[0\]\.id, \.\.\.snapshot\.docs\[0\]\.data\(\) \}\)\s*\} else if \(slug === 'demo'\) \{/,
    `if (!snapshot.empty) {
            const clinicData = snapshot.docs[0].data();
            if (clinicData.isActive === false || (clinicData.expirationDate && new Date(clinicData.expirationDate) < new Date())) {
              window.location.href = \`/clinic/\${slug}/login?error=subscription_ended\`;
              return;
            }
            setClinic({ id: snapshot.docs[0].id, ...clinicData });
          } else if (slug === 'demo') {`
  );
  fs.writeFileSync('src/app/clinic/[slug]/admin/layout.tsx', c);
  console.log('Fixed admin layout subscription check!');
} else {
  console.log('Already fixed admin layout.');
}
