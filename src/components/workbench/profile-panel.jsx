/**
 * - [INPUT]: 依赖 react 组合输入状态、ui 表单组件、@phosphor-icons/react 图标、name-engine 的 DEFAULT_PROFILE/NAME_LENGTH_OPTIONS 与 workbench/common 的共享控件。
 * - [OUTPUT]: 对外提供 ProfilePanel 宝宝信息输入栏。
 * - [POS]: components/workbench 的输入面板，只负责采集约束并触发清空/生成命令。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { ArrowClockwise, Baby, CalendarBlank, Clock, Eraser, SlidersHorizontal, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { DEFAULT_PROFILE, NAME_LENGTH_OPTIONS } from "@/lib/name-engine.js";
import { cn } from "@/lib/utils.js";
import { Field, FilterCheck, Segment, SliderRow, genderOptions } from "./common.jsx";

const dateTimeInputClass = "native-picker-input";

export function ProfilePanel({ profile, setProfile, onClear, onGenerate, isGenerating }) {
  const setValue = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const setTone = (key, value) => setProfile((current) => ({ ...current, tones: { ...current.tones, [key]: value } }));
  const setFilter = (key, value) => setProfile((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
  const resetTones = () => setProfile((current) => ({ ...current, tones: { ...DEFAULT_PROFILE.tones } }));
  const [surnameDraft, setSurnameDraft] = React.useState(profile.surname || "");
  const isComposingSurname = React.useRef(false);

  const normalizeSurname = (value) => Array.from(value.trim()).slice(0, 2).join("");
  const commitSurname = (value) => {
    const normalized = normalizeSurname(value);
    setSurnameDraft(normalized);
    setValue("surname", normalized);
  };

  React.useEffect(() => {
    if (!isComposingSurname.current) setSurnameDraft(profile.surname || "");
  }, [profile.surname]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Baby weight="duotone" className="h-5 w-5 text-amber-500" />
          宝宝信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="姓氏">
          <Input
            value={surnameDraft}
            onBlur={(event) => {
              if (!isComposingSurname.current) commitSurname(event.currentTarget.value);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSurnameDraft(nextValue);
              if (!isComposingSurname.current) commitSurname(nextValue);
            }}
            onCompositionStart={() => {
              isComposingSurname.current = true;
            }}
            onCompositionEnd={(event) => {
              isComposingSurname.current = false;
              commitSurname(event.currentTarget.value);
            }}
          />
        </Field>
        <Field label="性别倾向">
          <Segment value={profile.gender} options={genderOptions} onChange={(value) => setValue("gender", value)} />
        </Field>
        <Field label="出生时间" hint="用于八字五行测算">
          <FilterCheck checked={profile.useBazi} label="按出生时间测算八字五行" onChange={(value) => setValue("useBazi", value)} />
          {profile.useBazi ? (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant={profile.calendar === "solar" ? "default" : "outline"} onClick={() => setValue("calendar", "solar")}>
                  公历
                </Button>
                <Button type="button" variant={profile.calendar === "lunar" ? "default" : "outline"} onClick={() => setValue("calendar", "lunar")}>
                  农历
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Input className={dateTimeInputClass} type="date" value={profile.birthDate} onChange={(event) => setValue("birthDate", event.target.value)} />
                  <CalendarBlank className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="relative">
                  <Input className={dateTimeInputClass} type="time" value={profile.birthTime} onChange={(event) => setValue("birthTime", event.target.value)} />
                  <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">未勾选时不排八字，评分由音律、字形与寓意维度构成。</p>
          )}
        </Field>
        <Field label="名字字数">
          <div className="grid grid-cols-2 rounded-md border border-border bg-white/70 p-1">
            {NAME_LENGTH_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue("fullNameLength", value)}
                className={cn(
                  "h-8 rounded-sm text-sm",
                  profile.fullNameLength === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="辈分字（可选）" hint={`${profile.preferredChars.length}/1`}>
          <Input placeholder="如：家、文、志" value={profile.preferredChars} onChange={(event) => setValue("preferredChars", event.target.value.slice(0, 10))} />
        </Field>
        <Field label="避讳的字（可多选）" hint={`${profile.blockedChars.length}/10`}>
          <Input placeholder="如：伟、强、丽" value={profile.blockedChars} onChange={(event) => setValue("blockedChars", event.target.value.slice(0, 10))} />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>风格偏好</Label>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" type="button" onClick={resetTones}>
              <ArrowClockwise className="h-3.5 w-3.5" />
              重置
            </button>
          </div>
          <SliderRow label="古典文雅" value={profile.tones.classic} onChange={(value) => setTone("classic", value)} />
          <SliderRow label="温润平和" value={profile.tones.gentle} onChange={(value) => setTone("gentle", value)} />
          <SliderRow label="明朗大气" value={profile.tones.bright} onChange={(value) => setTone("bright", value)} />
          <SliderRow label="诗词典故" value={profile.tones.poetic} onChange={(value) => setTone("poetic", value)} />
          <SliderRow label="现代简约" value={profile.tones.modern} onChange={(value) => setTone("modern", value)} />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            更多筛选
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FilterCheck checked={profile.filters.rare} label="避开生僻字" onChange={(value) => setFilter("rare", value)} />
            <FilterCheck checked={profile.filters.polyphone} label="避开多音字" onChange={(value) => setFilter("polyphone", value)} />
            <FilterCheck checked={profile.filters.unclear} label="避开拼音不准" onChange={(value) => setFilter("unclear", value)} />
            <FilterCheck checked={profile.filters.mandarinHomophone} label="避开普通话谐音" onChange={(value) => setFilter("mandarinHomophone", value)} />
            <FilterCheck checked={profile.filters.popularName} label="避开热门名字" onChange={(value) => setFilter("popularName", value)} />
            <FilterCheck checked={profile.filters.strokes} label="笔画不宜过多" onChange={(value) => setFilter("strokes", value)} />
            <FilterCheck checked={profile.filters.highScore} label="仅看高分名字" onChange={(value) => setFilter("highScore", value)} />
          </div>
        </div>
        <div className="grid grid-cols-[0.9fr_1.4fr] gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onClear} disabled={isGenerating}>
            <Eraser className="h-4 w-4" />
            清空
          </Button>
          <Button type="button" onClick={onGenerate} disabled={isGenerating}>
            <Sparkle weight="duotone" className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            {isGenerating ? "生成中" : "生成好名"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
