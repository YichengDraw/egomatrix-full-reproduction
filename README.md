# EgoMatrix — Independent Full-Pipeline Reproduction

Research presentation mirror of the independently reproduced EgoMatrix pipeline, including saved reconstruction results, real IsaacLab physics rollouts, HACO contact diagnostics, and traceable evaluation reports.

**[Open the interactive website](https://yichengdraw.github.io/egomatrix-full-reproduction/)**

## Three complete frozen robot demonstrations

| Task | Source RGB | Actual recorded controller steps | Website clip |
|---|---:|---:|---|
| Stir (spoon/bowl) | 249 frames at 30Hz | 497 at 60Hz | SVOR-cleaned RGB composite + native paired robot/object render |
| Cut (knife/board) | 200 frames at 30Hz | 399 at 60Hz | Actual IsaacLab link/object state replay, with original RGB inset |
| Brush | 209 frames at 30Hz | 417 at 60Hz | Actual IsaacLab link/object state replay, with original RGB inset |

**All three complete tasks failed the joint success criterion.** These videos show actual saved physical states, not success or open-loop retargeting targets. Cut/brush use camera-calibrated native physical replay without re-running simulation, training PPO, or reading GT. Unlike Stir, they do not reuse an SVOR background; their original RGB appears as a picture-in-picture. This distinction is labeled on the video and in the viewer.

### Where to watch

Use the **“原视频、重建与物理执行”** section in the main website; select the task and switch to the video physical view. Both the saved trajectory and task success curves remain accessible.

The **[HACO contact comparison](https://yichengdraw.github.io/egomatrix-full-reproduction/haco-contact.html)** shows raw per-vertex HACO probabilities, A2→A3 geometric proximity, independent TACO hand/object geometry and an interactive 3D MANO contact map. Geometric proximity is not confirmed physical contact; penetration and task success are reported separately.

## Data and reproduction integrity

This repository contains **only static browser assets**, not private training data, GT source archives, checkpoints, API keys, or SSH credentials. Metrics are derived from frozen simulation traces and evaluation records. The source adaptation and offline render scripts reside in the user's original local research workspace, separate from this public mirror.

Original paper: https://arxiv.org/html/2610.18822v1 — named authors' project https://spikew726.github.io/EgoMatrix/. The anonymous code candidate's authorship remains unconfirmed. This site is **not an official author release**.

Deployment: GitHub Pages, branch `main`, directory `/`. A `.nojekyll` file preserves binary and other assets.

Updated 2026-10-28.

## Native-quality reconstruction stages (2026-10-29)

The original five-column source videos are 4800×580, each stage 960×580. Earlier web exports downscaled the entire montage to 1920×232 (only 384×232 per stage), then enlarged each selected stage, making it noticeably blurry.

The site now **loads a separate original-resolution 960×580 video** when you select A1, Scene, A2 or A3 for Stir, Cut or Brush. The complete five-column overview is preserved as the lightweight historical overview. Each selected stage has a direct MP4 download link. The 12 videos are 30 fps with full native frame coverage and H.264 CRF17 encoding. No super-resolution, frame interpolation, GT feedback or reconstruction change was introduced.

Evidence and exact source-panel mapping: [HD video manifest](media/hd_stages/manifest.json).
