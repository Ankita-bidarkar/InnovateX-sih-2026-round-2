'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Recommendation Engine
   ai/recommendation/recommendationEngine.js

   Deterministic, threshold-based procurement recommendations.
   Does NOT use a chatbot or LLM for decisions.
   ============================================================ */

/* ── Configurable thresholds ─────────────────────────────────── */
const DEFAULT_THRESHOLDS = {
  shortlist: 85,      // >= 85 → Shortlisted
  improvement: 70,    // 70–84 → Needs Improvement
  // < 70 → Not Shortlisted
};

/* ── Recommendation statuses ─────────────────────────────────── */
const RECOMMENDATIONS = {
  shortlisted: {
    label: 'Shortlisted',
    icon: '🏆',
    color: 'green',
    badge: 'badge-green',
    description: 'Solution meets or exceeds scoring threshold for shortlisting.',
  },
  needs_improvement: {
    label: 'Needs Improvement',
    icon: '⚠️',
    color: 'amber',
    badge: 'badge-amber',
    description: 'Solution shows potential but requires improvement before shortlisting.',
  },
  not_shortlisted: {
    label: 'Not Shortlisted',
    icon: '✗',
    color: 'red',
    badge: 'badge-red',
    description: 'Solution does not meet minimum requirements for shortlisting at this stage.',
  },
  pilot_recommended: {
    label: 'Pilot Recommended',
    icon: '🚀',
    color: 'blue',
    badge: 'badge-blue',
    description: 'Solution meets pilot criteria based on score and risk profile.',
  },
  scale_recommended: {
    label: 'Scale Recommended',
    icon: '📈',
    color: 'green',
    badge: 'badge-green',
    description: 'Pilot evidence supports scaling the solution.',
  },
  more_evidence_needed: {
    label: 'More Evidence Needed',
    icon: '📋',
    color: 'amber',
    badge: 'badge-amber',
    description: 'Insufficient pilot evidence to make a confident recommendation.',
  },
};

/* ── Evidence-based pilot recommendation ────────────────────── */
function pilotRecommendation(pilot) {
  if (!pilot) return null;
  
  const score = pilot.pilot_score || pilot.ai_eval_score || 0;
  const kpis = pilot.kpis || [];
  
  const exceededCount = kpis.filter(k => k.status === 'exceeded').length;
  const onTrackCount = kpis.filter(k => k.status === 'on_track').length;
  const failedCount = kpis.filter(k => k.status === 'failed' || k.status === 'below_target').length;
  
  const totalKPIs = kpis.length;
  const successRate = totalKPIs > 0 ? ((exceededCount + onTrackCount) / totalKPIs) * 100 : 0;
  
  let recommendation;
  let rationale = [];
  
  if (score >= 85 && failedCount === 0 && successRate >= 80) {
    recommendation = RECOMMENDATIONS.scale_recommended;
    rationale.push(`Pilot score of ${score}/100 exceeds threshold`);
    rationale.push(`${exceededCount} of ${totalKPIs} KPIs exceeded targets`);
    rationale.push(`Zero critical KPI failures`);
  } else if (score >= 70 && failedCount <= 1 && successRate >= 60) {
    recommendation = RECOMMENDATIONS.pilot_recommended;
    rationale.push(`Pilot score of ${score}/100 meets improvement threshold`);
    rationale.push(`${succeededCount + onTrackCount} of ${totalKPIs} KPIs on track`);
    if (failedCount > 0) rationale.push(`${failedCount} KPI(s) need attention`);
  } else {
    recommendation = RECOMMENDATIONS.more_evidence_needed;
    rationale.push(`Pilot score of ${score}/100 is below threshold for confident recommendation`);
    if (failedCount > 0) rationale.push(`${failedCount} KPI(s) are failing`);
    rationale.push('Extend pilot period or address gaps before procurement decision');
  }
  
  return {
    ...recommendation,
    pilotScore: score,
    kpiSummary: { exceeded: exceededCount, onTrack: onTrackCount, failed: failedCount, total: totalKPIs },
    successRate: Math.round(successRate),
    rationale,
    finalDecisionNote: 'The final procurement decision must be made by the authorised organisation representative, not by InnovateX AI.',
  };
}

