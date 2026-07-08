/**
 * - [INPUT]: 依赖 react 的 forwardRef，依赖 lib/utils 的 cn。
 * - [OUTPUT]: 对外提供 Label 组件。
 * - [POS]: ui 的表单标签基础件，统一字段说明的视觉层级。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { cn } from "@/lib/utils.js";

export const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-[13px] font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));

Label.displayName = "Label";
