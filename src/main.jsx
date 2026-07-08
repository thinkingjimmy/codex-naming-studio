/**
 * - [INPUT]: 依赖 react-dom/client 的 createRoot，依赖 App.jsx 的 App 组件，依赖 styles.css 的全局样式。
 * - [OUTPUT]: 对 index.html#root 挂载完整起名应用。
 * - [POS]: src 的启动入口，只负责渲染根组件，不承载业务状态。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
