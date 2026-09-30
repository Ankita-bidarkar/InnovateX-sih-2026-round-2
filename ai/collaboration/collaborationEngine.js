'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Collaboration Engine
   ai/collaboration/collaborationEngine.js

   Detects complementary capability pairs across solutions.
   Does NOT merge solutions or assign IP ownership.
   Results are recommendations for human review only.
   ============================================================ */

const { compareSolutions, extractConcepts } = require('../similarity/similarityEngine');

/* ── Capability taxonomy ────────────────────────────────────── */
const CAPABILITY_CLUSTERS = {
  'Data Collection':     ['sensor','iot','camera','monitoring','data collection','image capture','telemetry','wearable','field data'],
  'AI/ML Processing':    ['machine learning','neural network','model','inference','prediction','classification','detection','ai','ml'],
  'Edge Computing':      ['edge','on-device','offline','embedded','raspberry','esp32','tflite','local processing'],
  'Voice/NLP Interface': ['voice','speech','nlp','language processing','asr','tts','ivr','multilingual','regional language'],
  'Visual Interface':    ['computer vision','image analysis','camera','visual','cv','object detection','visual diagnosis'],
  'Cloud Analytics':     ['cloud','analytics','dashboard','reporting','visualization','bigquery','grafana'],
  'Mobile Access':       ['mobile','android','ios','react native','flutter','smartphone','app'],
  'Feature Phone Access':['ussd','ivr','feature phone','sms','2g','basic phone'],
  'Privacy/Security':    ['federated','privacy','encryption','zero-knowledge','gdpr','data protection','anonymization'],
  'Hardware Integration':['hardware','sensor','iot device','physical','embedded system','actuator'],
  'Community Network':   ['crowdsource','community','peer','network effect','collective','crowd','shared'],
  'Expert System':       ['expert','advisory','recommendation','consultation','specialist','knowledge base'],
  'Telemedicine':        ['telemedicine','teleconsult','video call','remote consultation','webrtc'],
  'Blockchain/Ledger':   ['blockchain','ledger','smart contract','immutable','decentralized','distributed'],
  'Satellite/Remote Sensing': ['satellite','sentinel','multispectral','remote sensing','geospatial','gis'],
};

function extractCapabilities(solution) {
  const text = `${solution.title || ''} ${solution.desc || ''} ${solution.approach || ''} ${(solution.tech || []).join(' ')} ${(solution.tagline || '')}`.toLowerCase();
  
  return Object.entries(CAPABILITY_CLUSTERS)
    .filter(([, keywords]) => keywords.some(kw => text.includes(kw)))
    .map(([capability]) => capability);
}

/* ── Evolved solution generator ─────────────────────────────── */
function generateEvolvedSolution(solA, solB, sharedProblem) {
  const capsA = extractCapabilities(solA);
  const capsB = extractCapabilities(solB);

  const allCaps = [...new Set([...capsA, ...capsB])];

  // Determine primary and secondary capability groups
  const dataCollectors = allCaps.filter(c => ['Data Collection', 'Hardware Integration', 'Satellite/Remote Sensing'].includes(c));
  const processors = allCaps.filter(c => ['AI/ML Processing', 'Edge Computing', 'Cloud Analytics'].includes(c));
  const interfaces = allCaps.filter(c => ['Voice/NLP Interface', 'Visual Interface', 'Mobile Access', 'Feature Phone Access', 'Telemedicine'].includes(c));
  const enablers = allCaps.filter(c => ['Privacy/Security', 'Blockchain/Ledger', 'Community Network', 'Expert System'].includes(c));

  // Build evolved solution name
  const probCategory = sharedProblem?.category || 'cross-domain';
  const categoryLabel = {
    agriculture: 'Agricultural Intelligence',
    healthcare: 'Health Intelligence',
    education: 'Learning Intelligence',
    smartcities: 'Urban Intelligence',
    environment: 'Environmental Intelligence',
    finance: 'Financial Intelligence',
    transport: 'Transport Intelligence',
    energy: 'Energy Intelligence',
    cybersecurity: 'Security Intelligence',
  }[probCategory] || 'Innovation Intelligence';

  const evolvedTitle = `${solA.title} × ${solB.title} — Integrated ${categoryLabel} Platform`;

  // Build evolved description
  const aContrib = capsA.slice(0, 2).join(' and ');
  const bContrib = capsB.slice(0, 2).join(' and ');
  
  const evolvedDesc = `An integrated solution combining ${solA.title}'s ${aContrib} with ${solB.title}'s ${bContrib}, creating a comprehensive platform that addresses ${sharedProblem?.title || 'the shared problem'} at both ${aContrib} and ${bContrib} levels.`;

  return {
    title: evolvedTitle,
    description: evolvedDesc,
    capabilitiesFromA: capsA,
    capabilitiesFromB: capsB,
    combinedCapabilities: allCaps,
    coverageAreas: {
      dataCollection: dataCollectors,
      processing: processors,
      interfaces,
      enablers,
    },
  };
}

