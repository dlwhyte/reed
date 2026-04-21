// Sample library — realistic articles a curious reader might save.
// Used by the Library, Reader, and extension popup mockups.

const SAMPLE_ARTICLES = [
  {
    id: 1,
    title: "The quiet collapse of the local bookstore, and what came after",
    site: "Longreads",
    author: "Nora Emmett",
    readMin: 18,
    words: 4320,
    age: "2d",
    tags: ["books", "cities", "longform"],
    color: "#D9B38C",
    pattern: "stripes",
    favorite: true,
    summary: "A five-year portrait of three independent bookstores that tried three very different strategies to survive — and what their choices reveal about the shape of neighborhood retail.",
    tldr: "Independent bookstores didn't just \"die\" — they shed one by one as their adjacent economies (coffee, stationery, newspapers) moved online, turning books from an anchor into an accessory.",
    excerpt: "For decades, the bookstore sat at the quiet center of a block's economy — not because books were especially profitable, but because they gave people a reason to stop. When that reason thinned, everything around it thinned too."
  },
  {
    id: 2,
    title: "Why your calendar feels broken (and a small fix that isn't \"blocks\")",
    site: "Cluttered Desk",
    author: "Dev Patel",
    readMin: 9,
    words: 2100,
    age: "6h",
    tags: ["productivity", "design"],
    color: "#C98A6B",
    pattern: "dots",
    summary: "Calendar apps model meetings, not attention. A short argument for tagging events with the kind of work they interrupt.",
    tldr: "Most calendar UX treats all 30-minute holes as equivalent. Labeling 'focus', 'social', and 'admin' lets the app protect the blocks you most easily lose.",
    excerpt: "The default calendar gives you a grid of identical rectangles. But a 30-minute gap between two meetings is not the same thing as a 30-minute gap at 9am on a Tuesday, and anyone who does creative work already knows this in their body."
  },
  {
    id: 3,
    title: "Soil, silence, and the long half-life of a good fence",
    site: "Emergence Magazine",
    author: "M. Hart",
    readMin: 24,
    words: 5900,
    age: "1w",
    tags: ["ecology", "essays"],
    color: "#8FA878",
    pattern: "wave",
    favorite: true,
    summary: "A walking essay along an old stone boundary in the Scottish borders. The fence outlived four owners, two languages, and a small war — the soil on either side still disagrees.",
    tldr: "Boundaries made by humans persist as ecological signatures long after the humans forget them; the soil itself keeps the ledger.",
    excerpt: "The fence was older than the farm, older than the road that led to the farm, and — by a century or so — older than the language in which the farmer now sometimes cursed it."
  },
  {
    id: 4,
    title: "How Cohere's Command A handles tool chains without losing the thread",
    site: "The Gradient",
    author: "S. Orozco",
    readMin: 12,
    words: 2800,
    age: "3d",
    tags: ["ai", "engineering"],
    color: "#8B6F9E",
    pattern: "grid",
    summary: "A technical walk-through of Cohere's tool-use loop — how it drafts a plan, calls tools, and reconciles partial failures without abandoning the user's original question.",
    tldr: "Command A's agent loop separates planning from execution and keeps a compact scratchpad, which lets it recover gracefully from a tool that returns nothing useful.",
    excerpt: "Most agent loops break the first time a tool returns an empty list. Command A treats \"no result\" as information: the plan gets re-scored, the next step adjusts, and the user sees a sentence of narration instead of a silence."
  },
  {
    id: 5,
    title: "The case for owning your own software (again)",
    site: "Permanent Records",
    author: "Lena Voss",
    readMin: 14,
    words: 3400,
    age: "4d",
    tags: ["local-first", "essays", "software"],
    color: "#B88968",
    pattern: "stripes",
    summary: "Pocket shut down in July 2025, and took a decade of saved reading with it. A working argument for local-first tools, plus a practical list of replacements.",
    tldr: "Local-first software costs a little more in setup and a lot less in long-term grief. The essay closes with five specific apps the author has moved back onto her own machine.",
    excerpt: "Every generation of users learns the same lesson: the convenient thing disappears exactly when you'd finally filled it with something worth keeping."
  },
  {
    id: 6,
    title: "A small, honest introduction to tasting tea",
    site: "Slow Things",
    author: "Yuki Nakamura",
    readMin: 7,
    words: 1650,
    age: "1d",
    tags: ["food", "leisure"],
    color: "#A8885B",
    pattern: "dots",
    summary: "A beginner's guide that doesn't pretend there are correct answers — only better questions to ask of the cup in front of you.",
    tldr: "Tasting tea is mostly about paying attention in sequence: smell, temperature, body, aftertaste. Almost everything else is commentary.",
    excerpt: "Before you decide whether a tea is good, decide what it reminds you of. The answer is rarely other teas."
  },
  {
    id: 7,
    title: "Why everyone is suddenly talking about SQLite again",
    site: "Hacker Digest",
    author: "R. Chen",
    readMin: 11,
    words: 2550,
    age: "5d",
    tags: ["software", "engineering"],
    color: "#6E8CA8",
    pattern: "grid",
    summary: "A short history of SQLite's unreasonable effectiveness and the recent wave of products betting their backend on a single file.",
    tldr: "SQLite scales further than most teams assume; the new wave of tools treats its \"limitations\" as features — single-writer, on-disk, no ops.",
    excerpt: "The database's superpower isn't speed or scale; it's that you can back it up by copying a file."
  },
  {
    id: 8,
    title: "Notes on the disappearing 'third place'",
    site: "City & Scale",
    author: "J. Osei",
    readMin: 16,
    words: 3850,
    age: "1w",
    tags: ["cities", "essays", "community"],
    color: "#C87A5C",
    pattern: "wave",
    summary: "The coffee shop is not replacing the pub, the library, or the church hall. Here's what's actually replacing them — and what it costs us.",
    tldr: "Screens absorbed most \"third place\" functions without replacing the social friction those places produced; friction turns out to be load-bearing.",
    excerpt: "A good third place is the kind of somewhere you go to not-decide things — to let an afternoon make itself out of small unchosen encounters."
  },
];

// Tag cloud derived from the above
const SAMPLE_TAGS = (() => {
  const counts = {};
  SAMPLE_ARTICLES.forEach(a => a.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([tag, count]) => ({ tag, count }));
})();

// Similar articles helper
function similarTo(id) {
  const me = SAMPLE_ARTICLES.find(a => a.id === id);
  if (!me) return [];
  return SAMPLE_ARTICLES.filter(a => a.id !== id)
    .map(a => ({ a, overlap: a.tags.filter(t => me.tags.includes(t)).length }))
    .filter(x => x.overlap > 0)
    .sort((x,y) => y.overlap - x.overlap)
    .slice(0, 3)
    .map(x => x.a);
}

Object.assign(window, { SAMPLE_ARTICLES, SAMPLE_TAGS, similarTo });
