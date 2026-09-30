'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Risk Engine
   ai/risk/riskEngine.js

   Structured risk detection comparing problem requirements
   against solution capabilities.
   ============================================================ */

/* ── Risk severity levels ────────────────────────────────────── */
const SEVERITY = {
  critical: { label: 'Critical', color: 'red',    weight: 4 },
  high:     { label: 'High',     color: 'orange',  weight: 3 },
  medium:   { label: 'Medium',   color: 'amber',   weight: 2 },
  low:      { label: 'Low',      color: 'blue',    weight: 1 },
};

/* ── Risk detection rules ────────────────────────────────────── */
const RISK_RULES = [
  {
    id: 'offline_internet_mismatch',
    name: 'Connectivity Mismatch',
    severity: 'high',
    check: (sol, prob) => {
      const probText = `${prob?.constraints || ''} ${prob?.desc || ''}`.toLowerCase();
      const solText = `${sol.desc || ''} ${sol.approach || ''} ${(sol.tech || []).join(' ')}`.toLowerCase();
      const needsOffline = probText.includes('offline') || probText.includes('remote') || probText.includes('no internet');
      const requiresInternet = (solText.includes('cloud') || solText.includes('api call') || solText.includes('requires internet'))
        && !solText.includes('offline') && !solText.includes('edge') && !solText.includes('local');
      return needsOffline && requiresInternet;
    },
    message: (sol, prob) => `"${sol.title}" may require internet connectivity, but the problem "${prob?.title}" specifies offline or remote deployment.`,
    affected: 'Offline/Remote Accessibility Requirement',
    mitigation: 'Consider edge inference, local model deployment, or offline-first architecture.',
  },
  {
    id: 'cost_exceeds_budget',
    name: 'Budget Constraint',
    severity: 'medium',
    check: (sol, prob) => {
      if (!sol.estimated_cost || !prob?.prize) return false;
      const parseCost = (str) => {
        const s = String(str).toLowerCase().replace(/[₹,\s]/g, '');
        if (s.includes('lakh')) return parseFloat(s) * 100000;
        if (s.includes('crore')) return parseFloat(s) * 10000000;
        return parseInt(s) || 0;
      };
      const cost = parseCost(sol.estimated_cost);
      const prize = parseCost(prob.prize);
      return prize > 0 && cost > prize * 1.3;
    },
    message: (sol, prob) => `Estimated cost of "${sol.title}" (${sol.estimated_cost}) may exceed the problem budget (${prob?.prize}).`,
    affected: 'Budget / Cost Constraint',
    mitigation: 'Review cost breakdown and identify components that could be reduced or phased.',
  },
  {
    id: 'hardware_dependency',
    name: 'Hardware Infrastructure Dependency',
    severity: 'low',
    check: (sol) => {
      const text = `${sol.desc || ''} ${(sol.tech || []).join(' ')}`.toLowerCase();
      return (text.includes('hardware') || text.includes('sensor') || text.includes('device'))
        && !text.includes('existing hardware') && !text.includes('no hardware required');
    },
    message: (sol) => `"${sol.title}" requires physical hardware installation, which adds deployment complexity and logistics.`,
    affected: 'Deployment & Installation',
    mitigation: 'Plan for hardware procurement, installation, and maintenance logistics in the pilot phase.',
  },
  {
    id: 'scalability_concern',
    name: 'Scalability Limitation',
    severity: 'low',
    check: (sol) => {
      const text = `${sol.desc || ''} ${sol.approach || ''} ${(sol.tech || []).join(' ')}`.toLowerCase();
      const scalableSignals = ['cloud','kubernetes','docker','microservices','api','saas','distributed'];
      const hasScalable = scalableSignals.some(s => text.includes(s));
      const isSmallStack = (sol.tech || []).length < 3;
      return !hasScalable && isSmallStack;
    },
    message: (sol) => `"${sol.title}" may face scalability challenges — no explicit scaling architecture was identified.`,
    affected: 'Production Scalability',
    mitigation: 'Define a cloud or distributed architecture plan before large-scale deployment.',
  },
  {
    id: 'single_language_support',
    name: 'Language Accessibility Gap',
    severity: 'medium',
    check: (sol, prob) => {
      const probText = `${prob?.desc || ''} ${prob?.constraints || ''}`.toLowerCase();
      const solText = `${sol.desc || ''} ${sol.tagline || ''}`.toLowerCase();
      const needsMultilingual = probText.includes('regional language') || probText.includes('10+ language') || probText.includes('multilingual');
      const hasMultilingual = solText.includes('regional') || solText.includes('multilingual') || solText.includes('language');
      return needsMultilingual && !hasMultilingual;
    },
    message: (sol, prob) => `"${sol.title}" may not support the regional language requirements specified in "${prob?.title}".`,
    affected: 'Language Accessibility',
    mitigation: 'Add multilingual NLP/localisation layer to support regional language users.',
  },
  {
    id: 'prototype_stage',
    name: 'Early Stage / Prototype Risk',
    severity: 'medium',
    check: (sol) => {
      const text = `${sol.desc || ''} ${sol.tagline || ''}`.toLowerCase();
      return text.includes('prototype') || text.includes('early stage') || text.includes('concept') || text.includes('proof of concept') || text.includes('poc');
    },
    message: (sol) => `"${sol.title}" appears to be at prototype/concept stage, which increases deployment and timeline risk.`,
    affected: 'Technical Readiness',
    mitigation: 'Conduct a technology readiness assessment and develop a concrete MVP before full pilot.',
  },
  {
    id: 'missing_weaknesses_disclosure',
    name: 'Incomplete Risk Disclosure',
    severity: 'low',
    check: (sol) => !sol.weaknesses || sol.weaknesses.length === 0,
    message: (sol) => `"${sol.title}" has not disclosed any weaknesses or limitations, which may indicate incomplete due diligence.`,
    affected: 'Due Diligence Completeness',
    mitigation: 'Request a comprehensive risk assessment and limitation disclosure from the startup.',
  },
  {
    id: 'high_implementation_complexity',
    name: 'Implementation Complexity',
    severity: 'low',
    check: (sol) => {
      const techCount = (sol.tech || []).length;
      const text = `${sol.approach || ''}`.toLowerCase();
      const complex = text.includes('federated') || text.includes('reinforcement') || text.includes('distributed') || text.includes('multi-modal');
      return complex || techCount >= 7;
    },
    message: (sol) => `"${sol.title}" involves complex technologies that may require specialised expertise for implementation and maintenance.`,
    affected: 'Implementation & Maintenance',
    mitigation: 'Ensure the team has adequate expertise or plan for knowledge transfer during pilot.',
  },
];

