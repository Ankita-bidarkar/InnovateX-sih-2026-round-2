'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Solution Scoring
   ai/scoring/scoringEngine.js

   Calculates explainable scores for solutions based on
   structured data. NOT hardcoded per solution.
   ============================================================ */

/**
 * Default scoring weights (must sum to 100)
 */
const DEFAULT_WEIGHTS = {
  relevance:      25,
  innovation:     20,
  feasibility:    20,
  impact:         15,
  scalability:    10,
  costEfficiency: 10,
};

/* ── Keyword signal banks ───────────────────────────────────── */
const INNOVATION_SIGNALS = [
  'federated learning','edge ai','transfer learning','reinforcement learning',
  'computer vision','nlp','natural language','generative','diffusion',
  'blockchain','digital twin','iot mesh','swarm','zero-knowledge',
  'novel','unique','first','proprietary','patent','breakthrough',
];

const FEASIBILITY_SIGNALS = [
  'offline','works offline','no internet required','edge','lite','lightweight',
  'raspberry pi','esp32','arduino','low cost','affordable','open source',
  'existing infrastructure','no hardware required','web browser','android',
  'minimal training','plug-and-play','deployed','production','live',
];

const SCALABILITY_SIGNALS = [
  'microservices','cloud','kubernetes','docker','serverless','api',
  'modular','multi-tenant','horizontal','distributed','kafka','redis',
  'postgresql','mongodb','elastic','cdn','multi-region','saas',
];

const IMPACT_SIGNALS = [
  'million','crore','lakh','farmer','patient','student','citizen',
  'reduce','save','improve','prevent','increase','mortality','income',
  'healthcare','education','agriculture','rural','underserved','disability',
  'carbon','emission','water','energy','waste','government',
];

const COST_EFFICIENCY_SIGNALS = [
  'low cost','affordable','free','open source','no hardware','minimal',
  'existing','reuse','subscription','per user','per month','roi',
  'payback','cost effective','budget','savings','₹','inr',
];

const OFFLINE_BONUS = [
  'offline','works without internet','no connectivity required','edge inference',
  'local processing','on-device','embedded',
];

const RISK_SIGNALS = [
  'requires internet','cloud dependency','high cost','expensive',
  'proprietary','vendor lock','complex setup','technical staff',
  'manual','not tested','prototype','concept','early stage',
];

