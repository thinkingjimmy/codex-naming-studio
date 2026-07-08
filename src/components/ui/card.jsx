/**
 * - [INPUT]: 依赖 react 的 forwardRef，依赖 lib/utils 的 cn。
 * - [OUTPUT]: 对外提供 Card、CardHeader、CardTitle、CardContent 组件。
 * - [POS]: ui 的容器基础件，统一细边框、圆角与白色面板背景。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { cn } from "@/lib/utils.js";

export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <section
    ref={ref}
    className={cn("rounded-lg border border-border bg-card text-card-foreground", className)}
    {...props}
  />
));

Card.displayName = "Card";

export const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-between gap-3 p-4", className)} {...props} />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-sm font-semibold tracking-tight", className)} {...props} />
));

CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));

CardContent.displayName = "CardContent";
