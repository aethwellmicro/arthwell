import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        /* In-App / Nav Button (6px tight square) */
        default:
          "rounded-[6px] bg-[#171717] text-white shadow-xs hover:bg-[#262626] dark:bg-white dark:text-[#171717] dark:hover:bg-[#f5f5f5]",
        destructive:
          "rounded-[6px] bg-[#171717] text-white shadow-xs hover:bg-[#262626] dark:bg-white dark:text-[#171717] dark:hover:bg-[#f5f5f5]",
        outline:
          "rounded-[6px] border border-[#ebebeb] bg-white text-[#171717] shadow-xs hover:bg-[#f5f5f5] hover:text-[#171717] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed] dark:hover:bg-[#1a1a1a]",
        secondary:
          "rounded-[6px] bg-[#f5f5f5] text-[#171717] border border-[#ebebeb] shadow-xs hover:bg-[#ebebeb] dark:bg-[#1a1a1a] dark:text-[#ededed] dark:border-[#262626] dark:hover:bg-[#262626]",
        ghost:
          "rounded-[6px] hover:bg-[#f5f5f5] text-[#4d4d4d] hover:text-[#171717] dark:text-[#a1a1a1] dark:hover:bg-[#1a1a1a] dark:hover:text-white",
        link: "text-foreground underline-offset-4 hover:underline font-normal",

        /* Marketing & Main CTA Pills (100px rounded) */
        pill:
          "rounded-[100px] bg-[#171717] text-white shadow-xs hover:bg-[#262626] px-5 py-2 font-medium tracking-tight dark:bg-white dark:text-[#171717] dark:hover:bg-[#f5f5f5]",
        "pill-secondary":
          "rounded-[100px] bg-white text-[#171717] border border-[#ebebeb] shadow-xs hover:bg-[#f5f5f5] px-5 py-2 font-medium tracking-tight dark:bg-[#0a0a0a] dark:text-[#ededed] dark:border-[#262626] dark:hover:bg-[#1a1a1a]",
        "pill-outline":
          "rounded-[100px] border border-[#ebebeb] bg-transparent text-[#171717] hover:bg-[#f5f5f5] px-5 py-2 font-medium tracking-tight dark:border-[#262626] dark:text-[#ededed] dark:hover:bg-[#1a1a1a]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-[6px] gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 rounded-[6px] px-6 text-sm has-[>svg]:px-4",
        icon: "size-8 rounded-[6px]",
        "icon-circular": "size-8 rounded-full border border-[#ebebeb] bg-white text-[#171717] dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-[#ededed] hover:bg-[#f5f5f5] dark:hover:bg-[#1a1a1a]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
