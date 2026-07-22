# Changelog

All notable local release-candidate changes are recorded here. A version entry does not imply that a tag, GitHub Release, or package publication exists.

## 0.3.0-rc.1 — 2026-07-22

- Add the installable `video-explainer` Agent Skill with progressive setup, scripting, review, render, verification, error, and privacy references.
- Add a read-only doctor and neutral no-key macOS first-success demo.
- Let doctor validate a not-yet-created output path through its nearest writable parent without creating files.
- Bind review receipts to the exact `script.json`; independent `fix` and `block` receipts cannot start rendering.
- Add script-timed caption alignment for the demo path so first success does not require a Whisper download.
- Verify generated scene rhythm from duration-matched render metadata, while retaining visual detection for standalone videos.
- Preserve spaces in wrapped Latin captions and remove the duplicate code-slide caption layer.
- Add root tests, static checks, bilingual activation docs, and a minimal CI candidate.

Known release boundary: this is a local candidate only. Push, tag, GitHub Release, and public promotion require separate approval.
