/**
 * - [INPUT]: 依赖 @radix-ui/react-slot 的 Slot，依赖 class-variance-authority 的 cva，依赖 lib/utils 的 cn。
 * - [OUTPUT]: 对外提供 Button 组件与 buttonVariants。
 * - [POS]: ui 的命令按钮基础件，被工作台所有主要操作复用。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils.js";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline: "border border-border bg-card text-foreground shadow-paper hover:bg-secondary/60",
        ghost: "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
        gold: "bg-amber-500 text-white hover:bg-amber-600",
      },
      size: {
        default: "h-8 px-3.5",
        sm: "h-7 px-2.5 text-xs",
        icon: "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";
