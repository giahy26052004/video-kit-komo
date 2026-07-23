# Render and verify

## Render

For an already configured local environment:

```bash
node scripts/video-explainer.mjs render <project>
```

For a credential-free macOS proof only:

```bash
node scripts/video-explainer.mjs render <project> --demo-quality
```

`--demo-quality` clears Fish Audio variables for the child process, uses macOS `say`, and aligns captions from reviewed script text without loading Whisper. It is not a production voice path.

## Verify

Run:

```bash
node scripts/verify-shorts.mjs <project>/out/full.mp4 \
  --metadata <project>/metadata.json
```

For generated videos, the duration-matched render schedule is the authoritative scene source; this avoids treating dark programmatic transitions as static frames. Without `--metadata`, the verifier falls back to visual scene detection. Both paths measure the opening and every scene interval, including the first and last.

Require a 1080×1920 canvas, no more than 60 seconds, an average scene interval of no more than 3 seconds, and a scene change in the first 2 seconds. Report soft warnings separately from hard failures.

The canonical `demo` command runs review, render, and verification in order and writes `video-explainer-result.json`. Treat that result as local evidence, not as publication approval.
