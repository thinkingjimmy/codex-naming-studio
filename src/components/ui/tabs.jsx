/**
 * - [INPUT]: 依赖 lib/utils 的 cn。
 * - [OUTPUT]: 对外提供 TabsList、TabsTrigger、TabsContent 组件。
 * - [POS]: ui 的可控标签页基础件，用于名字解析维度切换。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { cn } from "@/lib/utils.js";

export function TabsList({ className, ...props }) {
  return <div className={cn("flex flex-nowrap gap-0 border-b border-border px-3", className)} {...props} />;
}

export function TabsTrigger({ active, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "h-8 flex-1 rounded-t-md px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
        active && "bg-primary text-primary-foreground shadow-inset hover:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ active, className, ...props }) {
  if (!active) return null;
  return <div className={cn("animate-soft-rise", className)} {...props} />;
}
