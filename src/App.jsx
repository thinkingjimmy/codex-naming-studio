/**
 * - [INPUT]: 依赖 components/name-workbench.jsx 的 NameWorkbench 产品组件。
 * - [OUTPUT]: 对外提供 App 根组件。
 * - [POS]: src 的应用外壳，保持无业务分支，让工作台成为唯一产品表面。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { NameWorkbench } from "@/components/name-workbench.jsx";

export function App() {
  return <NameWorkbench />;
}
