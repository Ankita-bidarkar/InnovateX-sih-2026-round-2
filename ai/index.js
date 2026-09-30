'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Main Export
   ai/index.js
   ============================================================ */

const scoring       = require('./scoring/scoringEngine');
const similarity    = require('./similarity/similarityEngine');
const collaboration = require('./collaboration/collaborationEngine');
const eligibility   = require('./eligibility/eligibilityEngine');
const risk          = require('./risk/riskEngine');
const recommendation = require('./recommendation/recommendationEngine');
const explanation   = require('./explanation/explanationEngine');
const chat          = require('./chat/chatEngine');
const localLLM      = require('./providers/localLLMProvider');

module.exports = {
  scoring,
  similarity,
  collaboration,
  eligibility,
  risk,
  recommendation,
  explanation,
  chat,
  localLLM,
};