/* ── Main recommendation function ───────────────────────────── */
/**
 * Generate a deterministic recommendation for a solution.
 * @param {Object} scoringResult — from scoringEngine
 * @param {Object} riskResult — from riskEngine
 * @param {Object} eligibilityResult — from eligibilityEngine
 * @param {Object} pilot — optional pilot data
 * @param {Object} thresholds — optional custom thresholds
 * @returns {Object} recommendation
 */
function recommend(scoringResult, riskResult, eligibilityResult, pilot, thresholds = DEFAULT_THRESHOLDS) {
  const score = scoringResult?.overallScore ?? scoringResult?.total ?? 0;
  const risks = riskResult?.risks || [];
  const highRisks = risks.filter(r => ['critical','high'].includes(r.severity));
  const isEligible = eligibilityResult?.eligibilityStatus?.label?.includes('Eligible');

  let baseRecommendation;
  let modifiers = [];
  let rationale = [];

  // Base recommendation from score
  if (score >= thresholds.shortlist) {
    baseRecommendation = RECOMMENDATIONS.shortlisted;
    rationale.push(`AI Score of ${score}/100 meets the shortlisting threshold of ${thresholds.shortlist}.`);
  } else if (score >= thresholds.improvement) {
    baseRecommendation = RECOMMENDATIONS.needs_improvement;
    rationale.push(`AI Score of ${score}/100 falls within the "Needs Improvement" range (${thresholds.improvement}–${thresholds.shortlist - 1}).`);
  } else {
    baseRecommendation = RECOMMENDATIONS.not_shortlisted;
    rationale.push(`AI Score of ${score}/100 is below the minimum threshold of ${thresholds.improvement}.`);
  }

  // Risk modifiers — high risks can downgrade
  if (highRisks.length > 0) {
    if (baseRecommendation === RECOMMENDATIONS.shortlisted) {
      baseRecommendation = RECOMMENDATIONS.needs_improvement;
      modifiers.push(`Downgraded from Shortlisted due to ${highRisks.length} high-severity risk(s)`);
    }
    rationale.push(`High-severity risks detected: ${highRisks.map(r => r.name).join(', ')}.`);
  }

  // Eligibility modifier
  if (eligibilityResult && !isEligible && eligibilityResult.eligibilityStatus?.label !== 'Potentially Eligible') {
    modifiers.push('Eligibility concerns affect recommendation confidence');
    rationale.push('Startup eligibility status is not fully confirmed.');
  }

  // Pilot evidence enhances recommendation
  const pilotRec = pilot ? pilotRecommendation(pilot) : null;
  if (pilotRec) {
    rationale.push(`Pilot evidence: ${pilotRec.rationale.join('. ')}.`);
    if (pilotRec.label === RECOMMENDATIONS.scale_recommended.label) {
      rationale.push('Strong pilot evidence supports a positive procurement decision.');
    }
  }

  const dimensions = scoringResult?.dimensions || {};
  const topDimension = Object.entries(dimensions).sort((a, b) => b[1] - a[1])[0];
  const bottomDimension = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0];

  if (topDimension) {
    rationale.push(`Strongest dimension: ${topDimension[0]} (${topDimension[1]}/100).`);
  }
  if (bottomDimension && bottomDimension[1] < 60) {
    rationale.push(`Weakest dimension: ${bottomDimension[0]} (${bottomDimension[1]}/100) — area for improvement.`);
  }

  return {
    recommendation: baseRecommendation,
    score,
    modifiers,
    rationale,
    pilotRecommendation: pilotRec,
    thresholds,
    disclaimer: 'This recommendation is generated by deterministic InnovateX Intelligence Engine algorithms. Final procurement decisions must be made by authorized organizational representatives.',
    confidenceLevel: modifiers.length === 0 ? 'High' : modifiers.length === 1 ? 'Medium' : 'Low',
  };
}

/**
 * Generate recommendations for all solutions in a set.
 */
function recommendAll(analysisResult, riskResults = [], eligibilityResults = []) {
  return (analysisResult?.scores || []).map(scored => {
    const risk = riskResults.find(r => r.solutionId === scored.id);
    const eligibility = eligibilityResults.find(e => e.teamId);
    
    return {
      id: scored.id,
      title: scored.title,
      ...recommend(scored, risk, eligibility),
    };
  });
}

module.exports = { recommend, recommendAll, pilotRecommendation, RECOMMENDATIONS, DEFAULT_THRESHOLDS };
