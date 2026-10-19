// Weapons that break, bows, shields, outfits, things to gather, and cooking. Plain data and rules (node tests use it).
// kind: one (one-handed) | two (two-handed, slow, strong) | spear (fast, long reach); dur = hits before it breaks
export const WEAPONS = {
  w_branch:   { name: ['樹枝', 'Tree Branch'], kind: 'one', pow: 2, dur: 4, reach: 2.0, col: '#8a5a2a' },
  w_torch:    { name: ['火把', 'Torch'], kind: 'one', pow: 2, dur: 8, reach: 2.0, col: '#c8782a' },
  w_traveler: { name: ['木劍', 'Wooden Sword'], kind: 'one', pow: 5, dur: 20, reach: 2.2, col: '#d0d8e0' },
  w_soldier:  { name: ['士兵之劍', 'Soldier\'s Broadsword'], kind: 'one', pow: 14, dur: 25, reach: 2.3, col: '#c8d4e8', price: 300 },
  w_knight:   { name: ['騎士之劍', 'Knight\'s Broadsword'], kind: 'one', pow: 26, dur: 27, reach: 2.4, col: '#e8e0b0' },
  w_club:     { name: ['球棒', 'Baseball Bat'], kind: 'one', pow: 4, dur: 10, reach: 2.0, col: '#7a4a2a' },
  w_spiked:   { name: ['尖刺棍', 'Spiked Club'], kind: 'one', pow: 12, dur: 12, reach: 2.1, col: '#6a4a3a' },
  w_dragonbone: { name: ['龍骨棍', 'Dragonbone Club'], kind: 'one', pow: 24, dur: 14, reach: 2.2, col: '#e8e0c8' },
  w_axe:      { name: ['伐木斧', 'Woodcutter\'s Axe'], kind: 'two', pow: 3, dur: 22, reach: 2.4, col: '#a87040' },
  w_claymore: { name: ['雙手大劍', 'Claymore'], kind: 'two', pow: 20, dur: 25, reach: 2.8, col: '#c0c8d0' },
  w_royal:    { name: ['皇家大劍', 'Royal Claymore'], kind: 'two', pow: 52, dur: 40, reach: 3.0, col: '#ffe080' },
  w_boko2:    { name: ['哥布林大刀', 'Goblin Bigsword'], kind: 'two', pow: 12, dur: 14, reach: 2.6, col: '#8a6a4a' },
  w_spear:    { name: ['士兵之槍', 'Soldier\'s Spear'], kind: 'spear', pow: 7, dur: 20, reach: 3.3, col: '#c8c8d0' },
  w_halberd:  { name: ['騎士之戟', 'Knight\'s Halberd'], kind: 'spear', pow: 26, dur: 30, reach: 3.4, col: '#e0d8a0' },
  w_bokospear:{ name: ['哥布林長矛', 'Goblin Spear'], kind: 'spear', pow: 4, dur: 15, reach: 3.1, col: '#7a5a3a' },
  w_ancient:  { name: ['古代短刀', 'Ancient Short Sword'], kind: 'one', pow: 40, dur: 54, reach: 2.4, col: '#7af0ff' },
  w_dawn:     { name: ['曉光之劍', 'Sword of Dawn'], kind: 'one', pow: 30, dur: 40, reach: 2.5, col: '#a8e8ff', recharge: true },
};
export const BOWS = {
  b_traveler: { name: ['旅人之弓', 'Traveler\'s Bow'], pow: 5, dur: 20, col: '#8a5a2a' },
  b_goblin:   { name: ['哥布林弓', 'Goblin Bow'], pow: 4, dur: 10, col: '#6a4a2a' },
  b_soldier:  { name: ['士兵之弓', 'Soldier\'s Bow'], pow: 14, dur: 36, col: '#c8a060', price: 450 },
  b_falcon:   { name: ['鷹之弓', 'Falcon Bow'], pow: 20, dur: 30, col: '#5a8ad8' },
  b_ancient:  { name: ['古代弓', 'Ancient Bow'], pow: 44, dur: 60, col: '#7af0ff' },
};
// guard: damage it takes away; dur: blocks before it breaks; laser: can block a sentinel's beam whole
export const SHIELDS = {
  s_potlid:   { name: ['鍋蓋', 'Pot Lid'], guard: 3, dur: 8, col: '#9aa0a8' },
  s_wood:     { name: ['木盾', 'Wooden Shield'], guard: 6, dur: 12, col: '#a87040' },
  s_traveler: { name: ['旅人之盾', 'Traveler\'s Shield'], guard: 10, dur: 16, col: '#c8a060' },
  s_soldier:  { name: ['士兵之盾', 'Soldier\'s Shield'], guard: 16, dur: 22, col: '#5a7ab8', price: 250 },
  s_knight:   { name: ['騎士之盾', 'Knight\'s Shield'], guard: 24, dur: 30, col: '#c8b860' },
  s_ancient:  { name: ['古代之盾', 'Ancient Shield'], guard: 70, dur: 32, col: '#7af0ff', laser: true },
};
// outfits: defence and a perk
export const OUTFITS = {
  traveler: { name: ['學校 T 恤', 'School T-shirt'], def: 1, col: ['#36a35a', '#2e4a7a'] },
  warm:     { name: ['保暖上衣', 'Warm Doublet'], def: 2, cold: true, price: 150, col: ['#c84a3a', '#6a4a3a'], perk: ['不怕寒冷', 'Resists cold'] },
  climber:  { name: ['攀岩裝', 'Climbing Gear'], def: 2, climb: 1.5, price: 500, col: ['#4a8a6a', '#3a3a3a'], perk: ['攀爬更快、更省力', 'Climb faster with less stamina'] },
  soldier:  { name: ['士兵之鎧', 'Soldier\'s Armour'], def: 6, price: 900, col: ['#8a96b0', '#5a5a6a'], perk: ['防禦大增', 'Much better defence'] },
  ancient:  { name: ['古代之鎧', 'Ancient Armour'], def: 10, atk: 1.2, col: ['#3a4a5a', '#7af0ff'], perk: ['攻擊力 +20%', 'Attack +20%'] },
};
// things to gather and eat; heal in quarter hearts; fx: stamina | cold | hearty
export const MATS = {
  apple:   { name: ['蘋果', 'Apple'], heal: 2, col: '#e83a3a', food: true, price: 3 },
  shroom:  { name: ['森林菇', 'Forest Mushroom'], heal: 2, col: '#c89a6a', food: true, price: 3 },
  radish:  { name: ['心之蘿蔔', 'Heart Radish'], heal: 12, fx: 'hearty', col: '#f0f0f0', food: true, price: 20 },
  stamella:{ name: ['活力菇', 'Vigor Mushroom'], heal: 1, fx: 'stamina', col: '#c8e04a', food: true, price: 8 },
  pepper:  { name: ['火焰辣椒', 'Fire Pepper'], heal: 1, fx: 'cold', col: '#ff5a2a', food: true, price: 6 },
  meat:    { name: ['獸肉', 'Raw Meat'], heal: 4, col: '#c86a6a', food: true, price: 8 },
  horn:    { name: ['哥布林角', 'Goblin Horn'], col: '#e8dcc0', price: 5 },
  screw:   { name: ['古代螺絲', 'Ancient Screw'], col: '#7af0ff', price: 12 },
  amber:   { name: ['琥珀', 'Amber'], col: '#e0a030', price: 30 },
  ruby:    { name: ['紅寶石', 'Ruby'], col: '#ff2a4a', price: 210 },
  diamond: { name: ['鑽石', 'Diamond'], col: '#c8f0ff', price: 500 },
};
export const ARROW_PRICE = 20;      // for 5 arrows
export const kindOf = (id) => (WEAPONS[id] ? 'w' : BOWS[id] ? 'b' : SHIELDS[id] ? 's' : OUTFITS[id] ? 'o' : MATS[id] ? 'm' : null);
export const itemDef = (id) => WEAPONS[id] || BOWS[id] || SHIELDS[id] || OUTFITS[id] || MATS[id];

