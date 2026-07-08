/**
 * - [INPUT]: 依赖 clsx 的条件 className 拼接，依赖 tailwind-merge 的冲突消解。
 * - [OUTPUT]: 对外提供 cn(...inputs) 工具函数。
 * - [POS]: lib 的样式基础设施，被 shadcn 风格组件消费，避免重复拼接逻辑。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