/* ── Text analysis helpers ──────────────────────────────────── */
function countSignals(text, signals) {
  const lower = text.toLowerCase();
  return signals.reduce((count, s) => count + (lower.includes(s) ? 1 : 0), 0);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function techDiversity(techArray) {
  if (!Array.isArray(techArray)) return 0;
  const cats = {
    ml:    ['tensorflow','pytorch','keras','scikit','huggingface','onnx','tflite','coreml','yolo'],
    web:   ['react','vue','angular','next','svelte','node','express','fastapi','django','flask'],
    data:  ['postgresql','mysql','mongodb','influxdb','redis','kafka','spark','airflow'],
    iot:   ['esp32','arduino','raspberry','lorawan','mqtt','zigbee','ble','gsm','nbiot'],
    cloud: ['aws','azure','gcp','docker','kubernetes','terraform','vercel','firebase'],
    api:   ['rest','graphql','grpc','websocket','twilio','stripe','openai','llm'],
  };
  const techLower = techArray.map(t => t.toLowerCase());
  return Object.values(cats).filter(cat =>
    cat.some(k => techLower.some(t => t.includes(k)))
  ).length;
}

/* ── Relevance score (0–100) ────────────────────────────────── */
function scoreRelevance(solution, problem) {
  let score = 50; // base

  if (!problem) return score;

  const solText = `${solution.title || ''} ${solution.desc || ''} ${solution.tagline || ''} ${(solution.tech || []).join(' ')}`.toLowerCase();
  const probText = `${problem.title || ''} ${problem.desc || ''} ${problem.constraints || ''} ${problem.expected_outcome || ''} ${(problem.tags || []).join(' ')}`.toLowerCase();

  // Check problem tag alignment with solution tech
  const probTags = (problem.tags || []).map(t => t.toLowerCase());
  const techMatch = probTags.filter(tag => solText.includes(tag));
  score += techMatch.length * 8;

  // Category keyword match
  const catKeywords = {
    agriculture: ['crop','farm','agri','plant','soil','irrigation','harvest','livestock','pest','seed'],
    healthcare:  ['health','medical','patient','diagnos','clinical','hospital','nurse','doctor','disease','vital'],
    education:   ['learn','student','teach','school','educat','tutor','course','knowledge','curriculum'],
    smartcities: ['city','urban','municipal','smart','traffic','water','waste','civic','transport'],
    technology:  ['software','platform','api','digital','cloud','saas','tech','app'],
    environment: ['environment','waste','recycle','carbon','emission','green','sustainable','energy','pollution'],
    finance:     ['finance','fintech','loan','credit','payment','bank','invest','money','micro'],
    transport:   ['transport','vehicle','fleet','transit','bus','train','logistics','route','delivery'],
    cybersecurity:['security','cyber','threat','protect','encrypt','firewall','audit','compliance'],
    energy:      ['energy','power','solar','grid','electricity','renewable','iot','optimization'],
  };

  const catKws = catKeywords[problem.category] || [];
  const catMatch = catKws.filter(kw => solText.includes(kw));
  score += catMatch.length * 5;

  // Problem-specific keyword in solution text
  const problemKeywords = probText.split(/\W+/).filter(w => w.length > 5);
  const uniqueProbWords = [...new Set(problemKeywords)];
  const directMatch = uniqueProbWords.filter(w => solText.includes(w)).length;
  score += Math.min(directMatch * 2, 15);

  // Offline/constraint match bonus
  const probConstraints = (problem.constraints || '').toLowerCase();
  if (probConstraints.includes('offline') || probConstraints.includes('remote')) {
    const offlineMatch = countSignals(solText, OFFLINE_BONUS);
    score += offlineMatch * 6;
  }

  // Approach alignment
  if (solution.approach) {
    const approachLower = solution.approach.toLowerCase();
    const approachMatch = probTags.filter(tag => approachLower.includes(tag));
    score += approachMatch.length * 5;
  }

  return clamp(score, 20, 100);
}

/* ── Innovation score (0–100) ───────────────────────────────── */
function scoreInnovation(solution) {
  let score = 50;

  const text = `${solution.title || ''} ${solution.desc || ''} ${solution.approach || ''} ${(solution.tech || []).join(' ')}`.toLowerCase();

  // Innovation signal count
  const signals = countSignals(text, INNOVATION_SIGNALS);
  score += signals * 7;

  // Tech diversity bonus
  const diversity = techDiversity(solution.tech || []);
  score += diversity * 5;

  // Approach sophistication
  const sophisticatedApproaches = [
    'federated','reinforcement','transfer learning','edge ml','multimodal',
    'adversarial','attention','transformer','graph neural','zero-shot',
  ];
  if (sophisticatedApproaches.some(a => text.includes(a))) score += 15;

  // Negative: too simple
  const simpleSignals = ['spreadsheet','manual process','basic form','simple database'];
  if (simpleSignals.some(s => text.includes(s))) score -= 15;

  return clamp(score, 20, 100);
}

/* ── Feasibility score (0–100) ──────────────────────────────── */
function scoreFeasibility(solution, problem) {
  let score = 60;

  const text = `${solution.desc || ''} ${solution.approach || ''} ${(solution.tech || []).join(' ')}`.toLowerCase();

  // Feasibility positive signals
  const posSignals = countSignals(text, FEASIBILITY_SIGNALS);
  score += posSignals * 6;

  // Tech stack clarity (more defined = more feasible)
  const techCount = (solution.tech || []).length;
  if (techCount >= 4) score += 10;
  else if (techCount >= 2) score += 5;

  // Has cost estimate = more planned = more feasible
  if (solution.estimated_cost) score += 8;
  if (solution.cost_breakdown) score += 5;

  // Strengths present = more concrete
  if (Array.isArray(solution.strengths) && solution.strengths.length >= 2) score += 7;

  // Problem-specific feasibility: offline requirement
  if (problem) {
    const probText = (problem.constraints || '').toLowerCase();
    const solText = text;
    if (probText.includes('offline') && !solText.includes('offline') && !solText.includes('edge')) {
      score -= 20; // cannot satisfy offline requirement
    }
    if (probText.includes('low cost') || probText.includes('affordable')) {
      // Check if solution is expensive
      const cost = solution.estimated_cost || '';
      const costNum = parseInt(cost.replace(/[₹,]/g, '').replace('lakh','00000').replace('lakhs','00000'));
      if (!isNaN(costNum) && costNum > 2000000) score -= 10; // very expensive
    }
  }

  // Negative signals
  const negSignals = countSignals(text, RISK_SIGNALS);
  score -= negSignals * 4;

  return clamp(score, 20, 100);
}

/* ── Impact score (0–100) ───────────────────────────────────── */
function scoreImpact(solution, problem) {
  let score = 55;

  const text = `${solution.desc || ''} ${solution.tagline || ''} ${(solution.strengths || []).join(' ')}`.toLowerCase();

  // Impact signal count
  const signals = countSignals(text, IMPACT_SIGNALS);
  score += signals * 5;

  // Problem impact level
  if (problem) {
    const impactBonus = { very_high: 20, high: 12, medium: 5, low: 0 };
    score += impactBonus[problem.impact] || 0;
  }

  // Quantified impact in description
  const quantPattern = /\d+[%₹]|\d+\s*(million|crore|lakh|thousand|hundred)/i;
  const solText = `${solution.desc || ''} ${(solution.strengths || []).join(' ')}`;
  if (quantPattern.test(solText)) score += 12;

  // Multi-beneficiary impact
  const beneficiaries = ['farmer','patient','student','citizen','worker','user','community'];
  const mentionedBenef = beneficiaries.filter(b => text.includes(b)).length;
  score += mentionedBenef * 4;

  return clamp(score, 20, 100);
}

/* ── Scalability score (0–100) ──────────────────────────────── */
function scoreScalability(solution) {
  let score = 55;

  const text = `${solution.desc || ''} ${solution.approach || ''} ${(solution.tech || []).join(' ')}`.toLowerCase();

  // Scalability signals
  const signals = countSignals(text, SCALABILITY_SIGNALS);
  score += signals * 7;

  // SaaS / API model = inherently scalable
  if (text.includes('saas') || text.includes('api') || text.includes('cloud')) score += 10;

  // Mobile/web = broad reach
  if (text.includes('mobile') || text.includes('web') || text.includes('app')) score += 7;

  // Hardware-heavy = harder to scale
  if (text.includes('hardware') || text.includes('sensor') || text.includes('device')) {
    score -= 8;
    // But IoT network can still scale
    if (text.includes('iot') || text.includes('mesh') || text.includes('lora')) score += 4;
  }

  // Tech diversity bonus for scalability
  const diversity = techDiversity(solution.tech || []);
  score += diversity * 3;

  return clamp(score, 20, 100);
}

/* ── Cost Efficiency score (0–100) ──────────────────────────── */
function scoreCostEfficiency(solution, problem) {
  let score = 60;

  const text = `${solution.desc || ''} ${solution.tagline || ''} ${(solution.tech || []).join(' ')}`.toLowerCase();

  // Cost efficiency positive signals
  const signals = countSignals(text, COST_EFFICIENCY_SIGNALS);
  score += signals * 6;

  // Estimated cost relative to problem prize/budget
  if (solution.estimated_cost) {
    const costStr = solution.estimated_cost.toLowerCase().replace(/[₹,\s]/g, '');
    let cost = 0;
    if (costStr.includes('lakh')) {
      cost = parseFloat(costStr) * 100000;
    } else {
      cost = parseInt(costStr) || 0;
    }

    // Problem prize as proxy for expected budget
    if (problem?.prize) {
      const prizeStr = problem.prize.toLowerCase().replace(/[₹,\s]/g, '');
      let prize = 0;
      if (prizeStr.includes('lakh')) prize = parseFloat(prizeStr) * 100000;
      
      if (prize > 0) {
        const ratio = cost / prize;
        if (ratio < 0.5) score += 15;       // well within budget
        else if (ratio < 0.8) score += 8;    // comfortable
        else if (ratio < 1.2) score += 0;    // at budget
        else if (ratio < 2.0) score -= 10;   // over budget
        else score -= 20;                    // very expensive
      }
    }

    // Absolute affordability
    if (cost < 500000) score += 10;       // under 5L: very affordable
    else if (cost < 1000000) score += 5;  // under 10L: affordable
    else if (cost > 5000000) score -= 10; // over 50L: expensive
  }

  // Open source tech = lower cost
  const openSourceTech = ['react','node','python','postgresql','mongodb','tensorflow','pytorch'];
  const openCount = openSourceTech.filter(t =>
    (solution.tech || []).some(st => st.toLowerCase().includes(t))
  ).length;
  score += openCount * 2;

  return clamp(score, 20, 100);
}

/* ── Risk detection ─────────────────────────────────────────── */
function detectRisks(solution, problem) {
  const risks = [];
  const solText = `${solution.desc || ''} ${solution.approach || ''} ${(solution.tech || []).join(' ')}`.toLowerCase();
  const probText = `${problem?.constraints || ''} ${problem?.desc || ''}`.toLowerCase();

  // Internet dependency vs offline requirement
  if ((probText.includes('offline') || probText.includes('remote')) &&
      (solText.includes('internet') || solText.includes('cloud') || solText.includes('api call'))) {
    risks.push({
      severity: 'high',
      type: 'connectivity',
      reason: 'Solution may require internet connectivity in an offline/remote deployment context.',
      affected: 'Offline accessibility requirement',
    });
  }

  // High cost vs affordable requirement
  if (probText.includes('affordable') || probText.includes('low cost')) {
    if (solution.estimated_cost) {
      const costStr = solution.estimated_cost.toLowerCase().replace(/[₹,\s]/g, '');
      const cost = costStr.includes('lakh') ? parseFloat(costStr) * 100000 : parseInt(costStr);
      if (cost > 2000000) {
        risks.push({
          severity: 'medium',
          type: 'cost',
          reason: `Estimated cost may exceed affordability constraints set by the problem owner.`,
          affected: 'Cost per deployment',
        });
      }
    }
  }

  // Hardware dependency
  if (solText.includes('sensor') || solText.includes('hardware') || solText.includes('device')) {
    risks.push({
      severity: 'low',
      type: 'infrastructure',
      reason: 'Hardware-dependent solutions require physical installation, logistics, and maintenance.',
      affected: 'Deployment complexity',
    });
  }

  // No mentioned scalability tech
  const hasScalable = SCALABILITY_SIGNALS.some(s => solText.includes(s));
  if (!hasScalable && (solution.tech || []).length < 3) {
    risks.push({
      severity: 'low',
      type: 'scalability',
      reason: 'Limited technical stack may introduce scalability challenges at production scale.',
      affected: 'Production scalability',
    });
  }

  // Weaknesses from data
  (solution.weaknesses || []).forEach(w => {
    if (w.toLowerCase().includes('internet') || w.toLowerCase().includes('connect')) {
      risks.push({
        severity: 'medium',
        type: 'connectivity',
        reason: w,
        affected: 'Deployment accessibility',
      });
    }
    if (w.toLowerCase().includes('cost') || w.toLowerCase().includes('expensive')) {
      risks.push({
        severity: 'medium',
        type: 'cost',
        reason: w,
        affected: 'Budget feasibility',
      });
    }
  });

  return risks;
}

/* ── Strengths & weaknesses summary ────────────────────────── */
function extractStrengths(solution, scores) {
  const strengths = [];

  // From stored data
  if (Array.isArray(solution.strengths) && solution.strengths.length) {
    strengths.push(...solution.strengths.slice(0, 3));
  }

  // From score analysis
  if (scores.relevance >= 80) {
    strengths.push('Highly relevant to problem domain with strong keyword and requirement alignment');
  }
  if (scores.innovation >= 80) {
    strengths.push('Innovative approach using advanced techniques or novel combinations of technologies');
  }
  if (scores.feasibility >= 80) {
    strengths.push('Technically feasible with clear implementation path and defined technology stack');
  }
  if (scores.impact >= 80) {
    strengths.push('Strong potential impact with quantified benefits for target beneficiaries');
  }
  if (scores.scalability >= 80) {
    strengths.push('Scalable architecture suitable for large-scale deployment');
  }
  if (scores.costEfficiency >= 80) {
    strengths.push('Cost-effective solution with good value relative to expected budget');
  }

  return [...new Set(strengths)].slice(0, 5);
}

function extractWeaknesses(solution, scores) {
  const weaknesses = [];

  // From stored data
  if (Array.isArray(solution.weaknesses) && solution.weaknesses.length) {
    weaknesses.push(...solution.weaknesses.slice(0, 2));
  }

  // From score analysis
  if (scores.relevance < 60) weaknesses.push('Moderate alignment with problem requirements — may need refocusing');
  if (scores.innovation < 60) weaknesses.push('Approach could benefit from more novel or differentiated methodology');
  if (scores.feasibility < 60) weaknesses.push('Implementation path needs further clarification and validation');
  if (scores.scalability < 60) weaknesses.push('Scalability strategy not clearly defined for large deployment');
  if (scores.costEfficiency < 60) weaknesses.push('Cost efficiency could be improved to meet budget expectations');

  return [...new Set(weaknesses)].slice(0, 4);
}

/* ── Main scoring function ──────────────────────────────────── */
/**
 * Score a single solution against a problem.
 * @param {Object} solution
 * @param {Object} problem
 * @param {Object} weights — optional custom weights (must sum to 100)
 * @returns {Object} scoring result
 */
function scoreOneSolution(solution, problem, weights = DEFAULT_WEIGHTS) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // Raw dimension scores 0–100
  const raw = {
    relevance:      scoreRelevance(solution, problem),
    innovation:     scoreInnovation(solution),
    feasibility:    scoreFeasibility(solution, problem),
    impact:         scoreImpact(solution, problem),
    scalability:    scoreScalability(solution),
    costEfficiency: scoreCostEfficiency(solution, problem),
  };

  // If solution has stored AI scores, blend them (stored = ground truth context)
  // Use stored scores with 60% weight, calculated with 40% weight
  const stored = solution.ai_scores || {};
  function getStored(key, alt) {
    const legacy = { costEfficiency: stored.cost };
    const v = stored[key] ?? legacy[key];
    if (v == null) return null;
    // Convert from max-point format to 0–100 scale
    const maxPoints = { relevance: 25, innovation: 20, feasibility: 20, impact: 20, scalability: 10, cost: 5 };
    const storedKey = key === 'costEfficiency' ? 'cost' : key;
    const max = maxPoints[storedKey] || 1;
    return (v / max) * 100;
  }

  const blended = {};
  for (const dim of Object.keys(raw)) {
    const storedVal = getStored(dim);
    if (storedVal !== null) {
      blended[dim] = Math.round(storedVal * 0.6 + raw[dim] * 0.4);
    } else {
      blended[dim] = Math.round(raw[dim]);
    }
  }

  // Weighted overall score
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
  const overallScore = Math.round(
    Object.keys(blended).reduce((sum, dim) => {
      return sum + (blended[dim] * (w[dim] / totalWeight));
    }, 0)
  );

  // Risks, strengths, weaknesses
  const risks = detectRisks(solution, problem);
  const strengths = extractStrengths(solution, blended);
  const weaknesses = extractWeaknesses(solution, blended);

  return {
    id: solution.id,
    title: solution.title,
    team: solution.team,
    overallScore: clamp(overallScore, 0, 100),
    dimensions: blended,
    weights: w,
    strengths,
    weaknesses,
    risks,
    rawDimensions: raw,
  };
}

