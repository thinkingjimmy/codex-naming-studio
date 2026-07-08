/**
 * - [INPUT]: 依赖 react 的 forwardRef，依赖 lib/utils 的 cn。
 * - [OUTPUT]: 对外提供 Select 组件。
 * - [POS]: ui 的原生下拉基础件，让筛选和地区选择共享同一外观。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { cn } from "@/lib/utils.js";

export const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-8 rounded-md border border-input bg-card px-2 text-[13px] shadow-paper outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));

Select.displayName = "Select";
