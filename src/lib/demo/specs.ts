/**
 * Demo catalogue definition (plain data only — also imported by scripts/generate-fashion-art.mjs).
 * Prices are in RUPEES here; mock/data.ts converts to integer paise.
 */
export const COLORS: Record<string, { name: string; hex: string }> = {
  leaf: { name: "Leaf Green", hex: "#3F7A4F" },
  maroon: { name: "Deep Maroon", hex: "#6E1F2E" },
  royal: { name: "Royal Blue", hex: "#274690" },
  olive: { name: "Olive", hex: "#6B6B2F" },
  black: { name: "Black", hex: "#1F1C1D" },
  red: { name: "Red", hex: "#B3202B" },
  blush: { name: "Blush Pink", hex: "#E3A5B2" },
  mustard: { name: "Mustard", hex: "#C9962B" },
  teal: { name: "Teal", hex: "#1F7A7A" },
  wine: { name: "Wine", hex: "#7A2B4A" },
  ivory: { name: "Ivory", hex: "#EFE3D3" },
  rose: { name: "Dusty Rose", hex: "#B96E7C" },
  navy: { name: "Navy", hex: "#1E2A52" },
  mint: { name: "Mint", hex: "#8FC9AE" },
};

export const CATEGORY_DEFS = [
  { slug: "anarkalis", name: "Anarkalis", description: "Floor-sweeping flares with fitted bodices and fine trims." },
  { slug: "frocks", name: "Frocks", description: "Playful, twirl-ready frocks for festive days and evenings." },
  { slug: "salwar-sets", name: "Salwar Sets", description: "Comfortable kurta, salwar and dupatta sets for every day." },
  { slug: "cord-sets", name: "Cord Sets", description: "Coordinated tops and bottoms, easy to wear and easy to style." },
  { slug: "gowns", name: "Gowns", description: "Statement gowns for weddings, receptions and celebrations." },
];

export const COLLECTION_DEFS = [
  { slug: "christmas-collection", name: "Christmas Collection", description: "Reds, greens and gold — festive silhouettes for the holiday season.", featured: true },
  { slug: "top-bottom-sets", name: "Top & Bottom Sets", description: "Matching sets that are effortless to wear and easy to gift.", featured: true },
  { slug: "frocks", name: "Frocks", description: "Twirl-worthy frocks in joyful colours and soft fabrics." },
  { slug: "salwar-sets", name: "Salwar Sets", description: "Classic kurta and salwar sets with modern details." },
  { slug: "festive-wear", name: "Festive Wear", description: "Embroidered, trimmed and made for celebrations." },
  { slug: "signature-collection", name: "Signature Collection", description: "Our most-loved designs, refined season after season.", featured: true },
];

type Pattern = "plain" | "dots" | "floral" | "stripes";
type Sil = "anarkali" | "frock" | "salwar" | "cordset" | "gown";
export interface ProductSpec {
  slug: string; name: string; code: string; cat: string; cols: string[]; sil: Sil;
  colors: string[]; pattern: Pattern; mrp: number; sale?: number; flags: string; fabric: string; desc: string; sold: number;
}

