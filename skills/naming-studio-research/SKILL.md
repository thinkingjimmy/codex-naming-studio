---
name: naming-studio-research
description: Research external facts for a Naming Studio request. Use when a naming plan step references naming-studio-research, or when candidate names must avoid currently popular Chinese baby names or be audited for negative Mandarin homophones.
---

# Naming Studio Research

This skill gathers facts that Codex cannot know reliably without looking: current name popularity and real-world homophone associations. It is always invoked as a step inside a naming request; it never writes to the GUI itself — `naming-studio-generate` owns `save_naming_product_result`.

## Topic: popular-names

Triggered by the GUI filter 避开热门名字.

1. Web-search recent rankings of popular Chinese newborn names (e.g. 公安部全国姓名报告、近三年新生儿爆款名字榜单).
2. Compile a blocklist of the top given names (both 双字 and 单字 forms).
3. Return the blocklist to the calling flow. Candidate names must not match any entry, and near-misses (same characters reordered, same pinyin with identical tones) should be flagged.

## Topic: mandarin-homophone

Triggered by the GUI filter 避开普通话谐音.

1. For each candidate full name (surname + given), enumerate its pinyin and tone sequence.
2. Check for negative homophones, mocking nicknames, brand or slang collisions. Search the web when uncertain — playground nicknames evolve faster than training data.
3. Reject or replace any candidate with a plausible negative association; note the reason.

## Constraints

Findings feed the generation step of the same request. Keep research concise: one search pass per topic, summarize into actionable lists, no long reports in chat. Do not ask for API keys; use built-in web search capability only.
