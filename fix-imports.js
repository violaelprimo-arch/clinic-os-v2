const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

content = content.replace(
  "import { MessageCircle, Plus, Trash2 } from 'lucide-react'",
  "import { MessageCircle } from 'lucide-react'"
);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', content);
