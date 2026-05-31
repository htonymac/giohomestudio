"use client";

import { useState, useEffect } from "react";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import ModelPicker from "../../components/ModelPicker";
import DurationPicker from "../../components/DurationPicker";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";

// ═══════════════════════════════════════════════════════════════════════════
// GHS AI Children Video — Dedicated child-safe content creation
//
// Two branches: Children Video (animated/active) + Children Hybrid (storybook/read-along)
// Strictly supervised: 2 review checkpoints, child-safe planner
//
// KEY: Each age group shows DIFFERENT content types based on real curriculum:
// - EYFS (UK Early Years Foundation Stage)
// - US Common Core / Head Start
// - Montessori curriculum stages
// - Nigerian NERDC standards
// - Universal developmental milestones
//
// Features: curriculum-backed content per age, character import, smart DB
// suggestions, multi-language pairs, safety rules per age group
// ═══════════════════════════════════════════════════════════════════════════

// ── Age Group Definitions (curriculum-backed) ──
const AGE_GROUPS = [
  {
    id: "toddler", label: "Toddlers", age: "2-3 years",
    config: { wordLevel: "single", pacing: "very slow", fontSize: "extra large", musicEnergy: "very soft", maxDuration: 180, maxWordsPerScene: 5 },
    safety: "Maximum restriction. No sudden sounds, no dark scenes, no distress. Co-viewing recommended.",
    curriculum: "EYFS Communication & Language, Montessori 0-3 Infant Community, Head Start 0-3",
    screenTime: "Max 1 min per video segment. WHO recommends max 1hr/day total screen time.",
    visualStyle: "High contrast, bold primary colours, max 2-3 objects on screen, large expressive faces, slow transitions (5-10s holds)",
  },
  {
    id: "preschool", label: "Pre-school", age: "3-5 years",
    config: { wordLevel: "simple", pacing: "slow", fontSize: "large", musicEnergy: "soft", maxDuration: 420, maxWordsPerScene: 15 },
    safety: "No unsupervised children in danger, no bullying without resolution, no food choking hazards depicted.",
    curriculum: "EYFS Literacy & Maths, Common Core K, Montessori 3-6, Waldorf Pre-Primary 3-5",
    screenTime: "3-7 min per video. Max 1hr/day, mostly co-viewed.",
    visualStyle: "Clean with labels, 4-6 elements per scene, character consistency, bright saturated colours",
  },
  {
    id: "early", label: "Early School", age: "5-8 years",
    config: { wordLevel: "basic sentences", pacing: "moderate", fontSize: "large", musicEnergy: "playful", maxDuration: 900, maxWordsPerScene: 40 },
    safety: "No cybersafety risks, no competitive ranking, diverse body types. Slapstick OK, no realistic violence.",
    curriculum: "UK KS1-2, Common Core Grades 1-3, Montessori 6-9 Lower Elementary, UNESCO ECCE Primary 1-3",
    screenTime: "7-15 min per video. 1-2hrs/day recreational.",
    visualStyle: "More detail, infographic elements, labelled diagrams, full sentences on screen, clear sans-serif fonts",
  },
  {
    id: "older", label: "Older Kids", age: "8-12 years",
    config: { wordLevel: "paragraphs", pacing: "normal", fontSize: "medium", musicEnergy: "active", maxDuration: 1500, maxWordsPerScene: 100 },
    safety: "No personal info collection (COPPA), no manipulative ads, no self-harm content. Aspirational not condescending.",
    curriculum: "UK KS2 Years 4-6, Common Core Grades 3-6, Montessori 9-12 Upper Elementary, IB PYP Grades 4-6",
    screenTime: "10-25 min per video. Family-set limits.",
    visualStyle: "Sophisticated — anime/manga style acceptable, realistic proportions, nuanced palettes, can handle dashboards and branching",
  },
];

// ── Content types PER AGE GROUP (curriculum-backed, NOT the same for all) ──
interface ContentTypeItem {
  id: string;
  label: string;
  icon: string;
  desc: string;
  curriculum: string; // which standard this maps to
}

