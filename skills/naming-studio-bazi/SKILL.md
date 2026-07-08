---
name: naming-studio-bazi
description: Run the eight-characters five-elements (八字五行) analysis for a Naming Studio request. Use when a naming plan step references naming-studio-bazi, or when a user provides a birth date/time and wants bazi-informed Chinese name candidates.
---

# Naming Studio Bazi

This skill turns a birth date/time into a verifiable five-elements profile that constrains name generation. Every step below is deterministic reasoning — no external API, no key. It is invoked as a plan step; `naming-studio-generate` owns writing results back to the GUI.

## Algorithm

### 1. 历法归一

- 输入为农历时先换算为公历（注意闰月：闰月按其所属正月计），时间按东八区北京时间处理。
- 若用户只给日期没给时间，仍排年、月、日三柱，时柱标注"未知"，后续强弱判断降低权重。

### 2. 排四柱

- 年柱：以**立春**为界，不以正月初一为界。立春前出生用上一年干支。
- 月柱：以**节气**（节，非中气）为界划分月份，月干由年干按五虎遁推出。
- 日柱：按干支纪日连续推算。
- 时柱：两小时一个时辰（23:00-00:59 为子时），时干由日干按五鼠遁推出。子时跨日按晚子时处理并注明。
- 出生时间落在节气交界 ±1 天时，在 analysis 中注明排盘存在不确定性。

### 3. 五行统计（加权，非简单计数）

- 天干每字直接计入其五行，权重 1.0。
- 地支按**藏干**加权计入：本气 0.6、中气 0.3、余气 0.1。这比只数地支本气更接近命局真实力量。
- 汇总为五行力量表，输出 `distribution` 时四舍五入为整数（合计约等于 8）。

### 4. 日主强弱

三者合参，不以单一维度定论：

- **得令**：月令五行是否生扶日主（权重最高）。
- **得地**：日主在四柱地支中是否有通根（本气根 > 中气根 > 余气根）。
- **得势**：天干中比劫、印绶的数量。

### 5. 喜用神推导

- 基线：**扶抑**——身弱者，喜生扶（印、比劫）；身强者，喜克泄耗（官杀、食伤、财）。
- **调候**优先修正：冬月（亥子丑）生者喜火暖局，夏月（巳午未）生者喜水润局，与扶抑冲突时调候优先。
- 两行相战时考虑**通关**之神。
- 明确输出：喜用神（1-2 个五行）、忌神，并一句话说明推导理由。

### 6. 用字五行判定

判定候选字的五行属性，优先级：**部首表意 > 字义 > 音韵**。

- 部首明确的直接定性：氵冫雨→水，木艹竹→木，火日灬→火，土山石→土，金钅玉→金。
- 部首不表五行的看字义：如"安"（宀+女，安定属土）、"知"（智慧属火/水依语境）。
- 一字多性时取主属性并在 analysis 中注明。避免民间"按笔画数五格剖象定五行"的做法——不采用五格剖象法。

### 7. 补益策略

- 双字名：首选"两字均为喜用神"或"一字喜用 + 一字通关"，忌神字直接排除。
- `elements` 回填每个候选字的五行；`complement` 与喜用神一致。
- metrics 第一项（八字五行，满分 25）按补益质量打分：两字皆喜用 22-25，一喜用一中性 18-21，仅一字喜用 14-17。

## Output

Feed these fields into each candidate for `save_naming_product_result`:

```json
{
  "elements": ["木", "火"],
  "distribution": [["木", 2], ["火", 2], ["土", 1], ["金", 0], ["水", 1]],
  "branches": [["年柱", "甲辰", ["木", "土"]], ["月柱", "己巳", ["土", "火"]], ["日柱", "己卯", ["土", "木"]], ["时柱", "己巳", ["土", "火"]]],
  "analysis": "日主X，生于X月，得令/失令，通根情况，喜用神为X（理由），此名以X补益。"
}
```

`branches` 四柱与 `distribution` 全部候选共享同一命盘；`elements` 与 `analysis` 逐候选给出。

## Constraints

If the request's plan says bazi is skipped (`useBazi: false`), do not run this skill at all — leave `elements` empty and `distribution`/`branches` null. Never fabricate a chart when the birth time is missing or implausible; state the limitation in `analysis` instead.
