// A font file imported by path (tools/overlay.mjs inlines it): import serif from "../../assets/fonts/X.ttf"
declare module "*.ttf" { const f: { path: string; format: "ttf" | "otf" | "woff2"; data: string }; export default f; }
declare module "*.otf" { const f: { path: string; format: "ttf" | "otf" | "woff2"; data: string }; export default f; }
declare module "*.woff2" { const f: { path: string; format: "ttf" | "otf" | "woff2"; data: string }; export default f; }
