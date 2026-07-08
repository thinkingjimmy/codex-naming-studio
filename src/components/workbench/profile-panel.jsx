/**
 * - [INPUT]: 依赖 ui 表单组件、lucide-react 图标与 workbench/common 的共享控件。
 * - [OUTPUT]: 对外提供 ProfilePanel 宝宝信息输入栏。
 * - [POS]: components/workbench 的输入面板，只负责采集约束并触发清空/生成命令。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { Baby, Calendar, Clock, Eraser, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select } from "@/components/ui/select.jsx";
import { cn } from "@/lib/utils.js";
import { Field, FilterCheck, Segment, SliderRow, genderOptions, updateNested } from "./common.jsx";

export function ProfilePanel({ profile, setProfile, onClear, onGenerate, isGenerating }) {
  const setValue = (key, value) => setProfile((current) => updateNested(current, key, value));
  const setTone = (key, value) => setProfile((current) => ({ ...current, tones: updateNested(current.tones, key, value) }));
  const setFilter = (key, value) => setProfile((current) => ({ ...current, filters: updateNested(current.filters, key, value) }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Baby className="h-5 w-5 text-amber-500" />
          宝宝信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="姓氏">
          <Input value={profile.surname} onChange={(event) => setValue("surname", event.target.value.slice(0, 2))} />
        </Field>
        <Field label="性别倾向">
          <Segment value={profile.gender} options={genderOptions} onChange={(value) => setValue("gender", value)} />
        </Field>
        <Field label="出生时间">
          <div className="mb-2 grid grid-cols-2 gap-3">
            <Button type="button" variant={profile.calendar === "solar" ? "default" : "outline"} onClick={() => setValue("calendar", "solar")}>
              公历
            </Button>
            <Button type="button" variant={profile.calendar === "lunar" ? "default" : "outline"} onClick={() => setValue("calendar", "lunar")}>
              农历
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Input type="date" value={profile.birthDate} onChange={(event) => setValue("birthDate", event.target.value)} />
              <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <div className="relative">
              <Input type="time" value={profile.birthTime} onChange={(event) => setValue("birthTime", event.target.value)} />
              <Clock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">甲辰年 四月十三 巳时</p>
        </Field>
        <Field label="出生地">
          <div className="grid grid-cols-3 gap-3">
            <Select value={profile.province} onChange={(event) => setValue("province", event.target.value)}>
              <option>浙江省</option>
              <option>江苏省</option>
              <option>广东省</option>
            </Select>
            <Select value={profile.city} onChange={(event) => setValue("city", event.target.value)}>
              <option>杭州市</option>
              <option>苏州市</option>
              <option>广州市</option>
            </Select>
            <Select value={profile.district} onChange={(event) => setValue("district", event.target.value)}>
              <option>西湖区</option>
              <option>上城区</option>
              <option>滨江区</option>
            </Select>
          </div>
        </Field>
        <Field label="名字字数">
          <div className="grid grid-cols-2 rounded-md border border-border bg-white/70 p-1">
            {[
              ["double", "双字名"],
              ["single", "三字名"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setValue("nameLength", id)}
                className={cn("h-8 rounded-sm text-sm", profile.nameLength === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
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
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" type="button">
              <RefreshCw className="h-3.5 w-3.5" />
              重置
            </button>
          </div>
          <SliderRow label="古典文雅" value={profile.tones.classic} suffix="较强" onChange={(value) => setTone("classic", value)} />
          <SliderRow label="温润平和" value={profile.tones.gentle} suffix="强" onChange={(value) => setTone("gentle", value)} />
          <SliderRow label="明朗大气" value={profile.tones.bright} suffix="中等" onChange={(value) => setTone("bright", value)} />
          <SliderRow label="诗词典故" value={profile.tones.poetic} suffix="较强" onChange={(value) => setTone("poetic", value)} />
          <SliderRow label="现代简约" value={profile.tones.modern} suffix="中等" onChange={(value) => setTone("modern", value)} />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            更多筛选
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <FilterCheck checked={profile.filters.rare} label="避开生僻字" onChange={(value) => setFilter("rare", value)} />
            <FilterCheck checked={profile.filters.polyphone} label="避开多音字" onChange={(value) => setFilter("polyphone", value)} />
            <FilterCheck checked={profile.filters.unclear} label="避开拼音不准" onChange={(value) => setFilter("unclear", value)} />
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
            <Sparkles className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            {isGenerating ? "生成中" : "生成好名"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