/**
 * Score multiple solutions and produce rankings.
 * @param {Object} problem
 * @param {Array}  solutions
 * @param {Object} weights
 * @returns {Object} full analysis result
 */
function analyzeAll(problem, solutions, weights = DEFAULT_WEIGHTS) {
  const scored = solutions.map(sol => scoreOneSolution(sol, problem, weights));

  // Sort by overall score descending
  scored.sort((a, b) => b.overallScore - a.overallScore);

  // Assign ranks
  scored.forEach((s, i) => { s.rank = i + 1; });

  const avgScore = Math.round(scored.reduce((sum, s) => sum + s.overallScore, 0) / Math.max(1, scored.length));
  const topScore = scored[0]?.overallScore || 0;
  const shortlisted = scored.filter(s => s.overallScore >= 70).slice(0, 3).map(s => s.id);

  // Common ideas / tech across solutions
  const allTech = solutions.flatMap(s => (s.tech || []).map(t => t.toLowerCase()));
  const techFreq = {};
  allTech.forEach(t => { techFreq[t] = (techFreq[t] || 0) + 1; });
  const commonTech = Object.entries(techFreq)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tech]) => tech);

  return {
    problem: { id: problem.id, title: problem.title, category: problem.category },
    scores: scored.map(s => ({
      id: s.id,
      title: s.title,
      team: s.team,
      total: s.overallScore,
      rank: s.rank,
      relevance:      Math.round((s.dimensions.relevance * 25) / 100),
      innovation:     Math.round((s.dimensions.innovation * 20) / 100),
      feasibility:    Math.round((s.dimensions.feasibility * 20) / 100),
      impact:         Math.round((s.dimensions.impact * 15) / 100),
      scalability:    Math.round((s.dimensions.scalability * 10) / 100),
      cost:           Math.round((s.dimensions.costEfficiency * 10) / 100),
    })),
    shortlisted,
    explanations: scored.map(s => ({
      id: s.id,
      strengths: s.strengths,
      weaknesses: s.weaknesses,
      risks: s.risks,
      dimensions: s.dimensions,
      what: `${s.title} achieved a score of ${s.overallScore}/100.`,
      why: s.strengths.slice(0, 2).join('. ') || 'Based on calculated dimension scores.',
      what_next: s.overallScore >= 85
        ? 'Highly recommended for shortlisting and pilot consideration.'
        : s.overallScore >= 70
        ? 'Consider for shortlist with further validation of weak areas.'
        : 'Needs significant improvement before advancing.',
    })),
    insights: {
      summary: `${solutions.length} solutions analysed for "${problem.title}". Average score: ${avgScore}/100. Top score: ${topScore}/100. ${shortlisted.length} solution(s) shortlisted.`,
      common_ideas: commonTech.length ? `Common technologies: ${commonTech.join(', ')}.` : 'No common technologies identified.',
      collaboration: 'See the Collaboration module for AI-detected complementary solution pairs.',
      gap: scored.at(-1) ? `Lowest-ranked solution scored ${scored.at(-1).overallScore}/100 — may need significant improvement.` : '',
      top_pick_reason: scored[0] ? `${scored[0].title} ranked first with ${scored[0].overallScore}/100 based on superior ${Object.entries(scored[0].dimensions).sort((a,b)=>b[1]-a[1])[0][0]} and overall dimension balance.` : '',
    },
    meta: {
      weights,
      analysedAt: new Date().toISOString(),
      source: 'InnovateX Intelligence Engine',
      version: '1.0',
    },
  };
}

module.exports = { analyzeAll, scoreOneSolution, DEFAULT_WEIGHTS };
