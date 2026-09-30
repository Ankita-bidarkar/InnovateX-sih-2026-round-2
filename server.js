'use strict';

/* ============================================================
   InnovateX — Backend Server
   server.js

   Express server powering the InnovateX Intelligence Engine.
   No external AI APIs (Gemini, OpenAI, Claude, etc.) are used.
   Optionally connects to a locally-hosted LLM via LOCAL_AI_ENDPOINT.
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

/* ── Middleware ─────────────────────────────────────────────── */
app.use(cors());
app.use(express.json({ limit: '4mb' }));

/* ── Static files ───────────────────────────────────────────── */
// Serve all HTML, CSS, JS, images from the project root
app.use(express.static(path.join(__dirname)));

// Explicit routes for all HTML pages
const htmlPages = [
  'index.html', 'auth.html', 'dashboard.html', 'problem.html',
  'ai-analysis.html', 'expert-review.html', 'collaborate.html', 'pilot.html', 'procurement.html',
  'profile.html', 'startup-verification.html',
];

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

htmlPages.forEach(page => {
  const route = '/' + page;
  app.get(route, (_req, res) => res.sendFile(path.join(__dirname, page)));
  // Also serve without .html extension
  app.get(route.replace('.html', ''), (_req, res) => res.sendFile(path.join(__dirname, page)));
});

/* ── InnovateX Intelligence Engine ─────────────────────────── */
const IX = require('./ai/index');

/* ── Demo data (mirrors frontend data.js for server use) ────── */
// Import lightweight version of IX data for server-side processing
const IX_DEMO_DATA = require('./ai/data/demoData');

/* ── Health check ───────────────────────────────────────────── */
app.get('/api/health', async (_req, res) => {
  let localAIStatus = false;
  let localAIModel = null;

  try {
    localAIStatus = await IX.localLLM.isAvailable();
    if (localAIStatus) localAIModel = IX.localLLM.LOCAL_AI_MODEL;
  } catch { /* silent */ }

  res.json({
    status: 'ok',
    engine: 'InnovateX Intelligence Engine v1.0',
    localAI: localAIStatus,
    localAIModel: localAIModel,
    message: localAIStatus
      ? `InnovateX Intelligence Engine ready. Local AI: ${localAIModel}`
      : 'InnovateX Intelligence Engine ready. Local AI not configured — core intelligence features fully available.',
    features: {
      scoring: true,
      similarity: true,
      collaboration: true,
      eligibility: true,
      risk: true,
      recommendation: true,
      explanation: true,
      chat: true,
      localLLM: localAIStatus,
    },
  });
});

/* ── POST /api/analyze ──────────────────────────────────────── */
// Analyse solutions for a problem using InnovateX Intelligence Engine
app.post('/api/analyze', async (req, res) => {
  const { problem, solutions } = req.body || {};

  if (!problem || !Array.isArray(solutions) || !solutions.length) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'problem and a non-empty solutions[] array are required.',
    });
  }

  try {
    // Core scoring analysis
    const analysis = IX.scoring.analyzeAll(problem, solutions);

    // Risk assessment for each solution
    const riskResults = IX.risk.assessAllRisks(solutions, problem);

    // Collaboration opportunities
    const collaborations = IX.collaboration.findCollaborations(problem, solutions, IX_DEMO_DATA.solutions);

    // Merge risk data into explanations
    const enhancedExplanations = analysis.explanations.map(exp => {
      const risk = riskResults.find(r => r.solutionId === exp.id);
      return { ...exp, risks: risk?.risks || [], riskLevel: risk?.riskLevel || 'Low' };
    });

    res.json({
      success: true,
      source: 'InnovateX Intelligence Engine',
      version: '1.0',
      data: {
        ...analysis,
        explanations: enhancedExplanations,
        riskAssessments: riskResults,
        collaborationOpportunities: collaborations.slice(0, 5),
      },
    });

  } catch (err) {
    console.error('Analysis error:', err?.message || err);
    res.status(500).json({
      error: 'ENGINE_ERROR',
      message: 'InnovateX Intelligence Engine encountered an error. Please try again.',
    });
  }
});

