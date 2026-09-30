'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Semantic Similarity
   ai/similarity/similarityEngine.js

   Uses TF-IDF weighted term vectors and cosine similarity
   to compare solutions, problems and capabilities.
   No external API required.
   ============================================================ */

/* ── Text tokenisation ──────────────────────────────────────── */
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','being','have',
  'has','had','do','does','did','will','would','could','should','may',
  'might','must','shall','can','need','dare','ought','used','it','its',
  'this','that','these','those','they','we','you','i','my','our','your',
  'their','there','here','where','when','how','what','which','who','whom',
  'not','no','nor','so','yet','both','either','neither','each','every',
  'all','any','few','more','most','other','some','such','than','then',
  'only','own','same','too','very','just','because','if','while','during',
  'before','after','above','below','between','through','into','about',
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s₹%-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function bigramTokenize(text) {
  const tokens = tokenize(text);
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return [...tokens, ...bigrams];
}

/* ── TF-IDF ─────────────────────────────────────────────────── */
function termFrequency(tokens) {
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  const max = Math.max(...Object.values(tf), 1);
  Object.keys(tf).forEach(t => { tf[t] = tf[t] / max; });
  return tf;
}

function buildIDF(documents) {
  const docCount = documents.length;
  const df = {};
  documents.forEach(doc => {
    const unique = new Set(doc);
    unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
  });
  const idf = {};
  Object.keys(df).forEach(t => {
    idf[t] = Math.log((docCount + 1) / (df[t] + 1)) + 1;
  });
  return idf;
}

function tfidfVector(tokens, idf) {
  const tf = termFrequency(tokens);
  const vec = {};
  Object.keys(tf).forEach(t => {
    vec[t] = tf[t] * (idf[t] || 1);
  });
  return vec;
}

/* ── Cosine similarity ──────────────────────────────────────── */
function cosineSimilarity(vecA, vecB) {
  const keysA = Object.keys(vecA);
  const keysB = new Set(Object.keys(vecB));

  let dot = 0;
  let magA = 0;
  let magB = 0;

  keysA.forEach(k => {
    dot += vecA[k] * (vecB[k] || 0);
    magA += vecA[k] ** 2;
  });

  Object.values(vecB).forEach(v => { magB += v ** 2; });

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;
  return Math.min(1, dot / magnitude);
}

/* ── Solution text builders ─────────────────────────────────── */
function solutionText(solution) {
  return [
    solution.title || '',
    solution.desc || '',
    solution.tagline || '',
    solution.approach || '',
    (solution.tech || []).join(' '),
    (solution.strengths || []).join(' '),
  ].join(' ');
}

function problemText(problem) {
  return [
    problem.title || '',
    problem.desc || '',
    problem.constraints || '',
    problem.expected_outcome || '',
    (problem.tags || []).join(' '),
  ].join(' ');
}

/* ── Shared concept extraction ──────────────────────────────── */
const DOMAIN_CONCEPTS = {
  'machine learning': ['ml','machine learning','neural','model','training','inference','prediction','classification'],
  'edge computing':   ['edge','embedded','device','on-device','offline','raspberry','esp32','tflite','lite'],
  'iot':              ['iot','sensor','mqtt','lora','zigbee','mesh','actuator','telemetry'],
  'computer vision':  ['computer vision','image','camera','visual','detection','recognition','segmentation','cv'],
  'nlp':              ['nlp','language','text','speech','voice','asr','tts','nlp','bert','transformer'],
  'cloud':            ['cloud','aws','azure','gcp','serverless','kubernetes','docker','microservices'],
  'mobile':           ['mobile','android','ios','react native','flutter','app','smartphone'],
  'blockchain':       ['blockchain','distributed ledger','smart contract','crypto','web3','nft'],
  'data analytics':   ['analytics','dashboard','visualization','grafana','kibana','elasticsearch','insights'],
  'api':              ['api','rest','graphql','webhook','integration','endpoint'],
  'federated':        ['federated','privacy','decentralized','local training','no data sharing'],
  'agriculture':      ['crop','farm','agri','soil','irrigation','harvest','pest','disease detection'],
  'healthcare':       ['health','medical','patient','diagnos','hospital','clinical','vital'],
  'education':        ['learn','student','tutor','adaptive','curriculum','assessment'],
};

function extractConcepts(text) {
  const lower = text.toLowerCase();
  return Object.entries(DOMAIN_CONCEPTS)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([concept]) => concept);
}

/* ── Technology overlap ─────────────────────────────────────── */
function techOverlap(techA, techB) {
  if (!techA?.length || !techB?.length) return { shared: [], score: 0 };
  const setA = new Set(techA.map(t => t.toLowerCase()));
  const setB = new Set(techB.map(t => t.toLowerCase()));
  const shared = [...setA].filter(t => setB.has(t));
  const score = shared.length / Math.sqrt(setA.size * setB.size);
  return { shared, score };
}

/* ── Complementarity detection ──────────────────────────────── */
const COMPLEMENTARY_PAIRS = [
  { a: ['iot','sensor','data collection','monitoring'], b: ['ml','analytics','prediction','ai'], label: 'Data Collection + AI Analysis' },
  { a: ['image','camera','computer vision','visual'], b: ['voice','speech','nlp','language'], label: 'Visual + Voice Interface' },
  { a: ['edge','offline','on-device'], b: ['cloud','analytics','dashboard','reporting'], label: 'Edge Processing + Cloud Analytics' },
  { a: ['hardware','device','wearable'], b: ['software','platform','saas','app'], label: 'Hardware + Software Platform' },
  { a: ['data collection','monitoring','sensor'], b: ['federated','privacy','decentralized'], label: 'Data Network + Privacy Layer' },
  { a: ['detection','diagnosis','screening'], b: ['treatment','advisory','recommendation'], label: 'Detection + Advisory System' },
  { a: ['individual','personal','per user'], b: ['community','network','collective','aggregated'], label: 'Individual + Community Scale' },
  { a: ['mobile','smartphone','app'], b: ['ussd','voice','ivr','feature phone'], label: 'Smartphone + Feature Phone Access' },
];

