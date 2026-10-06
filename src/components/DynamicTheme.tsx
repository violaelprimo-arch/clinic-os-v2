'use client'

export function DynamicTheme({ color }: { color?: string }) {
  if (!color || color.toUpperCase() === '#15B8A6') return null;
  
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        .text-\\[\\#15B8A6\\] { color: ${color} !important; }
        .bg-\\[\\#15B8A6\\] { background-color: ${color} !important; }
        .border-\\[\\#15B8A6\\] { border-color: ${color} !important; }
        .hover\\:bg-\\[\\#0D9488\\]:hover { background-color: ${color} !important; filter: brightness(0.9); }
        .hover\\:text-\\[\\#15B8A6\\]:hover { color: ${color} !important; filter: brightness(0.9); }
        .ring-\\[\\#15B8A6\\] { --tw-ring-color: ${color} !important; }
        .focus\\:ring-\\[\\#15B8A6\\]\\/20:focus { --tw-ring-color: ${color}33 !important; }
        .shadow-\\[\\#15B8A6\\]\\/20 { --tw-shadow-color: ${color}33 !important; --tw-shadow: var(--tw-shadow-colored) !important; }
      `
    }} />
  )
}
