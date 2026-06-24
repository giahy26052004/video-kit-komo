# Upgrade note · 2026-05-26

**状态：DEFERRED** — 2026-05-26 决策：等下一条长版视频走完 dogfood、发布和复盘后，再同步本仓库。

**触发条件**：长版视频 `out/main.mp4` render + 多平台发布 + `stats_snapshots` 完成。

**任务记录**：production tracker + `GOAL-v2-longform.md` §发布后 kit 同步

---

**结论（待发片后再做）**：增量升级即可（文档 + 未 commit 脚本 + 可选 slide-review 同步；HyperFrames 编排已有生产版本）。

---

## 先澄清：HyperFrames 编排更新在哪

| 层级 | 位置 | 状态 |
|------|------|------|
| **HyperFrames 编排**（`script.json` → `index.html` · 横版 CSS · GSAP timeline · captions） | **production long-form workspace `scripts/script-to-html.mjs`** | ✅ **已更新**（5/14–5/16 长版交付 · `CHANGELOG-2026-05-16-longform-delivered.md`） |
| 端到端调度（review · TTS · render · BGM · distribute） | **production long-form workspace `daily.sh`** | ✅ 已更新（含 `_meta.format=long-form` · CosyVoice 分支） |
| HyperFrames 上游 / 实验 | **`claude-video-kit/experiments/hyperframes/upstream/`** | ✅ 有 vendor mirror（hyperframes v0.4.4 · skills/registry） |
| HyperFrames 集成实验 BRIEF | `experiments/hyperframes/BRIEF.md` | ✅ 2026-04-26 |

**编排位置**：生产 SSOT 在 long-form workspace；kit 公开 Remotion shorts + 共用 TTS/align/distribute。

之前 note 写「HyperFrames 编排尚未跟上」**容易误解**——应读成：**`script-to-html` 未 copy 进开源 repo**；生产编排已经更新。

---

## kit 现状（`git status` @ feature/tts-skip-videoclip）

**已在 main 历史里：**

- Remotion shorts 管线 · `docs/SHORTS_PIPELINE.md`
- `scripts/align.py` · distribute / metadata
- `experiments/hyperframes/`（upstream + BRIEF）

**本地有、未 commit / 新写：**

- `scripts/tts_cosyvoice.py`
- `scripts/gen_video_cover.py`
- `docs/LONGFORM_HYPERFRAMES_PIPELINE.md`
- 本文件

**在 production long-form workflow 中固化：**

- slide-review 逐镜验收（build / server / approval）
- `build-shot-sheet.mjs` preview 双播修复 · ffprobe 时间窗
- long-form 口播字数闸门（<3000 hard_fail）
- `SSOT-LONG-FORM-REVIEW.md` 验收 SSOT

---

## 可考虑升级什么（轻量）

1. commit `tts_cosyvoice.py` + `gen_video_cover.py`
2. 文档指向 production long-form workspace 的 `script-to-html` / CHANGELOG-2026-05-16
3. （可选）抽 slide-review 三件套进 kit，或链到 production SSOT
4. （可选）`examples/` 加一个 anonymized long-form project 骨架

**当前状态**：长版视频和付费视频继续用 production long-form workflow。
