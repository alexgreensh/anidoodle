// MIRA'S PALETTE ROLES, mapped per hand. A role is fixed for the character ("coat" is her
// raincoat yellow); each hand decides how that role is MADE in its medium. The gate
// (tools/character-check.mjs) holds every mapping to the role's hue family.
import type { Palette } from "../../character/render/storybook";

// storybook pencil + watercolour: transparent washes, shadow colour cooler than the lit colour
export const MIRA_STORYBOOK: Palette = {
  skin: { base: "#f7d5bb", shade: "#e3a98e" }, nail: { base: "#fde8da", shade: "#f0c9b4" }, hair: { base: "#7b4630", shade: "#51291a" }, coat: { base: "#f6d04d", shade: "#dca63a" },
  tights: { base: "#415182", shade: "#2c375d" }, boots: { base: "#4ea79d", shade: "#347c75" }, satchel: { base: "#bb7a4b", shade: "#8b5431" },
  satchelDark: { base: "#9a5f37", shade: "#744424" }, glasses: { base: "#d8443a", shade: "#a52f28" }, toggle: { base: "#9c6436", shade: "#744424" },
  buckle: { base: "#e0b955", shade: "#b08a34" }, metal: { base: "#b9c2cb", shade: "#7f8a96" }, pupil: { base: "#3d3437", shade: "#2a2326" },
  white: { base: "#fffaf3", shade: "#e8e0d4" }, blush: { base: "#f2899c", shade: "#d9687d" }, mouth: { base: "#8c3b3b", shade: "#6b2929" }, lip: { base: "#e98a8f", shade: "#c96a70" },
};
// marker comic: saturated cel flats, a hard shadow a clear step darker
export const MIRA_MARKER: Palette = {
  skin: { base: "#ffd8b8", shade: "#f0a987" }, nail: { base: "#ffeadc", shade: "#f5c3a6" }, hair: { base: "#8a4127", shade: "#4f2012" }, coat: { base: "#ffd21f", shade: "#f0a100" },
  tights: { base: "#2f3f86", shade: "#1b2456" }, boots: { base: "#10a99a", shade: "#067268" }, satchel: { base: "#c7773f", shade: "#8e4a20" },
  satchelDark: { base: "#94501f", shade: "#6d3812" }, glasses: { base: "#ee3524", shade: "#b0170c" }, toggle: { base: "#8e4a20", shade: "#6d3812" },
  buckle: { base: "#ffc933", shade: "#d49a00" }, metal: { base: "#c5d0da", shade: "#7d8b99" }, pupil: { base: "#15122a", shade: "#15122a" },
  white: { base: "#ffffff", shade: "#dfe6ee" }, blush: { base: "#ff7b93", shade: "#e2566f" }, mouth: { base: "#7a1f2a", shade: "#5a1119" }, lip: { base: "#ff7b87", shade: "#d9535f" },
};
// risograph: a role is a RECIPE of drums (ink, tone 0..1) that overprint by multiply. Yellow is
// the coat; pink + yellow is skin; blue + pink + yellow at depth is the hair.
import type { RisoRecipe } from "../../character/render/riso";
export const MIRA_RISO: Record<string, RisoRecipe> = {
  skin: { inks: [["pink", 0.2], ["yellow", 0.28]], shadeInk: "pink", shadeTone: 0.45 }, nail: { inks: [["pink", 0.1]] },
  hair: { inks: [["pink", 0.85], ["yellow", 0.7], ["blue", 0.55]], shadeInk: "blue", shadeTone: 0.4 },
  coat: { inks: [["yellow", 1]], shadeInk: "pink", shadeTone: 0.42 },
  tights: { inks: [["blue", 0.95], ["pink", 0.5]], shadeInk: "blue", shadeTone: 0.5 },
  boots: { inks: [["blue", 0.78], ["yellow", 0.24]], shadeInk: "blue", shadeTone: 0.45 },
  satchel: { inks: [["pink", 0.55], ["yellow", 0.85], ["blue", 0.18]], shadeInk: "pink", shadeTone: 0.5 },
  satchelDark: { inks: [["pink", 0.75], ["yellow", 0.9], ["blue", 0.35]] },
  glasses: { inks: [["pink", 1], ["yellow", 0.8]] }, toggle: { inks: [["pink", 0.7], ["yellow", 0.9], ["blue", 0.3]] },
  buckle: { inks: [["yellow", 1], ["pink", 0.2]] }, metal: { inks: [["blue", 0.35]] }, pupil: { inks: [["blue", 1], ["pink", 0.6]] },
  white: { inks: [] }, blush: { inks: [["pink", 0.55]] }, mouth: { inks: [["pink", 0.9], ["blue", 0.6]] }, lip: { inks: [["pink", 0.7]] },
};

