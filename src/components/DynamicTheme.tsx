'use client'

export function DynamicTheme({ color }: { color?: string }) {
  if (!color || color.toUpperCase() === '#087CF4') return null;
  
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        .text-\\[\\#087CF4\\] { color: ${color} !important; }
        .bg-\\[\\#087CF4\\] { background-color: ${color} !important; }
        .border-\\[\\#087CF4\\] { border-color: ${color} !important; }
        .hover\\:bg-\\[\\#0769D1\\]:hover { background-color: ${color} !important; filter: brightness(0.9); }
        .hover\\:text-\\[\\#087CF4\\]:hover { color: ${color} !important; filter: brightness(0.9); }
        .ring-\\[\\#087CF4\\] { --tw-ring-color: ${color} !important; }
        .focus\\:ring-\\[\\#087CF4\\]\\/20:focus { --tw-ring-color: ${color}33 !important; }
        .shadow-\\[\\#087CF4\\]\\/20 { --tw-shadow-color: ${color}33 !important; --tw-shadow: var(--tw-shadow-colored) !important; }
        
        .text-\\[\\#15B8A6\\] { color: ${color} !important; }
        .bg-\\[\\#15B8A6\\] { background-color: ${color} !important; }
        .border-\\[\\#15B8A6\\] { border-color: ${color} !important; }
      `
    }} />
  )
}
