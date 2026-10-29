# three.js 0.170.0 (vendored)

- `three.module.js`: `build/three.module.js` from the npm tarball `three@0.170.0` (sha512 matched npm's published integrity). sha256 `ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb`.
- `types/`: `src/**/*.d.ts` from `@types/three@0.170.0` (sha512 `CUm2uckq...QFAyg==` matched). Type declarations only, no runtime code. sha256 of all .d.ts in path order: `0f922d42e410315f052b7360dc3ce60a24b13003c88aa41f82102659c3c98570`.
- Licence: MIT (`LICENSE`, three.js authors; @types/three is MIT too).
- Security: scanned with repo-forensics 2.14.19 (30 scanners, coverage COMPLETE) on 2026-10-28. 0 block, 0 critical. All 60 warnings adjudicated benign: 54 are doc comments ("Create a new instance of ..."), the rest are a GitHub URL and `////` rule lines read as base64, and `lists.get( scene )` read as an AWS key. No eval, no new Function. The loaders that fetch are never called: anidoodle pages have no network.
- The installed plugin leaves `three.module.js` and `types/` out (plugin directories hold files over 256 KiB and plugins over 512 files). There `package.json` pins `three` 0.170.0 exactly and `npm install` brings the same file; `tools/overlay.mjs` refuses any three.js whose sha256 is not the one above, and `three-untyped.d.ts` lets films type-check without the types.
- Nothing else from the package is used. Upgrading means a new scan and new hashes here and in `tools/overlay.mjs` (`THREE_SHA256`); `test/threePin.test.ts` checks it.
