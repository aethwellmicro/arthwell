import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:ring-ring/50 focus-visible:ring-[2px] transition-all select-none",
  {
    variants: {
      variant: {
        default:
          "rounded-[6px] border border-[#ebebeb] bg-[#171717] text-white text-[11px] px-2 py-0.5 dark:bg-white dark:text-[#171717] dark:border-[#262626]",
        secondary:
          "rounded-[6px] border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] text-[11px] px-2 py-0.5 dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]",
        outline:
          "rounded-[6px] border border-[#ebebeb] bg-white text-[#171717] text-[11px] px-2 py-0.5 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed]",
        destructive:
          "rounded-[6px] border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] text-[11px] px-2 py-0.5 font-medium dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]",
        pill:
          "rounded-[100px] border border-[#ebebeb] bg-white text-[#171717] text-[11px] px-2.5 py-0.5 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed]",
        mono:
          "rounded-[6px] border border-[#ebebeb] bg-[#fafafa] font-mono text-[10px] text-[#4d4d4d] px-1.5 py-0.5 uppercase tracking-wider dark:border-[#262626] dark:bg-[#141414] dark:text-[#a1a1a1]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
