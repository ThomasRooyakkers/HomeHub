/* Hand-drawn grocery glyphs ported from the Garden design.
   Each icon is a 48×48 SVG path, rendered as a friendly line sketch. */

const GLYPHS = {
  bread: (
    <g>
      <path d="M11 31c-3-1-4-9 3-11 2-5 16-6 19 0 6 2 5 10 2 11"/>
      <path d="M13 31c0 3 1 5 4 5h14c3 0 4-2 4-5"/>
      <path d="M18 22l3-3M25 22l3-3M31 23l3-3"/>
    </g>
  ),
  milk: (
    <g>
      <path d="M17 21v18c0 1 1 2 2 2h10c1 0 2-1 2-2V21"/>
      <path d="M17 21l3-8h8l3 8z"/>
      <path d="M24 13v8"/>
    </g>
  ),
  yogurt: (
    <g>
      <path d="M16 22h16l-2 16c0 1-1 2-2 2h-8c-1 0-2-1-2-2z"/>
      <path d="M14 20c0-1 1-2 3-2h14c2 0 3 1 3 2 0 1-1 2-3 2H17c-2 0-3-1-3-2z"/>
      <path d="M20 30q4-2 8 0"/>
    </g>
  ),
  cheese: (
    <g>
      <path d="M12 33l22-14c1 3 2 11 2 14z"/>
      <path d="M12 33h24"/>
      <circle cx="24" cy="29" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="30" cy="26" r="1.3" fill="currentColor" stroke="none"/>
    </g>
  ),
  eggs: (
    <g>
      <path d="M19 38c-4 0-7-4-7-9 0-6 3-12 7-12s7 6 7 12c0 5-3 9-7 9z"/>
      <path d="M31 38c-3 0-5-3-5-6 0-4 2-8 5-8s5 4 5 8c0 3-2 6-5 6z"/>
    </g>
  ),
  fish: (
    <g>
      <path d="M31 24c0-5-9-7-15-3-3 2-3 4-3 4s0 2 3 4c6 4 15 2 15-3z"/>
      <path d="M31 24l7-5v10z"/>
      <circle cx="19" cy="22" r="1.4" fill="currentColor" stroke="none"/>
    </g>
  ),
  meat: (
    <g>
      <path d="M14 27C11 19 19 13 27 15c8 2 10 10 5 15-5 5-15 5-18-3z"/>
      <path d="M20 25c3-2 7-1 9 2"/>
    </g>
  ),
  lemon: (
    <g>
      <path d="M14 27c0-5 5-8 11-8s11 3 11 8-5 8-11 8-11-3-11-8z"/>
      <path d="M31 18q5-3 7 1-5 2-7-1z"/>
      <path d="M18 27h14"/>
    </g>
  ),
  apple: (
    <g>
      <path d="M24 19c-3-4-11-2-11 6s6 14 11 14 11-6 11-14-8-10-11-6z"/>
      <path d="M24 19v-5"/>
      <path d="M24 15q4-4 8-1-3 4-8 1z"/>
    </g>
  ),
  banana: (
    <g>
      <path d="M14 24c2 9 16 12 22 3-2 2-5 3-8 2 3-2 5-5 5-9-3 5-9 7-15 4-2-1-4-2-4-2z"/>
    </g>
  ),
  tomato: (
    <g>
      <circle cx="24" cy="28" r="10"/>
      <path d="M24 18v-4M24 18l-5-3M24 18l5-3M24 18l-3 3M24 18l3 3"/>
    </g>
  ),
  leafy: (
    <g>
      <path d="M24 13c-10 4-10 21 0 25 10-4 10-21 0-25z"/>
      <path d="M24 15v22"/>
      <path d="M24 22l-5 4M24 22l5 4M24 29l-4 3M24 29l4 3"/>
    </g>
  ),
  carrot: (
    <g>
      <path d="M16 32l11 5c2-7-2-16-9-17-3 3-4 8-2 12z"/>
      <path d="M27 19l3-5M27 19l6-2M27 19l1-6"/>
    </g>
  ),
  onion: (
    <g>
      <path d="M24 19c-7 0-10 6-10 11s4 8 10 8 10-3 10-8-3-11-10-11z"/>
      <path d="M24 19c-1-3 1-5 4-6M20 21v15M28 21v15"/>
    </g>
  ),
  potato: (
    <g>
      <path d="M14 28c-2-6 5-12 13-10 7 2 9 9 5 14-5 6-16 4-18-4z"/>
      <circle cx="20" cy="26" r="1.1" fill="currentColor" stroke="none"/>
      <circle cx="27" cy="30" r="1.1" fill="currentColor" stroke="none"/>
      <circle cx="25" cy="23" r="1.1" fill="currentColor" stroke="none"/>
    </g>
  ),
  herb: (
    <g>
      <path d="M18 33h12l-2 7H20z"/>
      <path d="M24 33V17"/>
      <path d="M24 24q-7-1-9-6 7 0 9 4z"/>
      <path d="M24 27q7-1 9-6-7 0-9 4z"/>
    </g>
  ),
  bottle: (
    <g>
      <path d="M21 13h6v4c3 1 4 4 4 7v14c0 1-1 2-2 2H19c-1 0-2-1-2-2V24c0-3 1-6 4-7z"/>
      <path d="M17 29h14"/>
    </g>
  ),
  pasta: (
    <g>
      <path d="M18 20q0-2 2-2h8q2 0 2 2v17q0 2-2 2h-8q-2 0-2-2z"/>
      <path d="M17 14q7-3 14 0v4H17z"/>
      <path d="M22 22q3 2 0 5t0 5t0 4"/>
      <path d="M26 22q-3 2 0 5t0 5t0 4"/>
    </g>
  ),
  rice: (
    <g>
      <path d="M13 28q11 13 22 0z"/>
      <path d="M12 28q12-5 24 0"/>
      <path d="M20 21q1-3 0-5M24 20q1-3 0-5M28 21q1-3 0-5"/>
    </g>
  ),
  coffee: (
    <g>
      <path d="M15 23h16v8a8 8 0 0 1-16 0z"/>
      <path d="M31 25a4 4 0 0 1 0 8"/>
      <path d="M21 17q2-3 0-5M27 17q2-3 0-5"/>
    </g>
  ),
  water: (
    <g>
      <path d="M24 12c0 0-10 13-10 19a10 10 0 0 0 20 0c0-6-10-19-10-19z"/>
    </g>
  ),
  cleaning: (
    <g>
      <path d="M14 27c0-3 2-5 5-5h10c3 0 5 2 5 5v7c0 3-2 5-5 5H19c-3 0-5-2-5-5z"/>
      <path d="M14 30h20"/>
      <circle cx="19" cy="17" r="2"/>
      <circle cx="25" cy="14" r="2.4"/>
      <circle cx="31" cy="18" r="1.8"/>
    </g>
  ),
  paper: (
    <g>
      <path d="M16 18c0-2 4-4 8-4s8 2 8 4v17c0 2-4 4-8 4s-8-2-8-4z"/>
      <path d="M16 18c0 2 4 4 8 4s8-2 8-4"/>
      <path d="M30 31q4 1 4 7"/>
    </g>
  ),
  treat: (
    <g>
      <path d="M16 17h16v15H16z"/>
      <path d="M24 17v15M16 24h16M16 31h16"/>
    </g>
  ),
  juice: (
    <g>
      <path d="M18 20h12l-2 18c0 1-1 2-2 2h-4c-1 0-2-1-2-2z"/>
      <path d="M18 20l-2-6h16l-2 6"/>
      <path d="M27 13l3-5"/>
    </g>
  ),
  basket: (
    <g>
      <path d="M13 22h22l-3 15c0 1-1 2-2 2H18c-1 0-2-1-2-2z"/>
      <path d="M11 22h26"/>
      <path d="M18 22c0-7 12-7 12 0"/>
      <path d="M20 27l1 9M24 27v9M28 27l-1 9"/>
    </g>
  ),
};

