/**
 * - [INPUT]: 依赖 lucide-react 导航图标。
 * - [OUTPUT]: 对外提供 HeaderNav 顶部品牌与工具导航组件。
 * - [POS]: components/workbench 的页面头部，独立于生成状态机。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { HelpCircle, History, Settings, Star, Sunrise } from "lucide-react";

export function HeaderNav() {
  const links = [
    [HelpCircle, "使用指南"],
    [Star, "我的收藏"],
    [History, "历史记录"],
    [Settings, "设置"],
  ];

  return (
    <header className="border-b border-border/80 bg-card/82 backdrop-blur">
      <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-lg bg-amber-100 text-amber-600">
            <Sunrise className="h-9 w-9" strokeWidth={1.8} />
          </div>
          <div className="flex items-end gap-4">
            <h1 className="font-serif text-4xl font-semibold leading-none tracking-normal text-stone-800">沐阳起名</h1>
            <div className="hidden border-l border-border pl-4 text-sm leading-6 text-muted-foreground sm:block">
              <p className="font-medium text-stone-700">新生儿智能起名</p>
              <p>沐光而生，向阳而名</p>
            </div>
          </div>
        </div>
        <nav className="hidden items-center gap-5 text-sm text-stone-600 lg:flex">
          {links.map(([Icon, label]) => (
            <button key={label} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary">
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
