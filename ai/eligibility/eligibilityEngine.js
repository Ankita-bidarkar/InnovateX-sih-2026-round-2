'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Eligibility Engine
   ai/eligibility/eligibilityEngine.js

   Deterministic startup eligibility checks.
   Clearly separates InnovateX verification from DPIIT recognition.
   Does NOT fabricate government certifications.
   ============================================================ */

/* ── Status label maps ──────────────────────────────────────── */
const ELIGIBILITY_STATUS = {
  eligible:             { label: 'Eligible', icon: '✓', color: 'green', description: 'Meets all basic eligibility criteria for InnovateX participation.' },
  potentially_eligible: { label: 'Potentially Eligible', icon: '◐', color: 'amber', description: 'Meets most criteria. Some information requires verification.' },
  ineligible:           { label: 'Not Eligible', icon: '✗', color: 'red', description: 'Does not meet minimum eligibility requirements at this time.' },
  unknown:              { label: 'Under Review', icon: '◌', color: 'gray', description: 'Eligibility being assessed — more information may be required.' },
};

const IX_STATUS = {
  verified:      { label: 'InnovateX Verified', icon: '✓', color: 'green',  description: 'Startup has been reviewed and verified by the InnovateX platform team.' },
  under_review:  { label: 'Under Review', icon: '◌', color: 'blue',   description: 'InnovateX verification is currently in progress.' },
  pending:       { label: 'Verification Pending', icon: '⏳', color: 'amber', description: 'Verification request submitted and awaiting review.' },
  needs_info:    { label: 'Information Required', icon: '!', color: 'amber', description: 'Additional documents or information needed to complete verification.' },
  not_verified:  { label: 'Not Verified', icon: '○', color: 'gray',  description: 'Startup has not submitted a verification request.' },
};

const DPIIT_STATUS = {
  dpiit_recognized:    { label: 'DPIIT Recognised', icon: '✓', color: 'green', description: 'Startup is recognised by the Department for Promotion of Industry and Internal Trade, Government of India.', govtSource: 'https://www.startupindia.gov.in/' },
  application_pending: { label: 'Recognition Pending', icon: '◌', color: 'blue', description: 'DPIIT recognition application submitted and under review.' },
  under_review:        { label: 'Under Review', icon: '◌', color: 'blue', description: 'DPIIT recognition application is under review.' },
  not_claimed:         { label: 'Not Claimed', icon: '○', color: 'gray', description: 'Startup has not applied for or claimed DPIIT recognition. This is voluntary and not required for InnovateX participation.' },
  unknown:             { label: 'Status Unknown', icon: '?', color: 'gray', description: 'DPIIT recognition status could not be determined from available information.' },
};

/* ── Eligibility criteria ────────────────────────────────────── */
const ELIGIBILITY_CRITERIA = [
  {
    id: 'registered_entity',
    name: 'Registered Business Entity',
    description: 'Startup is registered as a company, LLP, or partnership firm.',
    required: true,
    checker: (team) => team.verification?.startup_status !== undefined,
  },
  {
    id: 'active_status',
    name: 'Active Operational Status',
    description: 'Startup is currently operational and not dissolved or dormant.',
    required: true,
    checker: (team) => ['active', 'startup_recognized'].includes(team.verification?.startup_status),
  },
  {
    id: 'solution_submitted',
    name: 'Solution Submitted',
    description: 'Has submitted at least one solution to a relevant problem.',
    required: true,
    checker: (team) => (team.solutions || 0) > 0,
  },
  {
    id: 'profile_complete',
    name: 'Complete Profile',
    description: 'Team profile includes name, location, category and description.',
    required: true,
    checker: (team) => !!(team.name && team.location && team.category && team.desc),
  },
  {
    id: 'score_threshold',
    name: 'Minimum AI Score',
    description: 'Has achieved a minimum AI score of 70/100 on at least one solution.',
    required: false,
    checker: (team) => (team.score || 0) >= 70,
  },
  {
    id: 'ix_verification',
    name: 'InnovateX Verification',
    description: 'Has been reviewed and verified by the InnovateX platform team.',
    required: false,
    checker: (team) => team.verification?.ix_status === 'verified',
  },
  {
    id: 'dpiit_recognition',
    name: 'DPIIT Recognition',
    description: 'Recognised by the Department for Promotion of Industry and Internal Trade.',
    required: false,
    checker: (team) => team.verification?.dpiit === 'dpiit_recognized',
  },
];