/* ── POST /api/collaborate ──────────────────────────────────── */
app.post('/api/collaborate', async (req, res) => {
  const { problem, solutions } = req.body || {};

  if (!problem || !Array.isArray(solutions) || solutions.length < 2) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'problem and at least 2 solutions are required.',
    });
  }

  try {
    const collaborations = IX.collaboration.findCollaborations(problem, solutions, IX_DEMO_DATA.solutions);
    const similarities = solutions.length >= 2
      ? IX.similarity.compareSolutions(solutions[0], solutions[1], solutions)
      : null;

    res.json({
      success: true,
      source: 'InnovateX Intelligence Engine',
      collaborations,
      similarities,
      totalOpportunities: collaborations.length,
    });
  } catch (err) {
    console.error('Collaboration error:', err?.message);
    res.status(500).json({ error: 'ENGINE_ERROR', message: 'Collaboration analysis failed.' });
  }
});

/* ── POST /api/eligibility ──────────────────────────────────── */
app.post('/api/eligibility', (req, res) => {
  const { team } = req.body || {};
  if (!team) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'team data is required.' });
  }

  try {
    const result = IX.eligibility.checkEligibility(team);
    res.json({ success: true, source: 'InnovateX Intelligence Engine', data: result });
  } catch (err) {
    console.error('Eligibility error:', err?.message);
    res.status(500).json({ error: 'ENGINE_ERROR', message: 'Eligibility check failed.' });
  }
});

/* ── POST /api/recommend ────────────────────────────────────── */
app.post('/api/recommend', (req, res) => {
  const { scoringResult, riskResult, eligibilityResult, pilot, thresholds } = req.body || {};

  if (!scoringResult) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'scoringResult is required.' });
  }

  try {
    const result = IX.recommendation.recommend(scoringResult, riskResult, eligibilityResult, pilot, thresholds);
    res.json({ success: true, source: 'InnovateX Intelligence Engine', data: result });
  } catch (err) {
    console.error('Recommendation error:', err?.message);
    res.status(500).json({ error: 'ENGINE_ERROR', message: 'Recommendation generation failed.' });
  }
});

/* ── POST /api/chat ─────────────────────────────────────────── */
// Ask IX chatbot endpoint
app.post('/api/chat', async (req, res) => {
  const { question, context } = req.body || {};

  if (!question?.trim()) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'question is required.' });
  }

  try {
    const answer = await IX.chat.processQuestion(question, IX_DEMO_DATA, context || {});
    res.json({ success: true, ...answer });
  } catch (err) {
    console.error('Chat error:', err?.message);
    res.status(500).json({
      error: 'ENGINE_ERROR',
      message: 'Ask IX encountered an error. Please try again.',
      type: 'error',
      text: 'I encountered an error processing your question. Please try again.',
      followUpSuggestions: ['How does InnovateX score solutions?', 'What is a pilot?'],
    });
  }
});

/* ── POST /api/similarity ───────────────────────────────────── */
app.post('/api/similarity', (req, res) => {
  const { solutionA, solutionB, allSolutions } = req.body || {};
  if (!solutionA || !solutionB) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'solutionA and solutionB are required.' });
  }

  try {
    const result = IX.similarity.compareSolutions(solutionA, solutionB, allSolutions || []);
    res.json({ success: true, source: 'InnovateX Intelligence Engine', data: result });
  } catch (err) {
    console.error('Similarity error:', err?.message);
    res.status(500).json({ error: 'ENGINE_ERROR', message: 'Similarity comparison failed.' });
  }
});

/* ── 404 handler for API routes ─────────────────────────────── */
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'API endpoint not found.' });
});

/* ── Start server ───────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log('');
  console.log('  ██╗███╗  ██╗███╗  ██╗ ██████╗ ██╗   ██╗ █████╗ ████████╗███████╗██╗  ██╗');
  console.log('  ██║████╗ ██║████╗ ██║██╔═══██╗██║   ██║██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝');
  console.log('  ██║██╔██╗██║██╔██╗██║██║   ██║██║   ██║███████║   ██║   █████╗   ╚███╔╝ ');
  console.log('  ██║██║╚████║██║╚████║██║   ██║╚██╗ ██╔╝██╔══██║   ██║   ██╔══╝   ██╔██╗ ');
  console.log('  ██║██║ ╚███║██║ ╚███║╚██████╔╝ ╚████╔╝ ██║  ██║   ██║   ███████╗██╔╝╚██╗');
  console.log('  ╚═╝╚═╝  ╚══╝╚═╝  ╚══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝');
  console.log('');
  console.log(`  InnovateX Intelligence Engine`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Local AI: ${process.env.LOCAL_AI_ENDPOINT ? process.env.LOCAL_AI_ENDPOINT : 'Not configured (core intelligence still available)'}`);
  console.log('');
});
