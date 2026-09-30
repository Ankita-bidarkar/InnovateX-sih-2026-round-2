'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Explanation Engine
   ai/explanation/explanationEngine.js

   Converts already-calculated structured results into
   readable natural language. Does NOT change any scores,
   rankings, or recommendations.
   ============================================================ */

/* ── Score-to-words helpers ──────────────────────────────────── */
function scoreWord(score) {
  if (score >= 90) return 'exceptional';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 60) return 'moderate';
  if (score >= 50) return 'below average';
  return 'weak';
}

function dimensionExplanation(dim, score) {
  const word = scoreWord(score);
  const templates = {
    relevance: {
      high: `${score}/100 relevance score — capabilities are directly aligned with the problem domain and requirements.`,
      mid:  `${score}/100 relevance score — reasonable alignment with the problem, though some aspects may not be fully addressed.`,
      low:  `${score}/100 relevance score — limited direct alignment detected between solution approach and problem requirements.`,
    },
    innovation: {
      high: `${score}/100 innovation score — employs advanced techniques and demonstrates meaningful differentiation from conventional approaches.`,
      mid:  `${score}/100 innovation score — uses established methods with some novel application or combination.`,
      low:  `${score}/100 innovation score — approach may be conventional or lacks clear differentiation from existing solutions.`,
    },
    feasibility: {
      high: `${score}/100 feasibility score — well-defined technical stack, clear implementation path, and evidence of practical constraints addressed.`,
      mid:  `${score}/100 feasibility score — technically viable with some aspects requiring further clarification or validation.`,
      low:  `${score}/100 feasibility score — implementation approach has significant gaps or unanswered feasibility questions.`,
    },
    impact: {
      high: `${score}/100 impact score — demonstrates strong potential for meaningful, measurable outcomes for target beneficiaries.`,
      mid:  `${score}/100 impact score — reasonable potential impact, though quantification or scope could be strengthened.`,
      low:  `${score}/100 impact score — limited evidence of significant impact for the intended beneficiary population.`,
    },
    scalability: {
      high: `${score}/100 scalability score — architecture supports growth and large-scale deployment without fundamental redesign.`,
      mid:  `${score}/100 scalability score — can scale with some architectural additions or modifications.`,
      low:  `${score}/100 scalability score — scalability path is unclear or may require significant rearchitecting.`,
    },
    costEfficiency: {
      high: `${score}/100 cost efficiency score — solution represents excellent value relative to expected deployment budget.`,
      mid:  `${score}/100 cost efficiency score — cost is within reasonable range relative to expected value delivered.`,
      low:  `${score}/100 cost efficiency score — cost may be disproportionate to the expected value or stated budget constraints.`,
    },
  };
  
  const bucket = score >= 75 ? 'high' : score >= 55 ? 'mid' : 'low';
  return (templates[dim]?.[bucket]) || `${score}/100 — ${word} performance in this dimension.`;
}

/* ── Solution score explanation ─────────────────────────────── */
/**
 * Explain why a solution received its overall score.
 * @param {Object} scoringResult — from scoringEngine
 * @param {Object} solution — original solution data
 * @param {Object} problem — original problem data
 * @returns {Object} explanation
 */
function explainScore(scoringResult, solution, problem) {
  const score = scoringResult.overallScore || scoringResult.total || 0;
  const dims = scoringResult.dimensions || {};
  const weights = scoringResult.weights || {};
  
  // Overall explanation
  const overallWord = scoreWord(score);
  let overallExplanation = `${solution?.title || 'This solution'} received an ${overallWord} overall score of ${score}/100. `;
  
  // Top dimension
  const dimEntries = Object.entries(dims).sort((a, b) => b[1] - a[1]);
  const topDim = dimEntries[0];
  const bottomDim = dimEntries[dimEntries.length - 1];
  
  if (topDim) {
    overallExplanation += `Its strongest dimension is ${topDim[0]} (${topDim[1]}/100)`;
    if (solution?.team) overallExplanation += `, reflecting ${solution.team}'s capabilities in this area`;
    overallExplanation += '. ';
  }
  
  if (bottomDim && bottomDim[1] < 65) {
    overallExplanation += `The lowest dimension is ${bottomDim[0]} (${bottomDim[1]}/100), which represents the primary area for improvement.`;
  }
  
  // Per-dimension explanations
  const dimensionExplanations = Object.fromEntries(
    Object.entries(dims).map(([dim, score]) => [dim, dimensionExplanation(dim, score)])
  );
  
  // Shortlist explanation
  let shortlistReason = '';
  if (score >= 85) {
    shortlistReason = `${solution?.title || 'This solution'} was shortlisted because its score of ${score}/100 meets the shortlisting threshold of 85.`;
  } else if (score >= 70) {
    shortlistReason = `${solution?.title || 'This solution'} was flagged for improvement. At ${score}/100, it approaches but does not yet meet the 85-point shortlisting threshold.`;
  } else {
    shortlistReason = `${solution?.title || 'This solution'} was not shortlisted at this stage. A score of ${score}/100 is below the minimum threshold of 70 required for consideration.`;
  }
  
  return {
    overallScore: score,
    overallExplanation,
    dimensionExplanations,
    shortlistReason,
    keyStrengths: (scoringResult.strengths || []).slice(0, 3),
    keyWeaknesses: (scoringResult.weaknesses || []).slice(0, 3),
  };
}

/* ── Collaboration explanation ──────────────────────────────── */
/**
 * Explain why two solutions were matched for collaboration.
 * @param {Object} collab — collaboration data
 * @param {Object} solA
 * @param {Object} solB
 */
