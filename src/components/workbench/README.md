# components/workbench/

> L2 | 父级: ../README.md

成员清单
common.jsx: 工作台共享常量、小型控件与 provider 文案映射。
header-nav.jsx: 顶部品牌区与导航按钮。
profile-panel.jsx: 左栏宝宝信息输入表单与生成/清空命令。
candidate-panel.jsx: 中栏空白、loading、候选列表、排序筛选与分页。
detail-panel.jsx: 右栏空白、loading、名字解析、指标条与对比卡片。

法则: 面板负责显示，name-workbench.jsx 负责状态机，二者不互相偷职责。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