// flags: n = new arrival, b = best seller, f = featured
export const PRODUCT_SPECS: ProductSpec[] = [
  { slug: "panel-anarkali-leaf-green", name: "Panel Anarkali", code: "ZB-AN-101", cat: "anarkalis", cols: ["festive-wear", "signature-collection"], sil: "anarkali", colors: ["leaf", "maroon", "royal"], pattern: "floral", mrp: 3999, sale: 3199, flags: "bf", fabric: "Cotton silk", desc: "A panelled anarkali with a fitted bodice, flowing flare and a gold hem trim. Comes with a matching dupatta.", sold: 182 },
  { slug: "embroidered-anarkali-deep-maroon", name: "Embroidered Anarkali", code: "ZB-AN-102", cat: "anarkalis", cols: ["festive-wear", "signature-collection"], sil: "anarkali", colors: ["maroon", "wine", "navy"], pattern: "dots", mrp: 4499, sale: 3599, flags: "f", fabric: "Georgette", desc: "Hand-finished embroidery across the yoke and a swirling georgette flare — made for evenings that matter.", sold: 140 },
  { slug: "floral-anarkali-royal-blue", name: "Floral Anarkali", code: "ZB-AN-103", cat: "anarkalis", cols: ["festive-wear"], sil: "anarkali", colors: ["royal", "teal", "rose"], pattern: "floral", mrp: 3499, flags: "n", fabric: "Rayon", desc: "Printed florals on a soft rayon base with three-quarter sleeves and a relaxed, twirl-ready flare.", sold: 64 },
  { slug: "flared-anarkali-set-olive", name: "Flared Anarkali Set", code: "ZB-AN-104", cat: "anarkalis", cols: ["festive-wear"], sil: "anarkali", colors: ["olive", "mustard", "black"], pattern: "plain", mrp: 3799, sale: 2999, flags: "", fabric: "Cotton blend", desc: "A clean, modern anarkali in earthy tones with contrast piping and a coordinated dupatta.", sold: 58 },
  { slug: "gota-anarkali-mustard", name: "Gota Anarkali", code: "ZB-AN-105", cat: "anarkalis", cols: ["festive-wear", "signature-collection"], sil: "anarkali", colors: ["mustard", "red", "blush"], pattern: "stripes", mrp: 4299, flags: "nb", fabric: "Chanderi", desc: "Gota-work border on lightweight chanderi, with a gently structured silhouette.", sold: 97 },

  { slug: "christmas-velvet-frock-red", name: "Christmas Velvet Frock", code: "ZB-FR-201", cat: "frocks", cols: ["christmas-collection", "frocks"], sil: "frock", colors: ["red", "leaf"], pattern: "plain", mrp: 2499, sale: 1999, flags: "nbf", fabric: "Soft velvet", desc: "A velvet frock with puff sleeves, a satin bow and a full skirt — the centrepiece of the Christmas edit.", sold: 211 },
  { slug: "bow-frock-black", name: "Bow Frock", code: "ZB-FR-202", cat: "frocks", cols: ["frocks", "christmas-collection"], sil: "frock", colors: ["black", "red", "navy"], pattern: "dots", mrp: 2199, flags: "b", fabric: "Crepe", desc: "A flattering fit-and-flare frock with a waist bow and a playful polka print.", sold: 156 },
  { slug: "tiered-frock-blush-pink", name: "Tiered Frock", code: "ZB-FR-203", cat: "frocks", cols: ["frocks"], sil: "frock", colors: ["blush", "mint", "ivory"], pattern: "floral", mrp: 1999, sale: 1599, flags: "n", fabric: "Cotton voile", desc: "Light, airy tiers in cotton voile — comfortable for long days and warm weather.", sold: 73 },
  { slug: "polka-frock-navy", name: "Polka Frock", code: "ZB-FR-204", cat: "frocks", cols: ["frocks"], sil: "frock", colors: ["navy", "wine"], pattern: "dots", mrp: 2299, flags: "", fabric: "Crepe", desc: "A classic polka-dot frock with a nipped waist and a swishy skirt.", sold: 41 },
  { slug: "festive-frock-leaf-green", name: "Festive Frock", code: "ZB-FR-205", cat: "frocks", cols: ["christmas-collection", "frocks"], sil: "frock", colors: ["leaf", "red"], pattern: "stripes", mrp: 2599, sale: 2099, flags: "n", fabric: "Satin blend", desc: "Rich green with gold stripes and a bow — dressed up for the holidays.", sold: 88 },

  { slug: "cotton-salwar-set-blush", name: "Cotton Salwar Set", code: "ZB-SW-301", cat: "salwar-sets", cols: ["salwar-sets", "top-bottom-sets"], sil: "salwar", colors: ["blush", "mint", "mustard"], pattern: "floral", mrp: 2799, sale: 2199, flags: "bf", fabric: "Pure cotton", desc: "A breathable cotton kurta with straight salwar and a printed dupatta — an everyday favourite.", sold: 240 },
  { slug: "chanderi-salwar-set-teal", name: "Chanderi Salwar Set", code: "ZB-SW-302", cat: "salwar-sets", cols: ["salwar-sets", "signature-collection"], sil: "salwar", colors: ["teal", "wine", "olive"], pattern: "plain", mrp: 3299, flags: "f", fabric: "Chanderi", desc: "Subtle sheen, clean lines and a mulmul dupatta — easy elegance for work or festivities.", sold: 118 },
  { slug: "striped-salwar-set-royal-blue", name: "Striped Salwar Set", code: "ZB-SW-303", cat: "salwar-sets", cols: ["salwar-sets"], sil: "salwar", colors: ["royal", "red"], pattern: "stripes", mrp: 2599, flags: "n", fabric: "Cotton blend", desc: "Fine vertical stripes with contrast piping and a coordinated dupatta.", sold: 52 },
  { slug: "printed-salwar-set-mustard", name: "Printed Salwar Set", code: "ZB-SW-304", cat: "salwar-sets", cols: ["salwar-sets", "top-bottom-sets"], sil: "salwar", colors: ["mustard", "leaf"], pattern: "dots", mrp: 2399, sale: 1899, flags: "", fabric: "Cotton", desc: "A cheerful printed set in soft cotton, easy to wash and easy to wear.", sold: 67 },
  { slug: "festive-salwar-set-maroon", name: "Festive Salwar Set", code: "ZB-SW-305", cat: "salwar-sets", cols: ["salwar-sets", "festive-wear"], sil: "salwar", colors: ["maroon", "navy"], pattern: "floral", mrp: 3599, sale: 2899, flags: "b", fabric: "Silk blend", desc: "A silk-blend set with delicate floral work and a flowing dupatta for festive days.", sold: 133 },

  { slug: "co-ord-set-olive", name: "Co-ord Set", code: "ZB-CS-401", cat: "cord-sets", cols: ["top-bottom-sets", "signature-collection"], sil: "cordset", colors: ["olive", "black", "ivory"], pattern: "plain", mrp: 2999, sale: 2399, flags: "bf", fabric: "Linen blend", desc: "A cropped top with wide-leg trousers in a breathable linen blend. Mix, match or wear together.", sold: 175 },
  { slug: "floral-cord-set-blush", name: "Floral Cord Set", code: "ZB-CS-402", cat: "cord-sets", cols: ["top-bottom-sets"], sil: "cordset", colors: ["blush", "mint"], pattern: "floral", mrp: 2799, flags: "n", fabric: "Cotton voile", desc: "Soft florals in a relaxed fit — an easy two-piece for brunches and holidays.", sold: 49 },
  { slug: "striped-cord-set-royal-blue", name: "Striped Cord Set", code: "ZB-CS-403", cat: "cord-sets", cols: ["top-bottom-sets"], sil: "cordset", colors: ["royal", "red"], pattern: "stripes", mrp: 2699, sale: 2199, flags: "", fabric: "Cotton", desc: "Crisp stripes, a relaxed crop and high-waist trousers.", sold: 38 },
  { slug: "festive-cord-set-wine", name: "Festive Cord Set", code: "ZB-CS-404", cat: "cord-sets", cols: ["top-bottom-sets", "festive-wear", "christmas-collection"], sil: "cordset", colors: ["wine", "leaf", "black"], pattern: "dots", mrp: 3499, sale: 2799, flags: "nf", fabric: "Crepe", desc: "A festive two-piece with subtle shimmer — dress it up with statement earrings.", sold: 82 },
  { slug: "linen-cord-set-ivory", name: "Linen Cord Set", code: "ZB-CS-405", cat: "cord-sets", cols: ["top-bottom-sets"], sil: "cordset", colors: ["ivory", "mustard"], pattern: "plain", mrp: 3199, flags: "", fabric: "Pure linen", desc: "Natural linen in a clean cut — a timeless set for warm days.", sold: 29 },

  { slug: "satin-gown-wine", name: "Satin Gown", code: "ZB-GN-501", cat: "gowns", cols: ["festive-wear", "signature-collection"], sil: "gown", colors: ["wine", "navy", "black"], pattern: "plain", mrp: 5999, sale: 4799, flags: "f", fabric: "Satin", desc: "A floor-length satin gown with a deep V-neck and a fluid silhouette for receptions and parties.", sold: 76 },
  { slug: "embroidered-gown-royal-blue", name: "Embroidered Gown", code: "ZB-GN-502", cat: "gowns", cols: ["festive-wear", "signature-collection"], sil: "gown", colors: ["royal", "maroon"], pattern: "floral", mrp: 6499, flags: "n", fabric: "Georgette", desc: "Delicate embroidery across the bodice and a flowing georgette skirt.", sold: 44 },
  { slug: "christmas-gown-red", name: "Christmas Gown", code: "ZB-GN-503", cat: "gowns", cols: ["christmas-collection", "festive-wear"], sil: "gown", colors: ["red", "leaf"], pattern: "dots", mrp: 5499, sale: 4399, flags: "nb", fabric: "Velvet blend", desc: "A rich red gown with gold accents — made for holiday parties.", sold: 95 },
  { slug: "pleated-gown-dusty-rose", name: "Pleated Gown", code: "ZB-GN-504", cat: "gowns", cols: ["festive-wear"], sil: "gown", colors: ["rose", "mint", "ivory"], pattern: "stripes", mrp: 5299, flags: "", fabric: "Chiffon", desc: "Soft pleats and a floating chiffon skirt in a romantic dusty rose.", sold: 31 },
];