// ---------------------------------------------------------------- cooking: up to five ingredients in the pot
// heal doubles when cooked; one kind of effect makes a dish of that effect; mixing effects cancels them
export function cook(ids) {
  const items = ids.map((id) => MATS[id]).filter(Boolean);
  const food = items.filter((m) => m.food);
  if (!food.length || food.length !== items.length) return { name: ['可疑料理', 'Dubious Food'], heal: 4, fx: null, power: 0, icon: '#6a5a4a' };
  const fxs = [...new Set(food.map((m) => m.fx).filter(Boolean))], fx = fxs.length === 1 ? fxs[0] : null;
  const power = fx ? food.filter((m) => m.fx === fx).length : 0;
  let heal = Math.min(80, food.reduce((s, m) => s + m.heal, 0) * 2);
  const has = (k) => ids.includes(k), only = (ks) => ids.every((k) => ks.includes(k));
  let base;
  if (has('meat') && has('shroom')) base = ['肉菇串', 'Meat & Mushroom Skewer'];
  else if (has('meat')) base = ['烤肉排', 'Seared Steak'];
  else if (only(['apple'])) base = ['煎蘋果', 'Simmered Fruit'];
  else if (only(['shroom', 'stamella'])) base = ['蘑菇串', 'Mushroom Skewer'];
  else if (only(['radish'])) base = ['蘿蔔燉菜', 'Radish Stew'];
  else if (only(['pepper'])) base = ['烤辣椒', 'Roasted Pepper'];
  else base = ['什錦料理', 'Mixed Platter'];
  const prefix = { stamina: ['活力', 'Energizing '], cold: ['暖身', 'Spicy '], hearty: ['元氣', 'Hearty '] }[fx] || ['', ''];
  if (fx === 'hearty') heal = 999;                  // a hearty dish heals fully and adds extra hearts
  return { name: [prefix[0] + base[0], prefix[1] + base[1]], heal, fx, power, icon: fx === 'cold' ? '#ff6a3a' : fx === 'stamina' ? '#c8e04a' : fx === 'hearty' ? '#ffd040' : '#c89a6a' };
}
// what a dish does: { heal (quarters, 999 = full), stamina (wheels), cold (seconds), extra (quarters of extra hearts) }
export function effectOf(dish) {
  return { heal: dish.heal, stamina: dish.fx === 'stamina' ? dish.power * 0.4 : 0, cold: dish.fx === 'cold' ? dish.power * 150 : 0, extra: dish.fx === 'hearty' ? dish.power * 4 : 0 };
}
// raw food: half the healing, a smaller effect
export function rawDish(id) { const m = MATS[id]; return { name: m.name, heal: m.heal, fx: m.fx || null, power: m.fx ? 0.5 : 0, icon: m.col }; }
