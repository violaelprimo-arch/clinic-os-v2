import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-bold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90 shadow-2xs",
        secondary:
          "bg-secondary text-secondary-foreground border-border/50 [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground bg-transparent [a]:hover:bg-secondary/60",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-6 px-2.5 text-xs",
        sm: "h-5 px-2 text-[10px]",
        lg: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
    },
  })
}

export { Badge, badgeVariants }
