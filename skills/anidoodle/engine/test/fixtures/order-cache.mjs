export default { expected: "FAIL", meta: { fps: 4, durationFrames: 8 }, render: (frame, cache) => { if (!cache.has("first")) cache.set("first", frame); return `${frame}:${cache.get("first")}`; } };
