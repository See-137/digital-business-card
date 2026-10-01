# Generated assets

## portal-loop.mp4
Pre-rendered loop of the 3D portal, played only where the live 3D can't animate (see `CLAUDE.md`, "Fallback loop").

- **Seed:** a GPU render of this page's own portal (`?t=4.2`, overlays hidden, centre square of the stage, 1132x1132), used as both the start and end frame so the clip loops.
- **Generator:** Higgsfield, Kling v3.0 `pro`, 10 s, 1:1, sound off. Job `160bf17d-bc31-4e21-bc52-6e58d372d992`, 2026-10-01, 17.5 credits.
- **Prompt:** "Locked-off static camera, no camera movement, no zoom. A glowing green interdimensional portal vortex swirls slowly and continuously clockwise in deep space; its luminous green ribbons ripple and churn, the inner particles spiral gently inward, and the background star motes drift and twinkle softly. The bright lime emitter on the left edge and its pale beam stay fixed in place, pulsing faintly. Smooth, hypnotic, seamless ambient loop; same lighting and colors throughout; no new objects, no text, no flashes, no cuts."
- **Measured on the raw clip:** 1440x1440, 24 fps, 10.04 s. Loop seam check (`web-media.py seam`, 180 px greyscale): last to first frame is 5.94, against frame-to-frame mean 5.87 / max 6.67, so it is seamless and there is no crossfade. Shipped encode: 6.45 against mean 5.89 / max 6.79, still within normal motion.
- **Encode:** `web-media.py loop raw.mp4 portal-loop.mp4 --height 720 --crf 28 --max-kbps 1200` (H.264 High, yuv420p, no audio, faststart). 720x720, 1.10 MB, SSIM 0.974 vs the raw clip.