const CONTENT_BY_AGE: Record<string, ContentTypeItem[]> = {
  toddler: [
    { id: "letters-sounds", label: "Letters & Sounds", icon: "", desc: "Single letter recognition, initial sounds, A-B-C songs", curriculum: "EYFS Communication" },
    { id: "numbers-counting", label: "Numbers 1-5", icon: "", desc: "Count 1-5, one-to-one, more vs less", curriculum: "EYFS Mathematics" },
    { id: "colours-shapes", label: "Colours & Shapes", icon: "", desc: "Primary colours, circle, square, triangle", curriculum: "EYFS Mathematics" },
    { id: "animals-nature", label: "Animals & Nature", icon: "", desc: "Animal names, sounds, simple habitats", curriculum: "EYFS Understanding World" },
    { id: "my-world", label: "My World", icon: "", desc: "Family, body parts, food, daily routines, happy/sad", curriculum: "EYFS Personal Development" },
    { id: "music-movement", label: "Music & Movement", icon: "", desc: "Action songs, clapping rhythms, dance-along", curriculum: "EYFS Expressive Arts" },
    // ── Henry 2026-05-30: more templates per section ──
    { id: "bedtime-soothing", label: "Bedtime Stories", icon: "", desc: "Gentle stories, lullabies, going-to-sleep routines", curriculum: "EYFS Personal Development" },
    { id: "first-words", label: "My First Words", icon: "", desc: "Hello, mama, dada, more, please — first 50 words", curriculum: "EYFS Communication" },
    { id: "potty-bath", label: "Potty & Bath Time", icon: "", desc: "Routines around washing, potty, brushing teeth", curriculum: "EYFS Personal Development" },
    { id: "feelings-faces", label: "Feelings & Faces", icon: "", desc: "Happy, sad, angry, surprised — name and show emotions", curriculum: "EYFS Personal Development" },
  ],
  preschool: [
    { id: "phonics", label: "Phonics & Reading", icon: "", desc: "Letter-sound matching, CVC blending (cat/sat/pin), sight words, rhyming", curriculum: "EYFS Literacy, Common Core RF.K" },
    { id: "early-maths", label: "Numbers & Maths", icon: "", desc: "Counting to 20, number writing, simple addition, shapes, patterns", curriculum: "EYFS Maths, Common Core K" },
    { id: "stories", label: "Stories & Tales", icon: "", desc: "Simple beginning-middle-end stories, character feelings, retelling", curriculum: "EYFS Literacy" },
    { id: "science-discovery", label: "Science & Discovery", icon: "", desc: "Seasons, weather, plants growing, animals, senses, materials", curriculum: "EYFS Understanding World" },
    { id: "my-community", label: "My Community", icon: "", desc: "Helpers (doctor, teacher, firefighter), places, transport, rules", curriculum: "EYFS Understanding World" },
    { id: "creative-play", label: "Creative Expression", icon: "", desc: "Drawing, painting, building, imaginative play prompts", curriculum: "EYFS Expressive Arts" },
    { id: "social-emotional", label: "Social & Emotional", icon: "", desc: "Sharing, turn-taking, empathy, managing feelings, friendship", curriculum: "EYFS Personal Development" },
    { id: "cultural-awareness", label: "Cultural Awareness", icon: "", desc: "Festivals, foods, languages, families around the world", curriculum: "EYFS Understanding World" },
  ],
  early: [
    { id: "reading-writing", label: "Reading & Writing", icon: "", desc: "Phonics progression, fluency, comprehension, creative writing, grammar", curriculum: "UK KS1-2, Common Core RL.1-3" },
    { id: "mathematics", label: "Mathematics", icon: "", desc: "Operations to 1000, times tables, fractions, measurement, time, money", curriculum: "Common Core Math 1-3" },
    { id: "science", label: "Science", icon: "", desc: "Life science, physical science, earth science, simple experiments", curriculum: "NGSS, UK Science KS1-2" },
    { id: "history-people", label: "History & People", icon: "", desc: "Significant figures, past events, timelines, primary sources", curriculum: "UK History KS1-2" },
    { id: "geography", label: "Geography & Nature", icon: "", desc: "Maps, continents, habitats, weather systems, conservation", curriculum: "UK Geography KS1-2" },
    { id: "computing-logic", label: "Computing & Logic", icon: "", desc: "Algorithms, coding basics, debugging, digital literacy", curriculum: "UK Computing KS1-2" },
    { id: "arts-music", label: "Arts & Music", icon: "", desc: "Techniques, artists, instruments, composition, performance", curriculum: "UK Arts & Music KS1-2" },
    { id: "stories-literature", label: "Stories & Books", icon: "", desc: "Chapter books, genres, author study, book discussions, series", curriculum: "Common Core RL.2-3" },
    { id: "health-wellbeing", label: "Health & Wellbeing", icon: "", desc: "Nutrition, exercise, hygiene, feelings, friendships, safety", curriculum: "UK PSHE" },
    { id: "projects-making", label: "Projects & Making", icon: "", desc: "Design challenges, research mini-projects, presentations", curriculum: "Montessori 6-9" },
  ],
  older: [
    { id: "language-arts", label: "Language Arts", icon: "✍️", desc: "Advanced reading, analytical writing, poetry, journalism, debate", curriculum: "Common Core ELA 3-6" },
    { id: "advanced-maths", label: "Mathematics", icon: "", desc: "Fractions/decimals/percentages, algebra basics, geometry, statistics", curriculum: "Common Core Math 3-6" },
    { id: "science-engineering", label: "Science & Engineering", icon: "⚗️", desc: "Classification, forces, electricity, space, evolution, design challenges", curriculum: "UK KS2 Science, NGSS" },
    { id: "history-civilisations", label: "History & Civilisations", icon: "", desc: "Ancient worlds (Egypt, Greece, Rome, Benin), historical analysis, sources", curriculum: "UK KS2 History" },
    { id: "geography-global", label: "Geography & Global Issues", icon: "", desc: "Climate, trade, population, natural disasters, sustainability", curriculum: "UK KS2 Geography" },
    { id: "coding-python", label: "Computing & Coding", icon: "", desc: "Scratch/Python, game design, web basics, data, digital citizenship", curriculum: "UK Computing KS2" },
    { id: "creative-writing", label: "Creative Writing", icon: "", desc: "Short stories, scripts, poetry, fan fiction, world-building", curriculum: "Common Core W.3-6" },
    { id: "visual-arts", label: "Visual Arts & Design", icon: "", desc: "Digital art, animation, graphic novels, perspective, mixed media", curriculum: "UK Art & Design KS2" },
    { id: "music-performance", label: "Music & Performance", icon: "", desc: "Composition, notation, instruments, songwriting, drama", curriculum: "UK Music KS2" },
    { id: "research-thinking", label: "Research & Thinking", icon: "", desc: "Multi-source research, fact-checking, presentations, debate", curriculum: "Montessori 9-12" },
    { id: "social-emotional-adv", label: "Social & Emotional", icon: "", desc: "Identity, empathy, conflict resolution, mental health literacy", curriculum: "UK PSHE KS2" },
    { id: "world-cultures", label: "World Cultures & Languages", icon: "", desc: "Global traditions, basic second language, cultural exchange", curriculum: "UK RE/MFL KS2" },
  ],
};

// ── Curriculum templates PER AGE GROUP ──
const CURRICULUM_BY_AGE: Record<string, Array<{ id: string; label: string; episodes: number; desc: string }>> = {
  toddler: [
    { id: "first-words-10", label: "First 50 Words", episodes: 10, desc: "Body, food, animals, family — 5 words per episode" },
    { id: "colours-5", label: "Learn All Colours", episodes: 5, desc: "Primary then secondary colours with objects" },
    { id: "counting-5", label: "Count to 5", episodes: 5, desc: "Numbers 1-5 with physical objects" },
    { id: "routines-7", label: "My Daily Routine", episodes: 7, desc: "Wake up, eat, play, bath, sleep — builds independence" },
    // ── Henry 2026-05-30: more templates per section ──
    { id: "abc-26", label: "A-to-Z in 26 Days", episodes: 26, desc: "One letter per episode with object + animal + action" },
    { id: "shapes-6", label: "Shape Story Time", episodes: 6, desc: "Circle, square, triangle, rectangle, star, heart" },
    { id: "action-songs-10", label: "Action Songs Album", episodes: 10, desc: "Wheels on the bus, head shoulders, if you're happy, more" },
    { id: "animal-sounds-12", label: "Animal Sounds Around World", episodes: 12, desc: "Farm, jungle, ocean, savanna, polar, pets" },
    { id: "feelings-faces-8", label: "Feelings Toolkit", episodes: 8, desc: "Name and act out 8 core feelings with stories" },
  ],
  preschool: [
    { id: "read30", label: "Learn to Read in 30 Days", episodes: 30, desc: "Letters → sounds → CVC words → sentences" },
    { id: "abc5", label: "Alphabet in 5 Songs", episodes: 5, desc: "Sing and learn A-Z with phonics" },
    { id: "phonics20", label: "Phonics in 20 Lessons", episodes: 20, desc: "Complete phonics: single letters → digraphs → blends" },
    { id: "numbers10", label: "Numbers to 20", episodes: 10, desc: "Count, write, add, subtract with manipulatives" },
    { id: "bilingual15", label: "Bilingual Words in 15 Episodes", episodes: 15, desc: "150 words in two languages" },
  ],
  early: [
    { id: "times-tables-12", label: "Times Tables Mastery", episodes: 12, desc: "2x through 12x with visual strategies" },
    { id: "reading-levels-20", label: "Reading Level Up", episodes: 20, desc: "CVC → blends → digraphs → chapter stories" },
    { id: "science-explore-10", label: "Science Explorer", episodes: 10, desc: "Plants, animals, forces, light, sound, habitats" },
    { id: "history-heroes-8", label: "History Heroes", episodes: 8, desc: "Rosa Parks, Neil Armstrong, Wole Soyinka, more" },
    { id: "coding-basics-10", label: "Coding for Kids", episodes: 10, desc: "Algorithms, sequences, loops, debugging — block-based" },
  ],
  older: [
    { id: "creative-writer-12", label: "Creative Writer Workshop", episodes: 12, desc: "Characters → plots → dialogue → editing → publish" },
    { id: "python-intro-15", label: "Python for Kids", episodes: 15, desc: "Variables, loops, functions, mini-games" },
    { id: "world-history-10", label: "World Civilisations", episodes: 10, desc: "Egypt, Greece, Rome, Mali, China, Maya — primary sources" },
    { id: "science-lab-12", label: "Science Lab", episodes: 12, desc: "Hypothesis → experiment → results — real method" },
    { id: "debate-club-8", label: "Think & Debate", episodes: 8, desc: "Argument structure, evidence, counter-arguments, presentations" },
    { id: "money-maths-6", label: "Real-World Maths", episodes: 6, desc: "Percentages, budgets, statistics, practical problem-solving" },
  ],
};