/* ── Compatibility score ─────────────────────────────────────── */
function calculateCompatibility(solA, solB, allSolutions = []) {
  const comparison = compareSolutions(solA, solB, allSolutions);
  
  const capsA = extractCapabilities(solA);
  const capsB = extractCapabilities(solB);
  
  // Complementary caps = different caps (not overlapping = better collaboration)
  const uniqueToA = capsA.filter(c => !capsB.includes(c));
  const uniqueToB = capsB.filter(c => !capsA.includes(c));
  const sharedCaps = capsA.filter(c => capsB.includes(c));
  
  // Good collaboration: complementary (unique) without too much overlap
  const complementarityScore = Math.min(100, (uniqueToA.length + uniqueToB.length) * 15);
  const overlapPenalty = Math.min(30, sharedCaps.length * 10); // too much overlap = competing
  
  // Adjust for complementary area signals from similarity engine
  const complementSignal = comparison.complementaryAreas.length * 15;
  
  // Base compatibility
  let compat = 40 + complementarityScore - overlapPenalty + complementSignal;
  
  // Bonus for shared problem concepts
  compat += comparison.sharedConcepts.length * 5;
  
  // Bonus for meaningful tech complementarity (one has what the other lacks)
  const techA = new Set((solA.tech || []).map(t => t.toLowerCase()));
  const techB = new Set((solB.tech || []).map(t => t.toLowerCase()));
  const techComplement = [...techA].filter(t => !techB.has(t)).length + [...techB].filter(t => !techA.has(t)).length;
  compat += Math.min(20, techComplement * 3);
  
  return {
    score: Math.min(98, Math.max(20, Math.round(compat))),
    capsA,
    capsB,
    uniqueToA,
    uniqueToB,
    sharedCaps,
    complementaryAreas: comparison.complementaryAreas,
    sharedConcepts: comparison.sharedConcepts,
    semanticSimilarity: comparison.semanticSimilarity,
  };
}

/* ── Rationale generation ───────────────────────────────────── */
function generateRationale(solA, solB, compat) {
  const parts = [];
  
  if (compat.uniqueToA.length > 0 && compat.uniqueToB.length > 0) {
    parts.push(`${solA.title} specialises in ${compat.uniqueToA.slice(0, 2).join(' and ')}, while ${solB.title} brings ${compat.uniqueToB.slice(0, 2).join(' and ')}.`);
  }
  
  if (compat.complementaryAreas.length > 0) {
    parts.push(`They form a natural complementary pair across: ${compat.complementaryAreas.join(', ')}.`);
  }
  
  if (compat.sharedConcepts.length > 0) {
    parts.push(`Both operate in shared domains (${compat.sharedConcepts.slice(0, 2).join(', ')}), ensuring conceptual alignment.`);
  }
  
  if (parts.length === 0) {
    parts.push(`${solA.title} and ${solB.title} address different aspects of the same problem, creating an opportunity for integrated impact.`);
  }
  
  return parts.join(' ');
}

/* ── Main collaboration analysis ────────────────────────────── */

/**
 * Analyse collaboration opportunities between solutions for a problem.
 * @param {Object} problem
 * @param {Array}  solutions
 * @returns {Array} collaboration opportunities sorted by compatibility
 */
function findCollaborations(problem, solutions, allSolutions = []) {
  if (!solutions || solutions.length < 2) return [];

  const opportunities = [];

  // Compare all pairs
  for (let i = 0; i < solutions.length; i++) {
    for (let j = i + 1; j < solutions.length; j++) {
      const solA = solutions[i];
      const solB = solutions[j];
      
      const compat = calculateCompatibility(solA, solB, allSolutions);
      
      // Only surface meaningful collaborations (score > 50)
      if (compat.score < 50) continue;
      
      const evolved = generateEvolvedSolution(solA, solB, problem);
      const rationale = generateRationale(solA, solB, compat);
      
      opportunities.push({
        id: `collab-${solA.id}-${solB.id}`,
        problem_id: problem.id,
        sol_a: solA.id,
        sol_b: solB.id,
        name_a: solA.title,
        name_b: solB.title,
        team_a: solA.team,
        team_b: solB.team,
        compat: compat.score,
        status: 'ai_suggested',
        rationale,
        capabilities_a: compat.capsA,
        capabilities_b: compat.capsB,
        unique_to_a: compat.uniqueToA,
        unique_to_b: compat.uniqueToB,
        complementary_areas: compat.complementaryAreas,
        shared_concepts: compat.sharedConcepts,
        evolved_solution: evolved,
        attribution_notice: 'IP ownership, revenue sharing, and legal arrangements must be negotiated independently between the involved startups and the problem owner. InnovateX does not assign IP rights.',
      });
    }
  }

  // Sort by compatibility score
  return opportunities.sort((a, b) => b.compat - a.compat);
}

/**
 * Explain a specific collaboration match.
 */
function explainCollaboration(collaboration, solA, solB) {
  const compat = {
    uniqueToA: collaboration.unique_to_a || [],
    uniqueToB: collaboration.unique_to_b || [],
    sharedCaps: [],
    complementaryAreas: collaboration.complementary_areas || [],
    sharedConcepts: collaboration.shared_concepts || [],
  };
  
  return {
    compatibility: collaboration.compat,
    explanation: collaboration.rationale,
    solA_brings: compat.uniqueToA,
    solB_brings: compat.uniqueToB,
    complementaryAreas: compat.complementaryAreas,
    sharedDomains: compat.sharedConcepts,
    evolvedSolution: collaboration.evolved_solution,
    disclaimer: collaboration.attribution_notice,
  };
}

module.exports = { findCollaborations, calculateCompatibility, explainCollaboration, extractCapabilities };
