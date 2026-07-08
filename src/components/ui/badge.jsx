/**
 * - [INPUT]: 依赖 class-variance-authority 的 cva，依赖 lib/utils 的 cn。
 * - [OUTPUT]: 对外提供 Badge 组件。
 * - [POS]: ui 的小型状态表达组件，被五行、风险、评分状态复用。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-primary/12 text-primary",
      outline: "border border-border bg-card text-muted-foreground",
      gold: "bg-amber-100 text-amber-700",
      danger: "bg-red-50 text-red-700",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
