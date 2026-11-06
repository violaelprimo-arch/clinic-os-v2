'use client'

/** The clinic owns one brand palette, shared by doctor UI, booking UI and previews.
 * Strict hex parsing prevents unsafe CSS from being injected from clinic records. */
const VALID_HEX = /^#[0-9a-f]{6}$/i

export function DynamicTheme({ color, secondaryColor }: { color?: string; secondaryColor?: string }) {
  const primary = color && VALID_HEX.test(color) ? color : '#087CF4'
  const secondary = secondaryColor && VALID_HEX.test(secondaryColor) ? secondaryColor : '#02CFF3'

  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        :root, html.light, html.dark, [data-theme="light"], [data-theme="dark"] {
          --primary: ${primary};
          --ring: ${primary};
          --brand-primary: ${primary};
          --brand-cyan: ${secondary};
          --sidebar-primary: ${primary};
          --sidebar-ring: ${primary};
          --accent-foreground: ${primary};
          --chart-1: ${primary};
          --chart-2: ${secondary};
        }
        .text-\\[\\#087CF4\\] { color: ${primary} !important; }
        .bg-\\[\\#087CF4\\] { background-color: ${primary} !important; }
        .border-\\[\\#087CF4\\] { border-color: ${primary} !important; }
        .hover\\:bg-\\[\\#0769D1\\]:hover { background-color: ${primary} !important; filter: brightness(0.9); }
        .hover\\:text-\\[\\#087CF4\\]:hover { color: ${primary} !important; filter: brightness(0.9); }
        .ring-\\[\\#087CF4\\] { --tw-ring-color: ${primary} !important; }
        .focus\\:ring-\\[\\#087CF4\\]\\/20:focus { --tw-ring-color: ${primary}33 !important; }
        .shadow-\\[\\#087CF4\\]\\/20 { --tw-shadow-color: ${primary}33 !important; --tw-shadow: var(--tw-shadow-colored) !important; }
        .text-\\[\\#15B8A6\\] { color: ${secondary} !important; }
        .bg-\\[\\#15B8A6\\] { background-color: ${secondary} !important; }
        .border-\\[\\#15B8A6\\] { border-color: ${secondary} !important; }
      `
    }} />
  )
}