function detectComplementarity(textA, textB) {
  const lowA = textA.toLowerCase();
  const lowB = textB.toLowerCase();

  const matches = [];
  for (const pair of COMPLEMENTARY_PAIRS) {
    const aMatches = pair.a.some(k => lowA.includes(k));
    const bMatches = pair.b.some(k => lowB.includes(k));
    const aCoverB = pair.a.some(k => lowB.includes(k));
    const bCoverA = pair.b.some(k => lowA.includes(k));

    if ((aMatches && bMatches) || (aCoverB && bCoverA)) {
      matches.push(pair.label);
    }
  }
  return matches;
}

/* ── Main comparison functions ──────────────────────────────── */

/**
 * Compare two solutions for similarity and complementarity.
 * @param {Object} solA
 * @param {Object} solB
 * @param {Array}  allSolutions — for IDF calculation
 * @returns {Object}
 */
function compareSolutions(solA, solB, allSolutions = []) {
  const textA = solutionText(solA);
  const textB = solutionText(solB);

  // Build IDF from all solutions
  const corpus = [solA, solB, ...allSolutions.filter(s => s.id !== solA.id && s.id !== solB.id)]
    .map(s => bigramTokenize(solutionText(s)));

  const idf = buildIDF(corpus);

  const tokensA = bigramTokenize(textA);
  const tokensB = bigramTokenize(textB);
  const vecA = tfidfVector(tokensA, idf);
  const vecB = tfidfVector(tokensB, idf);

  const semanticSimilarity = cosineSimilarity(vecA, vecB);

  // Concept overlap
  const conceptsA = extractConcepts(textA);
  const conceptsB = extractConcepts(textB);
  const sharedConcepts = conceptsA.filter(c => conceptsB.includes(c));
  const uniqueToA = conceptsA.filter(c => !conceptsB.includes(c));
  const uniqueToB = conceptsB.filter(c => !conceptsA.includes(c));

  // Tech overlap
  const tech = techOverlap(solA.tech, solB.tech);

  // Complementarity
  const complementaryAreas = detectComplementarity(textA, textB);

  // Overall compatibility score (blended)
  const complementScore = Math.min(1, complementaryAreas.length * 0.3);
  const overlapScore = semanticSimilarity * 0.5 + tech.score * 0.3 + (sharedConcepts.length / 10) * 0.2;
  
  // High complementarity + lower similarity = good collaboration candidate
  // High similarity = overlapping (not ideal for collaboration)
  const collaborationScore = clamp(
    complementScore * 0.6 + (1 - semanticSimilarity) * 0.2 + (sharedConcepts.length > 0 ? 0.2 : 0),
    0, 1
  );

  return {
    semanticSimilarity: Math.round(semanticSimilarity * 100),
    conceptsA,
    conceptsB,
    sharedConcepts,
    uniqueToA,
    uniqueToB,
    sharedTech: tech.shared,
    techOverlapScore: Math.round(tech.score * 100),
    complementaryAreas,
    collaborationScore: Math.round(collaborationScore * 100),
    overlapScore: Math.round(overlapScore * 100),
  };
}

/**
 * Find similar solutions to a given one from a pool.
 * @param {Object} targetSolution
 * @param {Array}  poolSolutions
 * @param {number} topN
 */
function findSimilarSolutions(targetSolution, poolSolutions, topN = 5) {
  const allTexts = [targetSolution, ...poolSolutions].map(s => bigramTokenize(solutionText(s)));
  const idf = buildIDF(allTexts);
  const targetVec = tfidfVector(bigramTokenize(solutionText(targetSolution)), idf);

  const results = poolSolutions
    .filter(s => s.id !== targetSolution.id)
    .map(sol => {
      const vec = tfidfVector(bigramTokenize(solutionText(sol)), idf);
      const sim = cosineSimilarity(targetVec, vec);
      const concepts = extractConcepts(solutionText(sol));
      const targetConcepts = extractConcepts(solutionText(targetSolution));
      const shared = concepts.filter(c => targetConcepts.includes(c));
      return { solution: sol, similarity: Math.round(sim * 100), sharedConcepts: shared };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);

  return results;
}

/**
 * Compare a solution to a problem for relevance.
 */
function solutionProblemRelevance(solution, problem) {
  const solTokens = bigramTokenize(solutionText(solution));
  const probTokens = bigramTokenize(problemText(problem));
  const allTokens = [solTokens, probTokens];
  const idf = buildIDF(allTokens);
  const solVec = tfidfVector(solTokens, idf);
  const probVec = tfidfVector(probTokens, idf);
  const sim = cosineSimilarity(solVec, probVec);

  const solConcepts = extractConcepts(solutionText(solution));
  const probConcepts = extractConcepts(problemText(problem));
  const sharedConcepts = solConcepts.filter(c => probConcepts.includes(c));

  return {
    similarity: Math.round(sim * 100),
    sharedConcepts,
    problemConcepts: probConcepts,
    solutionConcepts: solConcepts,
  };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

module.exports = {
  compareSolutions,
  findSimilarSolutions,
  solutionProblemRelevance,
  extractConcepts,
  tokenize,
  cosineSimilarity,
};