/* ── Risk aggregation ────────────────────────────────────────── */
function aggregateRiskLevel(risks) {
  if (!risks.length) return { level: 'Low', score: 0 };
  
  const totalWeight = risks.reduce((sum, r) => sum + (SEVERITY[r.severity]?.weight || 1), 0);
  
  if (risks.some(r => r.severity === 'critical')) return { level: 'Critical', score: totalWeight };
  if (risks.some(r => r.severity === 'high')) return { level: 'High', score: totalWeight };
  if (risks.some(r => r.severity === 'medium') && risks.length >= 2) return { level: 'Medium', score: totalWeight };
  if (risks.some(r => r.severity === 'medium')) return { level: 'Moderate', score: totalWeight };
  return { level: 'Low', score: totalWeight };
}

/* ── Main risk detection function ────────────────────────────── */
/**
 * Detect risks for a solution against a problem.
 * @param {Object} solution
 * @param {Object} problem
 * @returns {Object} risk assessment
 */
function assessRisks(solution, problem) {
  const detected = RISK_RULES
    .filter(rule => {
      try { return rule.check(solution, problem); }
      catch { return false; }
    })
    .map(rule => ({
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
      severityLabel: SEVERITY[rule.severity]?.label || rule.severity,
      severityColor: SEVERITY[rule.severity]?.color || 'gray',
      message: rule.message(solution, problem),
      affected: rule.affected,
      mitigation: rule.mitigation,
    }));

  // Add risks from solution's own weaknesses data
  (solution.weaknesses || []).forEach((w, i) => {
    const wLower = w.toLowerCase();
    if (wLower.includes('internet') || wLower.includes('connectivity')) {
      if (!detected.find(r => r.id === 'offline_internet_mismatch')) {
        detected.push({
          id: `weakness-${i}`,
          name: 'Connectivity Dependency (from startup disclosure)',
          severity: 'medium',
          severityLabel: 'Medium',
          severityColor: 'amber',
          message: w,
          affected: 'Deployment accessibility',
          mitigation: 'Evaluate offline fallback options.',
        });
      }
    }
  });

  const riskLevel = aggregateRiskLevel(detected);

  return {
    solutionId: solution.id,
    solutionTitle: solution.title,
    problemId: problem?.id,
    risks: detected,
    riskCount: detected.length,
    riskLevel: riskLevel.level,
    riskScore: riskLevel.score,
    highCount: detected.filter(r => ['critical','high'].includes(r.severity)).length,
    mediumCount: detected.filter(r => r.severity === 'medium').length,
    lowCount: detected.filter(r => r.severity === 'low').length,
    summary: detected.length === 0
      ? 'No significant risks detected based on available solution information.'
      : `${detected.length} risk indicator(s) identified: ${detected.map(r => r.name).join(', ')}.`,
  };
}

/**
 * Assess risks for all solutions in a problem.
 */
function assessAllRisks(solutions, problem) {
  return solutions.map(sol => assessRisks(sol, problem));
}

module.exports = { assessRisks, assessAllRisks, SEVERITY };
