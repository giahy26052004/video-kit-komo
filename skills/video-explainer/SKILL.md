---
name: video-explainer
description: Turn a research brief or finished script into a reviewed, narrated, rendered, and verified vertical explainer video. Use when an agent must create a short 9:16 explainer, run a no-key local demo, enforce a pre-render review gate, diagnose the video toolchain, or verify a generated MP4 before any manual publication step.
---

# Video Explainer

Version note: v0.3.0-rc.1 / 2026-07-22 / Add the first guarded brief-to-video workflow with script-bound review receipts, a no-key demo path, and local verification. Keep upload, account access, credentials, private voice assets, and hosted rendering out of scope. Rollback: remove this skill and continue using the legacy scripts directly.

Produce a local video and evidence packet. Never upload or publish from this skill.

## Install

This Skill orchestrates a local clone of `claude-video-kit`; it does not bundle the renderer. From the repository root, install the runtime and register the Skill with:

```bash
npm ci --prefix remotion
npx skills add runesleo/claude-video-kit --skill video-explainer
```

For repository development, run commands from the repository root.

## Workflow

1. Run the read-only doctor before changing a project:

   ```bash
   node scripts/video-explainer.mjs doctor --output <output-directory>
   ```

   Read [setup-and-doctor.md](references/setup-and-doctor.md) when doctor blocks or the environment is new.

2. Convert the brief into `script.json`. Keep claims traceable, use supported slide types, and target 9:16. Read [brief-to-script.md](references/brief-to-script.md) for the input/output contract.

3. Require an independent review. Write `review-input.json`, then run:

   ```bash
   node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
   ```

   Read [review-gate.md](references/review-gate.md) for the six required checks. If any check is `fix` or `block`, revise and review again. Never render from that receipt.

4. Render only after a current pass receipt:

   ```bash
   node scripts/video-explainer.mjs render <project>
   ```

   On macOS, use `--demo-quality` only for a credential-free first success. It forces the built-in `say` voice and script-timed captions; label the result as demo-quality. Read [render-and-verify.md](references/render-and-verify.md) before running a custom project.

5. Verify the MP4 locally and report the video path, review receipt, verification result, elapsed time, and known limitations. Do not claim publication quality from the fallback voice.

## Canonical first success

Run the repository-owned neutral demo:

```bash
node scripts/video-explainer.mjs demo --output /tmp/video-explainer-first-success
```

The demo must create a current pass receipt before TTS, render locally without an API key on supported macOS, and run the shorts verifier. It must not read an account, upload media, or send the brief to a remote service.

## Stop conditions

- Stop before TTS/render when review is missing, stale, `fix`, or `block`.
- Stop when doctor reports a required runtime missing; give its exact action.
- Stop before any upload, public post, deploy, paid API call, credential setup, or account action and return that boundary to the user.
- Read [errors-and-privacy.md](references/errors-and-privacy.md) for recovery and data-handling rules.