// ── Topic Suggestions PER age + content type ──
// These are curriculum-backed ready-to-use topics.
// When user selects a content type, they see these as clickable pills.
// Clicking one pre-fills the planner so user can just approve and go.
const TOPIC_SUGGESTIONS: Record<string, Record<string, Array<{ topic: string; prompt: string }>>> = {
  // ── TODDLERS (2-3) ──
  toddler: {
    "letters-sounds": [
      { topic: "A is for Apple", prompt: "Learn the letter A. Show a big red apple. A says 'ah'. A is for Apple, A is for Ant, A is for Airplane." },
      { topic: "B is for Ball", prompt: "Learn the letter B. Show a bouncing ball. B says 'buh'. B is for Ball, B is for Bird, B is for Banana." },
      { topic: "C is for Cat", prompt: "Learn the letter C. Show a friendly cat. C says 'kuh'. C is for Cat, C is for Cup, C is for Car." },
      { topic: "Sing the ABC", prompt: "Sing the alphabet song slowly. Show each letter big and colorful. A-B-C-D-E-F-G, H-I-J-K-L-M-N-O-P..." },
      { topic: "First Letter of My Name", prompt: "What letter does your name start with? Show common names and their first letters. A for Ada, B for Bola, C for Chidi." },
    ],
    "numbers-counting": [
      { topic: "Count 1-2-3", prompt: "Count to 3 with fingers. One apple, two apples, three apples. Hold up fingers. One! Two! Three!" },
      { topic: "How Many Animals?", prompt: "Count animals on the farm. One cow, two chickens, three goats. Point and count slowly together." },
      { topic: "One More, One Less", prompt: "Show 2 balls. Add one more — now there are 3! Take one away — now there are 2! More and less." },
      { topic: "Count to 5 Song", prompt: "Sing a counting song: 1-2-3-4-5, once I caught a fish alive. Show each number big with that many objects." },
    ],
    "colours-shapes": [
      { topic: "Red, Blue, Yellow", prompt: "Learn primary colours. A red ball, a blue sky, a yellow sun. Can you find something red? Point to something blue!" },
      { topic: "Circle and Square", prompt: "A circle is round like a ball. A square has four sides like a window. Find circles and squares around you!" },
      { topic: "Rainbow Colours", prompt: "Red, orange, yellow, green, blue — the colours of the rainbow! Show each colour with a familiar object." },
    ],
    "animals-nature": [
      { topic: "What Sound Does It Make?", prompt: "The cow says MOO. The dog says WOOF. The cat says MEOW. The duck says QUACK. Show each animal making its sound." },
      { topic: "Animals on the Farm", prompt: "Visit the farm! See the cow, the chicken, the goat, the pig, the horse. Each animal eats something different." },
      { topic: "Baby Animals", prompt: "A baby dog is a puppy. A baby cat is a kitten. A baby cow is a calf. Show cute baby animals with their parents." },
    ],
    "my-world": [
      { topic: "My Body Parts", prompt: "Head, shoulders, knees and toes. Eyes, ears, mouth and nose. Point to each body part. Touch your head! Touch your nose!" },
      { topic: "My Family", prompt: "This is Mama. This is Papa. This is baby. This is Grandma. Family means people who love you." },
      { topic: "Happy and Sad", prompt: "When I get a hug, I feel HAPPY. When my toy breaks, I feel SAD. Show happy face and sad face. It's OK to feel sad." },
      { topic: "Bath Time Routine", prompt: "First we fill the tub. Then we wash our hands. Then we wash our hair. Splash splash! Clean and fresh!" },
    ],
    "music-movement": [
      { topic: "Clap Your Hands", prompt: "Clap clap clap your hands! Stomp stomp stomp your feet! Shake shake shake your body! Dance dance dance around!" },
      { topic: "If You're Happy", prompt: "If you're happy and you know it, clap your hands! If you're happy and you know it, stomp your feet! Show actions." },
    ],
  },

  // ── PRE-SCHOOL (3-5) ──
  preschool: {
    "phonics": [
      { topic: "CVC Words: Cat, Sat, Hat", prompt: "Sound it out! C-A-T makes CAT. S-A-T makes SAT. H-A-T makes HAT. They all end with -AT. The -AT word family!" },
      { topic: "CVC Words: Pin, Bin, Tin", prompt: "P-I-N makes PIN. B-I-N makes BIN. T-I-N makes TIN. They all end with -IN. The -IN word family!" },
      { topic: "Sight Words: the, is, a", prompt: "Some words we learn by sight. THE — we see it everywhere. IS — the cat IS big. A — I have A ball. Practice reading these words." },
      { topic: "Rhyming Words", prompt: "Cat rhymes with hat. Dog rhymes with log. Fish rhymes with dish. Can you think of a word that rhymes with 'sun'? Run! Fun! Bun!" },
      { topic: "Beginning Sounds", prompt: "What sound does 'ball' start with? Buh! B! What about 'sun'? Sss! S! Listen to the first sound of each word." },
      { topic: "Blending Sounds", prompt: "Let's blend! D-O-G... put them together... DOG! C-U-P... CUP! R-E-D... RED! You're reading!" },
    ],
    "early-maths": [
      { topic: "Counting to 10", prompt: "Count with me! 1-2-3-4-5-6-7-8-9-10! Show each number with that many objects. Ten fingers, ten toes!" },
      { topic: "Simple Addition: 2+3", prompt: "Two apples plus three apples. Count them all together — 1, 2, 3, 4, 5! Two plus three equals five!" },
      { topic: "Patterns: AB AB", prompt: "Red blue red blue — what comes next? RED! Circle square circle square — what comes next? CIRCLE! Make your own pattern!" },
      { topic: "Shapes Around Us", prompt: "A clock is a circle. A door is a rectangle. A sandwich is a triangle. Look around — shapes are everywhere!" },
      { topic: "More and Fewer", prompt: "This basket has 5 oranges. This basket has 3. Which has MORE? 5 is more than 3. Which has FEWER? 3 is fewer than 5." },
      { topic: "Writing Numbers 1-5", prompt: "Let's write numbers! 1 is one straight line. 2 curves then goes straight. 3 has two bumps. 4 goes down and across. 5 goes across, down, and curves." },
    ],
    "stories": [
      { topic: "The Sharing Lesson", prompt: "Bola has two biscuits. Her friend Chidi has none. Bola gives one to Chidi. Now they both have one! Sharing makes everyone happy." },
      { topic: "The Lost Teddy", prompt: "Little Ama can't find her teddy bear. She looks under the bed — not there. Behind the chair — not there. In the garden — THERE it is! Ama is so happy." },
      { topic: "The Brave Little Bird", prompt: "A small bird is afraid to fly. All the other birds fly high. One day, the little bird tries. Flap flap flap — it's flying! Being brave means trying even when you're scared." },
    ],
    "science-discovery": [
      { topic: "How Plants Grow", prompt: "A seed goes in the soil. Add water and sunshine. A tiny sprout appears! Leaves grow. The plant gets bigger every day. Plants need water, sun, and soil." },
      { topic: "Weather: Sun, Rain, Wind", prompt: "The sun makes us warm. Rain falls from clouds and helps plants grow. Wind blows the trees. What's the weather like today?" },
      { topic: "My Five Senses", prompt: "I SEE with my eyes. I HEAR with my ears. I SMELL with my nose. I TASTE with my tongue. I TOUCH with my hands. Five senses!" },
      { topic: "Seasons of the Year", prompt: "Spring — flowers bloom. Summer — it's hot and sunny. Autumn — leaves fall down. Winter — it's cold. Four seasons go round and round." },
    ],
    "my-community": [
      { topic: "People Who Help Us", prompt: "The doctor makes us feel better. The teacher helps us learn. The firefighter keeps us safe. The police officer protects us. Who helps in your community?" },
      { topic: "Going to School", prompt: "Wake up, get dressed, eat breakfast. Walk to school with Mama. Say hello to teacher. Sit down, listen, learn. Playtime! Then home again." },
    ],
    "social-emotional": [
      { topic: "Taking Turns", prompt: "Ada wants the swing. Emeka wants the swing too. They take TURNS! Ada swings first, then Emeka. Taking turns is fair and kind." },
      { topic: "When I Feel Angry", prompt: "Sometimes I feel angry. My face gets hot. I want to shout. But I can take a deep breath. 1-2-3... breathe. Now I can use my words." },
      { topic: "Being a Good Friend", prompt: "A good friend shares. A good friend listens. A good friend helps when you fall down. A good friend makes you smile. You are a good friend!" },
    ],
    "creative-play": [
      { topic: "Let's Draw a House", prompt: "First draw a square — that's the wall. Add a triangle on top — that's the roof. Two squares for windows. One rectangle for the door. You drew a house!" },
    ],
    "cultural-awareness": [
      { topic: "Families Around the World", prompt: "In Italy, families share pasta together. In Japan, families eat with chopsticks. In Mexico, families make tamales. In India, families enjoy dal and rice. Every family is special!" },
      { topic: "Hello in Many Languages", prompt: "Hello! (English) Hola! (Spanish) Bonjour! (French) Ciao! (Italian) Olá! (Portuguese) Marhaba! (Arabic) Konnichiwa! (Japanese) Say hello to the world!" },
    ],
  },

  // ── EARLY SCHOOL (5-8) ──
  early: {
    "reading-writing": [
      { topic: "Digraphs: SH, CH, TH", prompt: "SH makes the 'shh' sound — ship, shop, fish. CH makes the 'ch' sound — chip, chat, much. TH makes the 'th' sound — this, that, with." },
      { topic: "Writing a Sentence", prompt: "A sentence starts with a CAPITAL letter. It ends with a FULL STOP. 'The cat sat on the mat.' Capital T, full stop at the end. Your turn!" },
      { topic: "Story Writing: Beginning", prompt: "Every story needs a beginning. 'Once upon a time...' or 'One sunny morning...' Set the scene! Who is in your story? Where are they?" },
      { topic: "Adjectives Make It Better", prompt: "The dog ran. The BIG, BROWN dog ran QUICKLY. Adjectives describe things — big, small, red, happy, scary, beautiful. Add adjectives to make your writing sparkle!" },
    ],
    "mathematics": [
      { topic: "Times Tables: 2x", prompt: "2x1=2, 2x2=4, 2x3=6, 2x4=8, 2x5=10. Count by twos: 2, 4, 6, 8, 10, 12! The 2 times table is like counting pairs." },
      { topic: "Times Tables: 5x", prompt: "5x1=5, 5x2=10, 5x3=15, 5x4=20. The 5 times table always ends in 5 or 0! Count by fives on the clock face." },
      { topic: "Telling Time", prompt: "The short hand shows the hour. The long hand shows the minutes. When the long hand points to 12, it's o'clock. 3 o'clock means the short hand is on 3." },
      { topic: "Fractions: Half and Quarter", prompt: "Cut a pizza in 2 equal pieces — each piece is ONE HALF (1/2). Cut it in 4 equal pieces — each piece is ONE QUARTER (1/4). Half is bigger than a quarter!" },
      { topic: "Simple Addition to 20", prompt: "8 + 5 = ? Start at 8, count up 5 more: 9, 10, 11, 12, 13! So 8 + 5 = 13. Try: 7 + 6 = ? Start at 7, count 6: 8, 9, 10, 11, 12, 13!" },
      { topic: "Money: Coins and Notes", prompt: "1 coin = 1 unit. 5 coins = 5 units. If a sweet costs 3 and you have 5, how much change? 5 - 3 = 2 change!" },
    ],
    "science": [
      { topic: "States of Matter", prompt: "ICE is solid — hard and cold. WATER is liquid — it flows and pours. STEAM is gas — it floats in the air. Heat changes matter: ice → water → steam!" },
      { topic: "The Solar System", prompt: "The Sun is a star at the centre. Mercury, Venus, Earth, Mars — the rocky planets. Jupiter, Saturn — the gas giants. Earth is our home — the only planet with life!" },
      { topic: "How Sound Works", prompt: "Sound is vibration! Pluck a guitar string — it vibrates and makes sound. Hit a drum — the skin vibrates. Sound travels through air to your ears." },
      { topic: "Food Chains", prompt: "Grass → Rabbit → Fox. The grass makes food from sunlight. The rabbit eats the grass. The fox eats the rabbit. Every living thing is connected!" },
    ],
    "history-people": [
      { topic: "Who Was Rosa Parks?", prompt: "In 1955, Rosa Parks refused to give up her bus seat. She was tired of unfair rules. Her bravery helped change the law. One person can make a big difference." },
      { topic: "Ancient Egypt", prompt: "5000 years ago, people built pyramids in Egypt. The pharaohs were kings. They wrote with pictures called hieroglyphs. The River Nile gave them water and food." },
    ],
    "geography": [
      { topic: "The 7 Continents", prompt: "Africa, Asia, Europe, North America, South America, Antarctica, Oceania. Africa is the second largest. Asia is the biggest. Antarctica is covered in ice!" },
      { topic: "Water Cycle", prompt: "The sun heats water → it evaporates into the sky → clouds form → rain falls → water flows to rivers → back to the ocean → and the cycle starts again!" },
    ],
    "computing-logic": [
      { topic: "What Is an Algorithm?", prompt: "An algorithm is a set of steps. Like a recipe! Step 1: Get bread. Step 2: Spread butter. Step 3: Add jam. Step 4: Eat! Computers follow algorithms too." },
      { topic: "Loops: Repeat!", prompt: "A loop repeats instructions. 'Jump 3 times' is a loop — jump, jump, jump! Computers use loops to do things many times without writing the same instruction over and over." },
    ],
    "stories-literature": [
      { topic: "Adventure Story: The Hidden Map", prompt: "Kemi finds an old map in Grandpa's attic. X marks a spot in the garden. She digs and finds... a time capsule from 50 years ago! What's inside?" },
      { topic: "Mystery: Who Ate the Cake?", prompt: "Mama baked a cake for the party. But someone ate a piece! Crumbs on the floor lead to... the kitchen. Chocolate on someone's face. Who ate the cake? Let's find clues!" },
    ],
    "health-wellbeing": [
      { topic: "Healthy Eating Plate", prompt: "Half your plate should be fruits and vegetables. A quarter is grains (rice, bread). A quarter is protein (beans, fish, eggs). Drink water! Your body needs good fuel." },
    ],
    "arts-music": [
      { topic: "Primary and Secondary Colours", prompt: "Red + Yellow = ORANGE. Red + Blue = PURPLE. Yellow + Blue = GREEN. Mix primary colours to make new ones! Try mixing colours with paint." },
    ],
    "projects-making": [
      { topic: "Build a Paper Bridge", prompt: "Can paper hold a book? Fold paper different ways — flat, zigzag, rolled into a tube. Which shape is strongest? Engineers test designs like this!" },
    ],
  },

  // ── OLDER KIDS (8-12) ──
  older: {
    "language-arts": [
      { topic: "Persuasive Writing", prompt: "Should students have less homework? Write your argument. State your opinion. Give 3 reasons with evidence. Address the other side. Strong conclusion!" },
      { topic: "Poetry: Haiku", prompt: "A haiku has 3 lines: 5 syllables, 7 syllables, 5 syllables. 'An old silent pond / A frog jumps into the pond / Splash! Silence again.' Write your own!" },
      { topic: "News Report Writing", prompt: "A news report answers: WHO, WHAT, WHEN, WHERE, WHY. Write a news report about something that happened at school. Use quotes from people involved." },
    ],
    "advanced-maths": [
      { topic: "Fractions to Decimals", prompt: "1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, 1/10 = 0.1. Divide the top by the bottom! 1 divided by 4 = 0.25. Fractions and decimals are two ways to show the same thing." },
      { topic: "Percentages in Real Life", prompt: "25% off means you save 1/4 of the price. A shirt costs 40 — 25% off = 40 × 0.25 = 10 saved. You pay 30! Percentages are everywhere — sales, scores, recipes." },
      { topic: "Introduction to Algebra", prompt: "x + 3 = 7. What is x? Think: what number plus 3 equals 7? x = 4! Algebra uses letters for unknown numbers. Solve: x + 5 = 12. x = ?" },
      { topic: "Area and Perimeter", prompt: "Perimeter = distance around the edge. A rectangle 4m × 3m: perimeter = 4+3+4+3 = 14m. Area = space inside. Area = 4 × 3 = 12 square metres." },
    ],
    "science-engineering": [
      { topic: "Electricity: Simple Circuits", prompt: "A circuit needs: a battery (power), wires (path), and a bulb (load). Connect them in a loop — the bulb lights up! Break the loop — it goes off. That's a switch!" },
      { topic: "Forces: Gravity and Friction", prompt: "Gravity pulls everything down. Drop a ball — gravity pulls it to the ground. Friction slows things down. Rub your hands together — that's friction making heat!" },
      { topic: "Evolution: How Species Change", prompt: "Animals that fit their environment survive and have babies. Over millions of years, small changes add up. Giraffes with longer necks could reach more food — so long necks became common." },
      { topic: "Design Challenge: Egg Drop", prompt: "Can you protect an egg from a 2-metre drop? Use paper, tape, straws, cotton wool. Design, build, test! Engineers go through the same process: design → prototype → test → improve." },
    ],
    "history-civilisations": [
      { topic: "Ancient Greece: Democracy", prompt: "2500 years ago in Athens, citizens voted on laws directly — the first democracy. But only men could vote, not women or enslaved people. How has democracy changed since?" },
      { topic: "The Kingdom of Benin", prompt: "The Kingdom of Benin in West Africa was powerful for 700 years. They made beautiful bronze sculptures traded across the world. They had a skilled army and a king called the Oba." },
      { topic: "The Maya Civilisation", prompt: "The Maya built pyramids in Central America. They had advanced mathematics — they invented zero! They had a complex writing system with over 800 symbols. They studied the stars." },
    ],
    "geography-global": [
      { topic: "Climate Change Explained", prompt: "Burning fossil fuels releases CO2. CO2 traps heat in the atmosphere — like a greenhouse. Earth gets warmer. Ice melts, sea levels rise, weather becomes extreme. What can we do?" },
      { topic: "World Trade: Where Things Come From", prompt: "Your phone has minerals from Congo, chips from Taiwan, assembly in China, design from USA. Bananas come from Ecuador. Chocolate from Ghana. Everything is connected globally." },
    ],
    "coding-python": [
      { topic: "Variables in Python", prompt: "A variable stores information. name = 'Kemi'. age = 10. print(name) shows Kemi. print(age) shows 10. Variables can change: age = 11. Now age shows 11!" },
      { topic: "Loops in Python", prompt: "A for loop repeats code. for i in range(5): print('Hello!') — this prints Hello 5 times! Loops save you from writing the same thing over and over." },
      { topic: "Build a Quiz Game", prompt: "Ask a question with input(). Check the answer with if/else. Keep score with a variable. score = 0. If correct: score = score + 1. Print final score at the end!" },
    ],
    "creative-writing": [
      { topic: "Fantasy World Building", prompt: "Create a world! What are the rules? Is there magic? Who lives there? What's the conflict? Draw a map. Name the places. Every great story starts with a great world." },
      { topic: "Write a Short Film Script", prompt: "INT. CLASSROOM - DAY. A student finds a mysterious note in their desk. They look around — nobody claims it. The note says: 'Meet me at the old tree at 3pm.' What happens next?" },
    ],
    "visual-arts": [
      { topic: "Comic Strip Creation", prompt: "A comic strip tells a story in panels. Panel 1: Set the scene. Panel 2: Something happens. Panel 3: The reaction. Panel 4: The punchline or resolution. Draw your own 4-panel comic!" },
    ],
    "research-thinking": [
      { topic: "Fact vs Opinion", prompt: "FACT: Water boils at 100°C. OPINION: Water tastes better cold. Facts can be proven. Opinions are what someone thinks. Can you tell which is which? 'Dogs are the best pets' — fact or opinion?" },
      { topic: "How to Research", prompt: "Step 1: Ask a question. Step 2: Find 3 different sources. Step 3: Check if sources agree. Step 4: Take notes in your own words. Step 5: Present what you learned." },
    ],
    "social-emotional-adv": [
      { topic: "Growth Mindset", prompt: "Instead of 'I can't do it' — say 'I can't do it YET.' Your brain grows stronger when you practice hard things. Mistakes are how we learn. Struggle means you're growing!" },
      { topic: "Digital Citizenship", prompt: "Think before you post. Would you say it to someone's face? Once it's online, it stays online. Protect your personal info. Be kind online — there's a real person on the other side." },
    ],
    "music-performance": [
      { topic: "Songwriting Basics", prompt: "A song has verses and a chorus. The chorus repeats and is the catchy part. Start with a feeling or story. Write the chorus first. Then build verses around it." },
    ],
    "world-cultures": [
      { topic: "Festivals Around the World", prompt: "Diwali (India) — festival of lights. Eid (Muslim world) — celebration after fasting. Christmas (worldwide) — giving and family. Carnival (Brazil) — music and dance. Every culture celebrates!" },
    ],
  },
};

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "pt", label: "Portuguese", flag: "🇧🇷" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "zh", label: "Mandarin", flag: "🇨🇳" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
  { code: "tw", label: "Twi", flag: "🇬🇭" },
  { code: "sw", label: "Swahili", flag: "🇰🇪" },
  { code: "zu", label: "Zulu", flag: "🇿🇦" },
  { code: "am", label: "Amharic", flag: "🇪🇹" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
];