/* ── Main eligibility check ─────────────────────────────────── */
/**
 * Evaluate a startup's eligibility.
 * @param {Object} team — startup/team data from IX data store
 * @returns {Object} eligibility result
 */
function checkEligibility(team) {
  if (!team) {
    return {
      eligibilityStatus: ELIGIBILITY_STATUS.unknown,
      ixVerification: IX_STATUS.not_verified,
      dpiitStatus: DPIIT_STATUS.unknown,
      criteria: [],
      passed: [],
      failed: [],
      missing: ['Team data not available'],
      disclaimer: 'InnovateX verification is a platform-level review and is not equivalent to government certification.',
    };
  }

  const v = team.verification || {};
  
  // Evaluate each criterion
  const criteriaResults = ELIGIBILITY_CRITERIA.map(criterion => {
    let passed = false;
    let missingInfo = null;
    
    try {
      passed = criterion.checker(team);
    } catch {
      missingInfo = 'Unable to evaluate — information may be missing';
    }
    
    return {
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      required: criterion.required,
      passed: missingInfo ? null : passed,
      missingInfo,
    };
  });

  const required = criteriaResults.filter(c => c.required);
  const optional = criteriaResults.filter(c => !c.required);
  
  const requiredPassed = required.filter(c => c.passed === true);
  const requiredFailed = required.filter(c => c.passed === false);
  const missingInfo = criteriaResults.filter(c => c.missingInfo);
  
  // Determine overall eligibility
  let eligibilityStatus;
  const storedEligibility = v.eligibility;
  
  if (storedEligibility === 'eligible' && requiredFailed.length === 0) {
    eligibilityStatus = ELIGIBILITY_STATUS.eligible;
  } else if (storedEligibility === 'potentially_eligible' || (requiredFailed.length === 0 && missingInfo.length > 0)) {
    eligibilityStatus = ELIGIBILITY_STATUS.potentially_eligible;
  } else if (requiredFailed.length > 0) {
    eligibilityStatus = ELIGIBILITY_STATUS.ineligible;
  } else {
    eligibilityStatus = ELIGIBILITY_STATUS.eligible;
  }

  // InnovateX verification
  const ixVerification = IX_STATUS[v.ix_status || 'not_verified'] || IX_STATUS.not_verified;
  
  // DPIIT status (IMPORTANT: we cannot verify this ourselves — only display stored status)
  const dpiitStatusKey = v.dpiit || 'unknown';
  const dpiitStatus = DPIIT_STATUS[dpiitStatusKey] || DPIIT_STATUS.unknown;
  
  // Add DPIIT number if available
  if (v.dpiit_no && dpiitStatus.label === 'DPIIT Recognised') {
    dpiitStatus.dpiitNumber = v.dpiit_no;
    dpiitStatus.verifyNote = 'Verify at startupindia.gov.in using the DPIIT number.';
  }

  return {
    teamId: team.id,
    teamName: team.name,
    eligibilityStatus,
    ixVerification,
    dpiitStatus,
    criteria: criteriaResults,
    passed: criteriaResults.filter(c => c.passed === true).map(c => c.name),
    failed: criteriaResults.filter(c => c.passed === false).map(c => c.name),
    missing: missingInfo.map(c => c.name),
    optionalScore: `${optional.filter(c => c.passed).length}/${optional.length} optional criteria met`,
    disclaimer: 'InnovateX verification is a platform-level review and is NOT equivalent to government recognition or certification. DPIIT status is self-reported and should be independently verified at startupindia.gov.in.',
    importantNote: 'InnovateX does not claim to perform government-level certification. Eligibility here refers only to participation in the InnovateX platform.',
  };
}

/**
 * Check eligibility for all teams.
 */
function checkAllEligibility(teams) {
  return teams.map(team => checkEligibility(team));
}

module.exports = { checkEligibility, checkAllEligibility, ELIGIBILITY_STATUS, IX_STATUS, DPIIT_STATUS };