// ukiyo-e woodblock: mineral and vegetable pigments (gamboge, safflower, Prussian blue, sumi)
export const MIRA_WOODCUT: Record<string, string> = {
  skin: "#f3dcc2", nail: "#f6e4d0", hair: "#5a3322", coat: "#e9b73a", tights: "#2f4f86", boots: "#3e8a82", satchel: "#a66b3c", satchelDark: "#7e4a26",
  glasses: "#cf3b2a", toggle: "#7e4a26", buckle: "#d9b04a", metal: "#9aa6ad", white: "#efe6d1", blush: "#e79a8c", mouth: "#8a2f2a", lip: "#d9786c", pupil: "#1d1916",
};
// tinted scratchboard: transparent inks laid over the scraped white
export const MIRA_SCRATCH: Record<string, string> = {
  skin: "#f6c9a8", nail: "#f6d6c0", hair: "#b0643e", coat: "#ffd23a", tights: "#6d86d6", boots: "#3fbfb0", satchel: "#d68f55", satchelDark: "#b06a36",
  glasses: "#ff4a3a", toggle: "#c07a45", buckle: "#ffd060", metal: "#c9d4dc",
};
// ink and light colour: pale washes (colour, strength); the hair is ink, not colour
export const MIRA_SUMI: Record<string, [string, number]> = {
  skin: ["#f0c7a4", 0.4], nail: ["#f0c7a4", 0.3], coat: ["#e8b62c", 0.62], tights: ["#4d6aa8", 0.55], boots: ["#3f9a8e", 0.55], satchel: ["#b57942", 0.5], satchelDark: ["#8a5530", 0.5],
  toggle: ["#8a5530", 0.6], buckle: ["#d8ad3c", 0.6], metal: ["#9aa4ac", 0.4],
};
// pixel art: a limited palette, each role a two-step ramp (lit, shade)
export const MIRA_PIXEL = {
  bg: "#bfe3ee", ground: "#8fcf8a", groundShadow: "#5fa67a", outline: "#2b1d2e",
  roles: {
    skin: ["#f7c9a3", "#d9926f"], nail: ["#f7c9a3", "#d9926f"], hair: ["#8a4a2c", "#5a2c1c"], coat: ["#ffd23f", "#e0961c"], tights: ["#3b4a8c", "#27305e"], boots: ["#22a797", "#12716a"],
    satchel: ["#bd6f38", "#834621"], satchelDark: ["#834621", "#5e3016"], glasses: ["#e2332b", "#a8201a"], toggle: ["#834621", "#5e3016"], buckle: ["#f2c840", "#b88a1c"],
    metal: ["#c3ccd3", "#8a959e"], pupil: ["#2b1d2e", "#2b1d2e"], white: ["#ffffff", "#e6e6e6"], blush: ["#f2898a", "#d06a6c"], mouth: ["#8c2f3a", "#6a1f2a"], lip: ["#e06a78", "#c04a58"],
  } as Record<string, [string, string]>,
};
// toy bricks: real brick colours; the shade side is built in that colour's darker brick
export const MIRA_BRICK = {
  base: "#cfe4ef", baseStud: false, ground: "#4b9f4a",
  roles: {
    skin: ["#f6d7b3", "#e4b98a"], nail: ["#f6d7b3", "#e4b98a"], hair: ["#82422a", "#5c2a18"], coat: ["#f2cd37", "#e39b25"], tights: ["#1e3a6e", "#132749"], boots: ["#00a0a0", "#006f73"],
    satchel: ["#aa7d55", "#7c5236"], satchelDark: ["#7c5236", "#5a3824"], glasses: ["#c91a09", "#8e1206"], toggle: ["#7c5236", "#5a3824"], buckle: ["#dcbc3b", "#b08f20"],
    metal: ["#a0a5a9", "#6c6e68"], pupil: ["#1b2a34", "#1b2a34"], white: ["#ffffff", "#e0e0e0"], blush: ["#e4adc8", "#c98aa8"], mouth: ["#720e0f", "#500a0a"], lip: ["#c84f60", "#a0303f"],
  } as Record<string, [string, string]>,
};
// coloured pencil: pencil colours, local and shadow
export const MIRA_PENCIL = {
  skin: { base: "#f0bf9c", shade: "#c98a74" }, nail: { base: "#f5d6c2", shade: "#e0b49c" }, hair: { base: "#8b4a2e", shade: "#4e2618" }, coat: { base: "#f5c93a", shade: "#d9892a" },
  tights: { base: "#3d4f95", shade: "#262e5c" }, boots: { base: "#2a9d8f", shade: "#1a6b62" }, satchel: { base: "#b8733f", shade: "#7e4524" }, satchelDark: { base: "#8e5530", shade: "#6a3a1e" },
  glasses: { base: "#d9372a", shade: "#9e1f16" }, toggle: { base: "#7e4524", shade: "#5a2e16" }, buckle: { base: "#e2b33c", shade: "#a07820" }, metal: { base: "#a9b3bb", shade: "#707a84" },
  pupil: { base: "#2a2230", shade: "#1a1420" }, white: { base: "#fffdf6", shade: "#e8e2d4" }, blush: { base: "#ec8f92", shade: "#c9676a" }, mouth: { base: "#8c3242", shade: "#6a2030" }, lip: { base: "#e07a82", shade: "#c05a62" },
};