const surface = ds.color.card;
const border = ds.color.line2;
const muted = ds.color.mute;
const childAccent = ds.color.lilac;
const childSafe = ds.color.mint;

interface SavedCharacter {
  id: string;
  name: string;
  role?: string;
  voiceId?: string;
}

interface PastProject {
  id: string;
  title: string;
  contentType: string;
  ageGroup: string;
  createdAt: string;
}

export default function ChildrenVideoPage() {
  const [branch, setBranch] = useState<"" | "video" | "hybrid">("");
  const [contentType, setContentType] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [primaryLang, setPrimaryLang] = useState("en");
  const [secondLang, setSecondLang] = useState("");
  const [aiTier, setAiTier] = useState<AITier>("pro");
  const [videoModel, setVideoModel] = useState("fal_wan_lite");
  const [imageModel, setImageModel] = useState("fal_flux_schnell");
  const [duration, setDuration] = useState("60 sec");
  const [showCurriculum, setShowCurriculum] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [showAgeInfo, setShowAgeInfo] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ topic: string; prompt: string } | null>(null);

  // ── Character import from DB ──
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [showCharacters, setShowCharacters] = useState(false);

  // ── Smart suggestions from DB ──
  const [pastProjects, setPastProjects] = useState<PastProject[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load characters and past projects when branch is selected
  useEffect(() => {
    if (branch) {
      // Load saved characters
      fetch("/api/character-voices")
        .then(r => r.ok ? r.json() : { voices: [] })
        .then(data => setCharacters((data.voices || []).map((v: { id: string; name: string; defaultRole?: string; voiceId?: string }) => ({
          id: v.id, name: v.name, role: v.defaultRole, voiceId: v.voiceId,
        }))))
        .catch(() => {});

      // Load past children projects for smart suggestions
      fetch("/api/movie-planner/project")
        .then(r => r.ok ? r.json() : { projects: [] })
        .then(data => {
          const childProjects = (data.projects || [])
            .filter((p: { title?: string }) => p.title?.toLowerCase().includes("child") || p.title?.toLowerCase().includes("kid") || p.title?.toLowerCase().includes("abc") || p.title?.toLowerCase().includes("phonics") || p.title?.toLowerCase().includes("counting"))
            .slice(0, 5);
          setPastProjects(childProjects);
        })
        .catch(() => {});
    }
  }, [branch]);

  // Get content types for current age group
  const currentContentTypes = ageGroup ? (CONTENT_BY_AGE[ageGroup] || []) : [];
  const currentCurriculum = ageGroup ? (CURRICULUM_BY_AGE[ageGroup] || []) : [];
  const currentAgeConfig = AGE_GROUPS.find(a => a.id === ageGroup);

  // Get topic suggestions for current age + content type
  const currentTopics = (ageGroup && contentType && TOPIC_SUGGESTIONS[ageGroup])
    ? (TOPIC_SUGGESTIONS[ageGroup][contentType] || [])
    : [];

  const toggleCharacter = (id: string) => {
    setSelectedCharacters(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ fontFamily: ds.font.sans }}>
      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <HeroTitle
          kicker="Child-Safe Mode"
          title="AI Children"
          italic="Video"
          sub="Curriculum-backed educational content. Content adapts per age group — toddlers see different options than older kids. AI ensures every frame is child-appropriate."
        />
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {[
            { label: "2-Stage Review", color: childSafe },
            { label: "Multi-Language", color: childAccent },
            { label: "Curriculum Standards", color: ds.color.gold },
            { label: "EYFS / Common Core / IB", color: ds.color.sky },
          ].map(b => (
            <span key={b.label} style={{ fontSize: 9, padding: "3px 10px", borderRadius: 8, background: `${b.color}12`, color: b.color, border: `1px solid ${b.color}33`, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>{b.label}</span>
          ))}
        </div>
      </div>

      {/* ═══ STEP 1: Choose Branch — Video or Hybrid ═══ */}
      {!branch && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            {/* Children Video */}
            <button onClick={() => setBranch("video")}
              style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: 28, cursor: "pointer", textAlign: "left", transition: "all 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.4)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = border; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(168,85,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 14 }}></div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Children Video</h3>
              <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginBottom: 12 }}>
                Animated, active content with motion. ABC videos, phonics with movement, counting animations, mini children movies, nursery content with characters.
              </p>
              <span style={{ fontSize: 11, color: childAccent, fontWeight: 600 }}>Active + Animated</span>
            </button>

            {/* Children Hybrid */}
            <button onClick={() => setBranch("hybrid")}
              style={{ background: surface, border: `2px solid rgba(34,197,94,0.25)`, borderRadius: 20, padding: 28, cursor: "pointer", textAlign: "left", transition: "all 0.3s", position: "relative" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,197,94,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,197,94,0.25)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
              <span style={{ position: "absolute", top: -1, right: 20, background: childSafe, color: "#000", fontSize: 9, fontWeight: 800, padding: "3px 12px", borderRadius: "0 0 8px 8px" }}>RECOMMENDED</span>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 14 }}></div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Children Hybrid</h3>
              <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginBottom: 12 }}>
                Storybook-style with read-along. Image + narration + text highlighting. Best for reading, poems, stories, bedtime. Lower cost, high educational value.
              </p>
              <span style={{ fontSize: 11, color: childSafe, fontWeight: 600 }}>Read-Along + Storybook</span>
            </button>
          </div>

          {/* AI-generated sample images */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#3d5060", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              AI-generated children illustrations
              <span style={{ flex: 1, height: 1, background: border }} />
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {[
                { src: "/api/media/demo/child_abc.png", label: "ABC Letters" },
                { src: "/api/media/demo/child_counting.png", label: "Counting" },
                { src: "/api/media/demo/child_colors.png", label: "Colors" },
                { src: "/api/media/demo/child_story.png", label: "Storybook" },
                { src: "/api/media/demo/child_nursery.png", label: "Nursery" },
              ].map(img => (
                <div key={img.label} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${border}`, background: surface }}>
                  <img src={img.src} alt={img.label} style={{ width: "100%", height: 90, objectFit: "cover" }} />
                  <p style={{ fontSize: 9, color: "#fff", fontWeight: 500, padding: "6px 8px", textAlign: "center" }}>{img.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sample videos */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#3d5060", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              Sample children content — click to play with sound
              <span style={{ flex: 1, height: 1, background: border }} />
            </p>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {[
                { title: "ABC + Counting + Colors", type: "Full Demo", badge: "Text + Voice + Music" },
                { title: "Storybook Style", type: "Read-Along", badge: "Hybrid" },
                { title: "Image Story", type: "Budget", badge: "Hybrid" },
              ].map(v => (
                <div key={v.title} style={{ flexShrink: 0, width: 220, borderRadius: 14, overflow: "hidden", border: `1px solid ${border}`, background: surface, position: "relative" }}>
                  <div style={{ height: 120, background: "rgba(168,85,247,0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(168,85,247,0.15)", border: `1px solid rgba(168,85,247,0.3)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "rgba(168,85,247,0.6)", fontSize: 16 }}>▶</span>
                    </div>
                    <span style={{ fontSize: 9, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Demo Coming Soon</span>
                  </div>
                  <span style={{ position: "absolute", top: 6, left: 6, fontSize: 7, padding: "2px 6px", borderRadius: 6, background: v.badge === "Hybrid" ? "rgba(34,197,94,0.85)" : "rgba(168,85,247,0.85)", color: "#fff", fontWeight: 700 }}>{v.badge}</span>
                  <div style={{ padding: "10px 12px" }}>
                    <p style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{v.title}</p>
                    <p style={{ fontSize: 9, color: muted }}>{v.type}</p>
                    <p style={{ fontSize: 8, color: "#6b7280", marginTop: 4 }}>Sample videos coming soon — use the planner to create your own children&apos;s story</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══ STEP 2: Content Setup — AGE-TOGGLED ═══ */}
      {branch && (
        <div>
          <button onClick={() => { setBranch(""); setAgeGroup(""); setContentType(""); setSelectedCharacters([]); setSelectedTopic(null); }} style={{ fontSize: 11, color: muted, background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>
            ← Back to branch selection
          </button>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>{branch === "video" ? "" : ""}</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Children {branch === "video" ? "Video" : "Hybrid"}</h2>
                <p style={{ fontSize: 11, color: muted }}>{branch === "video" ? "Animated, active learning content" : "Read-along storybook with text highlighting"}</p>
              </div>
            </div>

            {/* ── Age Group Selector — TOGGLES EVERYTHING BELOW ── */}
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>
              Age Group (changes what you can create below)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
              {AGE_GROUPS.map(a => (
                <button key={a.id} onClick={() => { setAgeGroup(a.id); setContentType(""); setSelectedTopic(null); setShowAgeInfo(true); }}
                  style={{ padding: "14px 10px", borderRadius: 12, border: `1px solid ${ageGroup === a.id ? childAccent : border}`, background: ageGroup === a.id ? `${childAccent}10` : "transparent", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: ageGroup === a.id ? childAccent : "#fff" }}>{a.label}</p>
                  <p style={{ fontSize: 10, color: muted }}>{a.age}</p>
                </button>
              ))}
            </div>

            {/* Age group info panel */}
            {currentAgeConfig && showAgeInfo && (
              <div style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: childAccent, marginBottom: 6 }}>
                      {currentAgeConfig.label} ({currentAgeConfig.age}) — Curriculum: {currentAgeConfig.curriculum}
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <p style={{ fontSize: 10, color: muted }}><strong style={{ color: "#fff" }}>Max video:</strong> {Math.round(currentAgeConfig.config.maxDuration / 60)} min</p>
                      <p style={{ fontSize: 10, color: muted }}><strong style={{ color: "#fff" }}>Word level:</strong> {currentAgeConfig.config.wordLevel}</p>
                      <p style={{ fontSize: 10, color: muted }}><strong style={{ color: "#fff" }}>Pacing:</strong> {currentAgeConfig.config.pacing}</p>
                      <p style={{ fontSize: 10, color: muted }}><strong style={{ color: "#fff" }}>Visual:</strong> {currentAgeConfig.visualStyle.slice(0, 60)}...</p>
                    </div>
                    <p style={{ fontSize: 9, color: childSafe, marginTop: 6 }}>Safety: {currentAgeConfig.safety}</p>
                  </div>
                  <button onClick={() => setShowAgeInfo(false)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            )}

            {/* ── Smart Suggestions from DB ── */}
            {pastProjects.length > 0 && ageGroup && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setShowSuggestions(!showSuggestions)}
                  style={{ fontSize: 11, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: showSuggestions ? 8 : 0 }}>
                  <span style={{ fontSize: 14 }}></span>
                  {showSuggestions ? "Hide suggestions" : `You have ${pastProjects.length} past children projects — Continue or try something new?`}
                </button>
                {showSuggestions && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {pastProjects.map(p => (
                      <div key={p.id} style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{p.title}</p>
                          <p style={{ fontSize: 9, color: muted }}>Continue this series?</p>
                        </div>
                        <a href={`/dashboard/children-planner?continue=${p.id}`}
                          style={{ fontSize: 9, padding: "4px 10px", borderRadius: 8, background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
                          Continue
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Content Type Grid — CHANGES PER AGE GROUP ── */}
            {ageGroup ? (
              <>
                <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 4 }}>
                  What to create — for {currentAgeConfig?.label} ({currentAgeConfig?.age})
                </p>
                <p style={{ fontSize: 9, color: "#3d5060", marginBottom: 10 }}>
                  {currentContentTypes.length} content types based on {currentAgeConfig?.curriculum}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
                  {currentContentTypes.map(c => (
                    <button key={c.id} onClick={() => { setContentType(c.id); setSelectedTopic(null); }}
                      style={{ padding: "12px 10px", borderRadius: 12, border: `1px solid ${contentType === c.id ? childAccent : border}`, background: contentType === c.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                      <span style={{ fontSize: 20, display: "block", marginBottom: 4 }}>{c.icon}</span>
                      <p style={{ fontSize: 11, fontWeight: 600, color: contentType === c.id ? childAccent : "#fff" }}>{c.label}</p>
                      <p style={{ fontSize: 8, color: muted, lineHeight: 1.4 }}>{c.desc}</p>
                      <p style={{ fontSize: 7, color: "#3d5060", marginTop: 3 }}>{c.curriculum}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 0", marginBottom: 20 }}>
                <p style={{ fontSize: 14, color: muted }}>Select an age group above to see available content types</p>
                <p style={{ fontSize: 10, color: "#3d5060", marginTop: 4 }}>Each age group shows different options based on curriculum standards</p>
              </div>
            )}

            {/* ── Topic Suggestions — appears after content type selection ── */}
            {contentType && currentTopics.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#3b82f6", marginBottom: 4 }}>
                  Suggested topics — click one or type your own in the planner
                </p>
                <p style={{ fontSize: 9, color: "#3d5060", marginBottom: 10 }}>
                  These are curriculum-backed topics for {currentAgeConfig?.label}. Select one to pre-fill the planner, or skip and write your own.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {currentTopics.map((t, i) => (
                    <button key={i} onClick={() => setSelectedTopic(selectedTopic?.topic === t.topic ? null : t)}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        border: `1px solid ${selectedTopic?.topic === t.topic ? "#3b82f6" : border}`,
                        background: selectedTopic?.topic === t.topic ? "rgba(59,130,246,0.1)" : "transparent",
                        cursor: "pointer", textAlign: "left", maxWidth: 260, transition: "all 0.2s",
                      }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: selectedTopic?.topic === t.topic ? "#3b82f6" : "#fff" }}>{t.topic}</p>
                      <p style={{ fontSize: 8, color: muted, lineHeight: 1.4, marginTop: 2 }}>{t.prompt.slice(0, 80)}...</p>
                    </button>
                  ))}
                </div>
                {selectedTopic && (
                  <div style={{ marginTop: 10, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", marginBottom: 4 }}>Selected: {selectedTopic.topic}</p>
                    <p style={{ fontSize: 10, color: "#c0c8d0", lineHeight: 1.6 }}>{selectedTopic.prompt}</p>
                    <p style={{ fontSize: 8, color: "#3d5060", marginTop: 6 }}>This will pre-fill the planner. You can edit it before generating.</p>
                  </div>
                )}
                {currentTopics.length === 0 && contentType && (
                  <p style={{ fontSize: 10, color: muted, padding: "8px 0" }}>No pre-built topics for this combination yet. You can type your own in the planner.</p>
                )}
              </div>
            )}

            {/* ── Character Import ── */}
            {ageGroup && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setShowCharacters(!showCharacters)}
                  style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, background: "none", border: "none", cursor: "pointer", marginBottom: showCharacters ? 10 : 0, display: "flex", alignItems: "center", gap: 8 }}>
                  Characters (optional — use saved characters)
                  <span style={{ fontSize: 9, color: childAccent }}>{selectedCharacters.length > 0 ? `${selectedCharacters.length} selected` : ""}</span>
                </button>
                {showCharacters && (
                  <div>
                    {characters.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {characters.map(ch => (
                          <button key={ch.id} onClick={() => toggleCharacter(ch.id)}
                            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${selectedCharacters.includes(ch.id) ? childAccent : border}`, background: selectedCharacters.includes(ch.id) ? `${childAccent}10` : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}></span>
                            <div style={{ textAlign: "left" }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: selectedCharacters.includes(ch.id) ? childAccent : "#fff" }}>{ch.name}</p>
                              {ch.role && <p style={{ fontSize: 8, color: muted }}>{ch.role}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <p style={{ fontSize: 11, color: muted }}>No saved characters yet.</p>
                        <a href="/dashboard/character-voices" style={{ fontSize: 10, color: childAccent, textDecoration: "underline" }}>Create characters</a>
                      </div>
                    )}
                    <p style={{ fontSize: 9, color: "#3d5060", marginTop: 6 }}>
                      Tip: For children series, use the same character across episodes (a friendly teacher bear, a counting robot, etc.)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Language Selection ── */}
            {ageGroup && (
              <>
                <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>
                  Language (add second language for <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "1px 6px", borderRadius: 4 }}>bilingual</span> learning)
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>Primary Language</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {LANGUAGES.slice(0, 12).map(l => (
                        <button key={l.code} onClick={() => setPrimaryLang(l.code)}
                          style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${primaryLang === l.code ? childAccent : border}`, background: primaryLang === l.code ? `${childAccent}10` : "transparent", cursor: "pointer", fontSize: 10, color: primaryLang === l.code ? childAccent : muted, display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{l.flag}</span> {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "#f59e0b", marginBottom: 6 }}>Second Language (bilingual — optional)</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <button onClick={() => setSecondLang("")}
                        style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${!secondLang ? childSafe : border}`, background: !secondLang ? `${childSafe}10` : "transparent", cursor: "pointer", fontSize: 10, color: !secondLang ? childSafe : muted }}>
                        None
                      </button>
                      {LANGUAGES.filter(l => l.code !== primaryLang).slice(0, 11).map(l => (
                        <button key={l.code} onClick={() => setSecondLang(l.code)}
                          style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${secondLang === l.code ? "#f59e0b" : border}`, background: secondLang === l.code ? "rgba(245,158,11,0.1)" : "transparent", cursor: "pointer", fontSize: 10, color: secondLang === l.code ? "#f59e0b" : muted, display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{l.flag}</span> {l.label}
                        </button>
                      ))}
                    </div>
                    {secondLang && (
                      <p style={{ fontSize: 9, color: "#f59e0b", marginTop: 6 }}>
                        Bilingual mode: Words shown in both {LANGUAGES.find(l => l.code === primaryLang)?.label} and {LANGUAGES.find(l => l.code === secondLang)?.label}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Curriculum Templates — PER AGE GROUP ── */}
            {ageGroup && currentCurriculum.length > 0 && (
              <>
                <button onClick={() => setShowCurriculum(!showCurriculum)}
                  style={{ fontSize: 11, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", marginBottom: showCurriculum ? 12 : 0, textDecoration: "underline" }}>
                  {showCurriculum ? "Hide curriculum templates" : `View Curriculum Templates for ${currentAgeConfig?.label} (${currentCurriculum.length} learning paths)`}
                </button>
                {showCurriculum && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {currentCurriculum.map(c => (
                      <div key={c.id} style={{ background: "rgba(245,158,11,0.03)", border: `1px solid rgba(245,158,11,0.15)`, borderRadius: 12, padding: 16 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{c.label}</p>
                        <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>{c.desc}</p>
                        <span style={{ fontSize: 9, color: "#f59e0b" }}>{c.episodes} episodes</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Safety notice */}
            <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}></span>
                <p style={{ fontSize: 12, fontWeight: 600, color: childSafe }}>Child Safety Active</p>
              </div>
              <p style={{ fontSize: 10, color: muted, lineHeight: 1.6 }}>
                All content passes through the Child-Safe Planner. AI blocks inappropriate visuals, sounds, and text. Two mandatory reviews before any content can be published — first review checks the plan, second review checks the final output.
                {currentAgeConfig && (
                  <span style={{ display: "block", marginTop: 4, color: childSafe }}>
                    {currentAgeConfig.label} safety: {currentAgeConfig.safety}
                  </span>
                )}
              </p>
            </div>

            {/* ── AI + Model + Duration row ── */}
            <div style={{ background: "#0a0f1a", border: "1px solid #1e2a3a", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#5a7080" }}>Generation Settings</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#5a7080", width: 80, flexShrink: 0 }}>AI Model</span>
                  <AITierSelector value={aiTier} onChange={setAiTier} compact />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#5a7080", width: 80, flexShrink: 0 }}>Duration</span>
                  <div style={{ flex: 1 }}>
                    <DurationPicker preset="short" value={duration} onChange={(label: string) => setDuration(label)} label="" accentColor={childAccent} compact />
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#5a7080", display: "block", marginBottom: 6 }}>Video & Image Models</span>
                  <ModelPicker videoModel={videoModel} imageModel={imageModel}
                    onVideoChange={setVideoModel} onImageChange={setImageModel}
                    accentColor={childAccent} compact />
                </div>
              </div>
            </div>

            {/* ── Next button ──
                Henry 2026-05-30: previously omitted projectId → planner fell back to the
                shared "ghs_children_default" project for EVERY user → Henry's selections
                landed on top of someone else's work. Now we mint a fresh ID per page render
                so each navigation = a new project. Multi-tab: tab A and tab B render at
                different timestamps → independent projects. */}
            <a href={`/dashboard/children-planner?projectId=child_${Date.now()}_${Math.random().toString(36).slice(2,6)}&branch=${branch}&content=${contentType}&age=${ageGroup}&lang=${primaryLang}&lang2=${secondLang}&characters=${selectedCharacters.join(",")}&topic=${encodeURIComponent(selectedTopic?.topic || "")}&topicPrompt=${encodeURIComponent(selectedTopic?.prompt || "")}&tier=${aiTier}&videoModel=${videoModel}&imageModel=${imageModel}&duration=${encodeURIComponent(duration)}`}
              style={{ textDecoration: "none" }}>
              <button disabled={!contentType || !ageGroup}
                style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (contentType && ageGroup) ? childAccent : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (contentType && ageGroup) ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
                {!ageGroup ? "Select an age group first" : !contentType ? "Select what to create" : `Open ${currentAgeConfig?.label} Planner`}
              </button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
