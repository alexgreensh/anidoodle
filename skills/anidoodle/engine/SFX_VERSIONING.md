# Sound effect versions

Unversioned plans use the original shipped renderer for original kinds. For new plans, set `sfxVersion: 2` on the `SfxPlan` object in the example in `../references/music/sound-design.md`, or on a `renderSfx` call. A cue can override its plan version.

Version 2 selects physical models for toggle-on, toggle-off, whoosh-short, whoosh-long and impact. Click, pop, pop-in, dark-riser, cut-hit and sub-drop retain their original models. Notification defaults to `drop` and typing to `real`. The `bar` and `glass` notification variants and `mech`, `laptop` and `soft` typing variants remain available; `typing:old` selects the legacy key tick.

`legacy: true` selects the original renderer and `legacy: false` selects physical models where available. The `old` and `new` variants select the original and physical models for supported kinds.
