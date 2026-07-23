# Brief to script

Produce one project directory containing `script.json`.

## Required shape

```json
{
  "title": "One clear idea",
  "preset": "shorts",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "slides": [
    {
      "type": "cover",
      "title": "Hook",
      "subtitle": "Promise",
      "voice_text": "Hook narration."
    },
    {
      "type": "text",
      "text": "On-screen point",
      "voice_text": "Natural narration for that point."
    }
  ]
}
```

Use existing slide types: `cover`, `text`, `code`, `content`, `table`, `formula`, `transition`, or `numberHero`. Do not add a new composition for the canonical first success.

## Script rules

- Lead with one comprehensible hook; close with one result or next step.
- Keep on-screen text shorter than narration.
- Put narration in `voice_text` for every slide, including covers. The script-timed demo path uses it as the reviewed caption source.
- Make every number, date, attribution, and product behavior reviewable from the supplied source material.
- Avoid personal data, local absolute paths, tokens, account identifiers, private voices, and unlicensed media.
- Target 20–30 seconds for the canonical demo; measure the actual output rather than promising the estimate.
- Keep upload and platform-specific publishing copy outside `script.json`.
