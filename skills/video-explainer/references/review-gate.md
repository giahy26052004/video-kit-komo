# Review gate

Use a reviewer distinct from the script author. Review the exact bytes of `script.json` that will render.

Create `review-input.json` with all six checks:

```json
{
  "author": "writer-agent",
  "reviewer": "independent-reviewer",
  "checks": {
    "facts": { "status": "pass", "notes": "Sources support every factual claim." },
    "structure": { "status": "pass", "notes": "Hook, explanation, and close are coherent." },
    "duration": { "status": "pass", "notes": "Narration fits the target duration." },
    "visual_feasibility": { "status": "pass", "notes": "Every slide maps to an existing composition." },
    "privacy": { "status": "pass", "notes": "No private or identifying material." },
    "copyright": { "status": "pass", "notes": "All media and copy are owned or permitted." }
  }
}
```

Each status must be `pass`, `fix`, or `block`. The aggregate receipt takes the worst status. The command binds the receipt to the current script SHA-256:

```bash
node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
```

Any script edit makes the receipt stale. Re-run independent review after edits. Do not manually alter `review-result.json` to bypass the gate.
