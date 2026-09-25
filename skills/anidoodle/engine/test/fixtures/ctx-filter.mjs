export default { expected: "FAIL", meta: { fps: 4, durationFrames: 8 }, render: (frame) => { const ctx = {}; ctx.filter = "blur(1px)"; return frame; } };
