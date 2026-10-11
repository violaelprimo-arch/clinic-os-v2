const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', 'utf8');

const oldPagination = `{Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                size="sm"
                variant={currentPage === page ? 'default' : 'outline'}
                onClick={() => setCurrentPage(page)}
                className={\`h-8 w-8 text-xs font-bold rounded-xl \${
                  currentPage === page ? 'bg-[#15B8A6] text-white hover:bg-[#0D9488]' : ''
                }\`}
              >
                {page}
              </Button>
            ))}`;

const newPagination = `<div className="flex items-center px-4 font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl h-8">
              صفحة {currentPage} من {totalPages}
            </div>`;

c = c.replace(oldPagination, newPagination);
fs.writeFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', c);
