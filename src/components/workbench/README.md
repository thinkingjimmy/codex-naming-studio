# components/workbench/

> L2 | 父级: ../README.md

成员清单
common.jsx: 工作台共享常量、小型控件（Segment/ElementPill/RiskDot/SliderRow/FilterCheck）与 provider 文案映射。
profile-panel.jsx: 左栏宝宝信息输入表单，全高列布局，表单滚动 + 生成/清空操作区吸底。
candidate-panel.jsx: 中栏空白、loading、等待接管、扫描表候选列表，吸顶工具条承载排序筛选换批，底部分页，显示 pending request id 与批次。
detail-panel.jsx: 右栏空白、loading 与当前名字全维度解析，评分构成、八字、音律、字形、寓意、典故、避讳纵向铺开，无 tab。

法则: 面板负责显示，name-workbench.jsx 负责状态机，二者不互相偷职责。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
