// The installed plugin leaves out three.js's 500 type files (plugin directories cap a plugin at 512 files).
// tsconfig falls back to this file when vendor/three/types is absent: "three" type-checks as untyped there.
// The repository keeps the full types, so the engine's own code is always checked against them.
declare const THREE: any;
export = THREE;