const RULES = [
  ["yogurt",   ["yog", "kefir", "quark", "skyr"]],
  ["milk",     ["milk", "cream"]],
  ["cheese",   ["cheese", "brie", "cheddar", "gouda", "parmesan", "feta", "mozzarella", "butter", "margarine"]],
  ["eggs",     ["egg"]],
  ["fish",     ["salmon", "fish", "tuna", "cod", "prawn", "shrimp", "seafood", "mackerel", "sardine", "haddock"]],
  ["meat",     ["chicken", "beef", "pork", "meat", "steak", "mince", "bacon", "sausage", "ham", "turkey", "lamb", "drumstick"]],
  ["lemon",    ["lemon", "lime", "citrus", "orange", "grapefruit"]],
  ["banana",   ["banana", "plantain"]],
  ["apple",    ["apple", "pear"]],
  ["tomato",   ["tomato", "passata"]],
  ["carrot",   ["carrot"]],
  ["onion",    ["onion", "garlic", "shallot", "leek"]],
  ["potato",   ["potato", "fries", "spud"]],
  ["herb",     ["basil", "rosemary", "herb", "mint", "thyme", "coriander", "parsley", "plant", "oregano", "dill"]],
  ["leafy",    ["broccoli", "lettuce", "spinach", "greens", "kale", "salad", "cabbage", "sprout", "courgette", "cucumber", "pepper", "chili", "chilli", "celery"]],
  ["pasta",    ["pasta", "spaghetti", "bucatini", "noodle", "macaroni", "penne", "lasagne", "lasagna"]],
  ["rice",     ["rice", "quinoa", "couscous", "cereal", "oats", "muesli", "granola", "flour"]],
  ["coffee",   ["coffee", "espresso", "tea", "cocoa"]],
  ["treat",    ["chocolate", "candy", "sweet", "biscuit", "cookie", "crisp", "snack", "sugar", "cake", "jam", "honey"]],
  ["juice",    ["juice", "smoothie", "squash", "cordial", "lemonade", "cola", "soda"]],
  ["water",    ["water", "sparkling"]],
  ["cleaning", ["sponge", "soap", "deterg", "dish", "clean", "washing", "bleach", "wipe", "laundry", "spray"]],
  ["paper",    ["paper", "towel", "tissue", "toilet", "napkin", "kitchen roll"]],
  ["bread",    ["bread", "loaf", "sourdough", "baguette", "bun", "bagel", "roll", "toast", "croissant", "pita", "wrap", "tortilla"]],
  ["bottle",   ["oil", "olive", "vinegar", "sauce", "soy", "mirin", "ketchup", "dressing", "syrup", "miso", "stock", "sesame", "tahini", "mustard", "mayo", "wine", "beer", "prosecco", "gin", "vodka", "whisky"]],
];

export function detectGroceryIcon(name) {
  const s = (name || "").toLowerCase();
  if (!s.trim()) return "basket";
  for (const [key, words] of RULES) {
    if (words.some(w => s.includes(w))) return key;
  }
  return "basket";
}

export default function GroceryIcon({ name, size = 28, stroke = "currentColor", strokeWidth = 2, style }) {
  const key = GLYPHS[name] ? name : detectGroceryIcon(name);
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {GLYPHS[key]}
    </svg>
  );
}