function explainCollaboration(collab, solA, solB) {
  const compat = collab.compat || collab.collaborationScore || 0;
  const compatWord = compat >= 85 ? 'very high' : compat >= 70 ? 'high' : compat >= 55 ? 'good' : 'moderate';

  const capsA = collab.unique_to_a || collab.capabilities_a || [];
  const capsB = collab.unique_to_b || collab.capabilities_b || [];
  
  let explanation = `${solA?.title || collab.name_a} and ${solB?.title || collab.name_b} were identified as collaboration candidates with ${compatWord} compatibility (${compat}%). `;
  
  if (capsA.length > 0 && capsB.length > 0) {
    explanation += `${solA?.title || collab.name_a} brings ${capsA.slice(0,2).join(' and ')}, while ${solB?.title || collab.name_b} contributes ${capsB.slice(0,2).join(' and ')}. `;
    explanation += 'These capabilities are complementary rather than competing, making collaboration potentially valuable.';
  } else if (collab.rationale) {
    explanation += collab.rationale;
  }
  
  return {
    compatibility: compat,
    compatibilityLabel: compatWord,
    explanation,
    disclaimer: 'This is a recommendation for human review only. IP ownership, revenue sharing, and legal arrangements must be independently negotiated. InnovateX does not assign IP rights or make binding collaboration decisions.',
  };
}

/* ── Risk explanation ────────────────────────────────────────── */
/**
 * Explain risk assessment results in natural language.
 * @param {Object} riskResult — from riskEngine
 */
function explainRisks(riskResult) {
  if (!riskResult || !riskResult.risks?.length) {
    return {
      summary: `No significant risk indicators were detected for ${riskResult?.solutionTitle || 'this solution'} based on available information.`,
      details: [],
    };
  }
  
  const risks = riskResult.risks;
  const highRisks = risks.filter(r => ['critical','high'].includes(r.severity));
  const summary = `${risks.length} risk indicator(s) were identified for ${riskResult.solutionTitle}. ` +
    (highRisks.length > 0 ? `${highRisks.length} require immediate attention.` : 'None are critical at this stage.');
  
  return {
    summary,
    riskLevel: riskResult.riskLevel,
    details: risks.map(r => ({
      name: r.name,
      severity: r.severityLabel,
      explanation: r.message,
      mitigation: r.mitigation,
    })),
  };
}

/* ── Pilot explanation ───────────────────────────────────────── */
/**
 * Explain pilot KPI results.
 * @param {Object} pilot
 */
function explainPilot(pilot) {
  if (!pilot) return null;
  
  const kpis = pilot.kpis || [];
  const exceeded = kpis.filter(k => k.status === 'exceeded');
  const onTrack = kpis.filter(k => k.status === 'on_track');
  const failing = kpis.filter(k => k.status === 'failed' || k.status === 'below_target');
  
  let narrative = `The ${pilot.title || 'pilot'} has reached ${pilot.progress || 0}% completion. `;
  
  if (exceeded.length > 0) {
    narrative += `${exceeded.length} KPI(s) have exceeded their targets: ${exceeded.map(k => k.label).join(', ')}. `;
  }
  if (onTrack.length > 0) {
    narrative += `${onTrack.length} KPI(s) are on track. `;
  }
  if (failing.length > 0) {
    narrative += `${failing.length} KPI(s) need attention: ${failing.map(k => k.label).join(', ')}. `;
  }
  
  if (pilot.results?.what_worked) {
    narrative += `What worked: ${pilot.results.what_worked} `;
  }
  
  return {
    narrative,
    pilotScore: pilot.pilot_score,
    kpiBreakdown: { exceeded: exceeded.length, onTrack: onTrack.length, failing: failing.length, total: kpis.length },
    stage: pilot.current_stage,
    progress: pilot.progress,
  };
}

/* ── Generic question answering from structured data ─────────── */
/**
 * Generate a natural-language answer for a data query.
 * @param {string} queryType
 * @param {Object} data
 */
function generateAnswer(queryType, data) {
  const generators = {
    score_explanation: () => explainScore(data.scoring, data.solution, data.problem),
    collaboration_explanation: () => explainCollaboration(data.collab, data.solA, data.solB),
    risk_explanation: () => explainRisks(data.risk),
    pilot_explanation: () => explainPilot(data.pilot),
    
    solution_summary: () => {
      const sol = data.solution;
      return {
        answer: `${sol.title} (by ${sol.team}) is a ${sol.approach || 'innovative'} solution with an AI score of ${sol.ai_scores?.total || 'pending'}/100. ${sol.desc}`,
        keyFacts: [
          `Team: ${sol.team}`,
          `Tech: ${(sol.tech || []).join(', ')}`,
          `Status: ${sol.status}`,
          sol.estimated_cost ? `Cost: ${sol.estimated_cost}` : '',
        ].filter(Boolean),
      };
    },
    
    problem_summary: () => {
      const prob = data.problem;
      return {
        answer: `"${prob.title}" is an open problem from ${prob.org} with ${prob.solutions_count} solutions submitted. Prize: ${prob.prize}. ${prob.desc}`,
        keyFacts: [
          `Category: ${prob.category}`,
          `Impact: ${prob.impact}`,
          `Deadline: ${prob.deadline}`,
          `Stage: ${prob.stage}`,
        ],
      };
    },
    
    platform_info: () => ({
      answer: data.answer || 'Information about InnovateX.',
      keyFacts: data.facts || [],
    }),
  };
  
  return (generators[queryType] || (() => ({ answer: 'Unable to generate explanation for this query type.', keyFacts: [] })))();
}

module.exports = { explainScore, explainCollaboration, explainRisks, explainPilot, generateAnswer, scoreWord };
