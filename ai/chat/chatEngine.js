'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Chat Engine
   ai/chat/chatEngine.js

   Understands user questions, retrieves relevant data,
   and generates structured answers using the explanation engine.
   Uses local LLM if configured.
   ============================================================ */

const { explainScore, explainCollaboration, explainRisks, explainPilot } = require('../explanation/explanationEngine');
const { scoreOneSolution } = require('../scoring/scoringEngine');
const { assessRisks } = require('../risk/riskEngine');
const localLLM = require('../providers/localLLMProvider');

/* ── InnovateX platform knowledge base ──────────────────────── */
const PLATFORM_KNOWLEDGE = {
  'what is innovatex': 'InnovateX is an AI-powered Startup Procurement & Solution Intelligence Platform. It connects organisations that have real-world problems with startups that have innovative solutions, and uses AI to analyse, score, compare and evolve those solutions through a structured workflow.',
  
  'how does scoring work': 'InnovateX Intelligence Engine scores each solution across 6 dimensions: Relevance (25%), Innovation (20%), Feasibility (20%), Impact (15%), Scalability (10%), and Cost Efficiency (10%). Each dimension is calculated from the solution\'s structured data — description, approach, technologies, cost estimates, and alignment with the problem. Scores are combined using configurable weights to produce an overall score out of 100.',
  
  'what is shortlisting': 'Solutions scoring 85 or above are shortlisted. Solutions scoring 70–84 are flagged for improvement. Solutions below 70 are not shortlisted at the current stage. These thresholds are configurable and the recommendation is always generated deterministically — not by an AI chatbot.',
  
  'what is a pilot': 'A pilot is a real-world test of a shortlisted solution in a controlled environment. It includes defined KPIs (Key Performance Indicators), milestones, success criteria, and a structured evaluation. Pilots produce evidence that forms the basis of the final procurement decision.',
  
  'what are kpis': 'KPIs (Key Performance Indicators) are measurable targets set for each pilot. They track whether the solution actually delivers on its promises. Examples: energy reduction %, detection accuracy, adoption rate, cost per unit. KPIs are compared against targets: exceeded, on_track, or below_target. Procurement decisions are based on KPI evidence, not AI predictions alone.',
  
  'what is collaboration': 'InnovateX detects when two solutions are more powerful together than alone. Rather than competing, complementary startups can be recommended for collaboration. For example: one startup collects IoT sensor data, another does ML prediction — together they create a complete intelligence system. InnovateX does not merge startups or assign IP — collaboration is a recommendation for human review.',
  
  'what is dpiit': 'DPIIT stands for Department for Promotion of Industry and Internal Trade, Government of India. Startups recognised by DPIIT can access government benefits including tax exemptions, funding priority, and fast-track patent processing. DPIIT recognition is voluntary and not required for InnovateX participation. You can verify DPIIT status at startupindia.gov.in.',
  
  'what is innovatex verification': 'InnovateX Verification is a platform-level review conducted by the InnovateX team. A verified startup has been reviewed for profile completeness, solution quality, and platform compliance. InnovateX Verification is NOT equivalent to government certification. It is an internal quality signal to help organisations identify well-prepared participants.',
  
  'what is startup eligibility': 'Startup eligibility in InnovateX means meeting the basic criteria for platform participation: being a registered, active entity; having submitted at least one solution; and having a complete profile. This is separate from DPIIT government recognition.',
  
  'what is ai analysis': 'AI Analysis is the InnovateX Intelligence Engine\'s evaluation of solutions submitted for a specific problem. The engine scores each solution across 6 dimensions, identifies strengths and weaknesses, detects risks, finds collaboration opportunities, and generates a ranked shortlist. All results are calculated from structured data — not by a chatbot.',
  
  'what happens after pilot': 'After a pilot, the organisation reviews the KPI results, milestone completion, and the overall pilot score. If pilots meet or exceed their targets, the InnovateX recommendation engine suggests scaling or procurement. The final decision is always made by an authorised organisation representative — not by AI.',
  
  'how to submit a solution': 'Log in with a Startup account, navigate to the Problems page, select a problem you want to address, and use the Submit Solution form. You\'ll need to provide your solution title, description, approach, technology stack, and estimated cost.',
  
  'procurement decision': 'The final procurement decision — whether to buy, scale, or reject a solution — is always made by the problem-owning organisation. InnovateX provides AI-scored analysis, pilot evidence, and structured recommendations to inform this decision. No AI makes the final call.',
  
  'solution evolution': 'When collaboration is detected, two or more startups can evolve their individual solutions into an integrated concept. The evolved solution combines complementary capabilities from each startup. This is voluntary and requires agreement between the startups and the organisation.',
  'independent validation': 'Independent validation is a separate review gate after pilot evidence. It checks whether the reported pilot evidence is sufficiently credible before procurement readiness is considered. InnovateX treats this as a prototype workflow and does not claim government validation authority.',
  'procurement readiness': 'Procurement readiness is a structured checklist covering challenge alignment, eligibility, AI and expert evaluation, pilot KPI evidence, risk, cybersecurity, data/IP and validation. It supports a human procurement decision; it does not automatically approve procurement.',
  'milestone payment': 'Milestone and payment tracking in the InnovateX prototype represents a structured contracting workflow. It does not process real government payments.',
};

/* ── Question classification ─────────────────────────────────── */
const INTENT_PATTERNS = [
  { intent: 'explain_score',      patterns: ['score', 'why.*score', 'how.*scored', 'score.*why', 'dimension', 'relevance score', 'innovation score'] },
  { intent: 'shortlist_status',   patterns: ['shortlist', 'shortlisted', 'why shortlisted', 'not shortlisted'] },
  { intent: 'collab_info',        patterns: ['what is.*collaborat', 'how.*collaborat', 'collaborat.*work'] },
  { intent: 'explain_collab',     patterns: ['collaborat', 'match', 'why.*together', 'complementary', 'why.*pair'] },
  { intent: 'pilot_info',         patterns: ['what is.*pilot', 'how.*pilot', 'pilot process'] },
  { intent: 'kpi_info',           patterns: ['what is kpi', 'kpi mean', 'key performance', 'how are kpi'] },
  { intent: 'explain_pilot',      patterns: ['pilot', 'kpi', 'milestone', 'test result', 'pilot score', 'what happened in pilot'] },
  { intent: 'explain_risk',       patterns: ['risk', 'concern', 'problem with', 'weakness', 'gap'] },
  { intent: 'list_solutions',     patterns: ['show.*solution', 'list.*solution', 'solutions for', 'what solution', 'healthcare solution', 'agriculture solution'] },
  { intent: 'list_shortlisted',   patterns: ['shortlisted solution', 'which.*shortlist', 'top solution', 'best solution', 'ranked'] },
  { intent: 'compare_solutions',  patterns: ['compar', 'vs ', 'versus', 'difference between', 'better than'] },
  { intent: 'active_pilots',      patterns: ['active pilot', 'ongoing pilot', 'current pilot', 'what pilot'] },
  { intent: 'platform_workflow',  patterns: ['how does.*work', 'what is the process', 'workflow', 'how to', 'what happens'] },
  { intent: 'dpiit_info',         patterns: ['dpiit', 'government recognition', 'startup india', 'recognized'] },
  { intent: 'verification_info',  patterns: ['verif', 'verified startup', 'ix verification', 'innovatex verif'] },
  { intent: 'scoring_info',       patterns: ['how.*score', 'scoring work', 'ai score', 'what is a score', 'dimension score'] },
  { intent: 'eligibility_info',   patterns: ['eligib', 'who can participate', 'requirement to join'] },
  { intent: 'procurement_info',   patterns: ['procurement', 'final decision', 'buy', 'who decides'] },
  { intent: 'ask_ix_info',        patterns: ['what can you do', 'who are you', 'what is ask ix', 'help me'] },
];

function classifyIntent(question) {
  const lower = question.toLowerCase();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => new RegExp(p, 'i').test(lower))) {
      return intent;
    }
  }
  return 'general';
}

/* ── Data extraction helpers ─────────────────────────────────── */
function extractMentionedSolution(question, ixData) {
  if (!ixData?.solutions) return null;
  const lower = question.toLowerCase();
  return ixData.solutions.find(s =>
    lower.includes(s.title.toLowerCase()) ||
    lower.includes(s.team.toLowerCase()) ||
    lower.includes(s.id.toLowerCase())
  );
}

function extractMentionedProblem(question, ixData) {
  if (!ixData?.problems) return null;
  const lower = question.toLowerCase();
  return ixData.problems.find(p =>
    lower.includes(p.title.toLowerCase()) ||
    lower.includes(p.id.toLowerCase()) ||
    lower.includes(p.category.toLowerCase())
  );
}

function extractCategoryFilter(question) {
  const cats = ['agriculture','healthcare','education','technology','environment','finance','transport','smartcities','energy','cybersecurity'];
  const lower = question.toLowerCase();
  return cats.find(c => lower.includes(c));
}

/* ── Answer generators ───────────────────────────────────────── */
function generateAnswer(intent, question, ixData, context) {
  const solutions = ixData?.solutions || [];
  const problems = ixData?.problems || [];
  const pilots = ixData?.pilots || [];
  const collaborations = ixData?.collaborations || [];
  const teams = ixData?.teams || [];

  switch (intent) {
    case 'pilot_info':
      return { type:'info', text: PLATFORM_KNOWLEDGE['what is a pilot'], followUpSuggestions:['Show me active pilots','How are KPIs used in procurement?'] };

    case 'kpi_info':
      return { type:'info', text: PLATFORM_KNOWLEDGE['what are kpis'], followUpSuggestions:['What is a pilot?','How does pilot evidence affect procurement?'] };

    case 'collab_info':
      return { type:'info', text: PLATFORM_KNOWLEDGE['what is collaboration'], followUpSuggestions:['Show me collaboration opportunities','What is an evolved solution?'] };

    case 'explain_score': {
      const sol = extractMentionedSolution(question, ixData) || context?.currentSolution;
      if (sol) {
        const prob = problems.find(p => p.id === sol.problem_id);
        const scoring = scoreOneSolution(sol, prob);
        const exp = explainScore(scoring, sol, prob);
        return {
          type: 'score_explanation',
          text: exp.overallExplanation,
          solution: sol.title,
          score: scoring.overallScore,
          dimensions: scoring.dimensions,
          shortlistReason: exp.shortlistReason,
          strengths: exp.keyStrengths,
          weaknesses: exp.keyWeaknesses,
          followUpSuggestions: [
            `What are the risks for ${sol.title}?`,
            `Is ${sol.title} eligible for a pilot?`,
            'How does InnovateX score solutions?',
          ],
        };
      }
      return {
        type: 'info',
        text: PLATFORM_KNOWLEDGE['how does scoring work'],
        followUpSuggestions: ['Show me the top-scored solutions', 'What are the scoring dimensions?'],
      };
    }

    case 'list_solutions': {
      const cat = extractCategoryFilter(question);
      const prob = extractMentionedProblem(question, ixData);
      
      let filtered = solutions;
      if (prob) filtered = solutions.filter(s => s.problem_id === prob.id);
      else if (cat) filtered = solutions.filter(s => {
        const p = problems.find(pr => pr.id === s.problem_id);
        return p?.category === cat;
      });
      
      const top5 = filtered.sort((a, b) => (b.ai_scores?.total || 0) - (a.ai_scores?.total || 0)).slice(0, 5);
      
      return {
        type: 'solution_list',
        text: `Found ${filtered.length} solutions${cat ? ` in ${cat}` : ''}${prob ? ` for "${prob.title}"` : ''}.`,
        solutions: top5.map(s => ({
          id: s.id, title: s.title, team: s.team,
          score: s.ai_scores?.total || 0, status: s.status,
          problem_id: s.problem_id,
        })),
        totalCount: filtered.length,
        followUpSuggestions: top5.length > 0 ? [`Why did ${top5[0].title} score highest?`, 'Which solutions are shortlisted?'] : [],
      };
    }

    case 'list_shortlisted': {
      const shortlisted = solutions.filter(s => s.shortlisted || s.status === 'shortlisted' || (s.ai_scores?.total || 0) >= 85);
      return {
        type: 'solution_list',
        text: `${shortlisted.length} solution(s) are currently shortlisted (score ≥ 85).`,
        solutions: shortlisted.map(s => ({
          id: s.id, title: s.title, team: s.team,
          score: s.ai_scores?.total || 0, status: 'Shortlisted',
          problem_id: s.problem_id,
        })),
        totalCount: shortlisted.length,
        followUpSuggestions: ['Why was the top solution shortlisted?', 'Which shortlisted solutions have pilots?'],
      };
    }

    case 'active_pilots': {
      const active = pilots.filter(p => p.status === 'in_progress');
      return {
        type: 'pilot_list',
        text: `${active.length} pilot(s) are currently active.`,
        pilots: active.map(p => ({
          id: p.id, title: p.title, team: p.team, progress: p.progress,
          stage: p.current_stage, pilotScore: p.pilot_score || p.ai_eval_score,
        })),
        followUpSuggestions: active.length > 0 ? [`What are the KPIs for ${active[0].title}?`, 'What happens after a pilot?'] : ['What is a pilot?'],
      };
    }

    case 'explain_pilot': {
      const pilotMention = context?.currentPilot || pilots.find(p =>
        question.toLowerCase().includes(p.solution?.toLowerCase() || p.title?.toLowerCase())
      ) || pilots[0];
      
      if (pilotMention) {
        const exp = explainPilot(pilotMention);
        return {
          type: 'pilot_explanation',
          text: exp?.narrative || `Pilot "${pilotMention.title}" is at ${pilotMention.progress}% completion.`,
          pilotScore: exp?.pilotScore,
          kpiBreakdown: exp?.kpiBreakdown,
          stage: exp?.stage,
          followUpSuggestions: ['What happens after a pilot?', 'How are KPIs used in procurement?'],
        };
      }
      return {
        type: 'info',
        text: PLATFORM_KNOWLEDGE['what is a pilot'],
        followUpSuggestions: ['Show me active pilots', 'What are KPIs?'],
      };
    }

    case 'explain_collab': {
      const collab = context?.currentCollab || collaborations[0];
      if (collab) {
        const solA = solutions.find(s => s.id === collab.sol_a);
        const solB = solutions.find(s => s.id === collab.sol_b);
        const exp = explainCollaboration(collab, solA, solB);
        return {
          type: 'collab_explanation',
          text: exp.explanation,
          compatibility: exp.compatibility,
          disclaimer: exp.disclaimer,
          followUpSuggestions: ['How does collaboration work?', 'What is an evolved solution?'],
        };
      }
      return {
        type: 'info',
        text: PLATFORM_KNOWLEDGE['what is collaboration'],
        followUpSuggestions: ['How does collaboration work?', 'Show me collaboration opportunities'],
      };
    }

    case 'ask_ix_info':
      return {
        type: 'info',
        text: 'I\'m Ask IX — the InnovateX Intelligence assistant. I can help you understand InnovateX, explain AI scores, compare solutions, describe pilots, explain collaborations, and answer questions about startup verification and the procurement workflow. I retrieve and explain real platform data — I don\'t make up answers.',
        followUpSuggestions: ['How does InnovateX score solutions?', 'Show me active pilots', 'What is collaboration?'],
      };

    case 'procurement_info':
      return {
        type: 'info',
        text: `${PLATFORM_KNOWLEDGE['procurement decision']} Ask IX can explain scores, risks, and pilot evidence to inform your decision, but always clearly states that the final call belongs to you.`,
        followUpSuggestions: ['How are pilots evaluated?', 'What is a KPI?'],
      };

    default: {
      // Look up in knowledge base
      const lower = question.toLowerCase();
      const kbMatch = Object.entries(PLATFORM_KNOWLEDGE).find(([key]) =>
        lower.includes(key) || key.split(' ').some(w => lower.includes(w))
      );
      
      if (kbMatch) {
        return {
          type: 'info',
          text: kbMatch[1],
          followUpSuggestions: ['How does InnovateX score solutions?', 'What is a pilot?', 'How does collaboration work?'],
        };
      }
      
      // Stats query
      if (lower.includes('how many') || lower.includes('total') || lower.includes('count')) {
        const stats = ixData?.stats || {};
        return {
          type: 'stats',
          text: `InnovateX platform stats: ${stats.total_problems} active problems, ${stats.total_solutions} solutions submitted, ${stats.active_pilots} active pilots, ${stats.collaborations} collaboration opportunities identified, ${stats.success_rate}% pilot success rate.`,
          followUpSuggestions: ['Show me all problems', 'Show me active pilots'],
        };
      }
      
      return {
        type: 'info',
        text: 'I\'m here to help you explore InnovateX. You can ask me about specific solutions, AI scores, pilot results, collaboration opportunities, startup verification, or how the platform workflow works.',
        followUpSuggestions: [
          'How does InnovateX score solutions?',
          'Show me shortlisted solutions',
          'What are active pilots?',
          'How does collaboration work?',
        ],
      };
    }
  }
}

/* ── Main chat function ──────────────────────────────────────── */
/**
 * Process a user question and return a structured answer.
 * @param {string} question
 * @param {Object} ixData — { solutions, problems, pilots, collaborations, teams, stats }
 * @param {Object} context — current page context { currentSolution, currentPilot, currentCollab }
 * @returns {Object} answer
 */
async function processQuestion(question, ixData, context = {}) {
  if (!question?.trim()) {
    return {
      type: 'error',
      text: 'Please ask a question.',
      followUpSuggestions: ['How does InnovateX score solutions?', 'Show me active pilots'],
    };
  }

  const intent = classifyIntent(question);
  const baseAnswer = generateAnswer(intent, question, ixData, context);

  // Try to enhance with local LLM if available
  const llmAvailable = await localLLM.isAvailable();
  
  if (llmAvailable && baseAnswer.text) {
    try {
      const systemPrompt = `You are Ask IX, the InnovateX Intelligence assistant. InnovateX is an AI-powered Startup Procurement & Solution Intelligence Platform.

You have been given a structured data answer. Your job is to rephrase it clearly and conversationally for the user.

CRITICAL RULES:
- Do NOT change any numbers, scores, or facts
- Do NOT invent data not in the structured answer
- Do NOT make procurement decisions  
- Keep responses concise (2-4 sentences for simple answers, up to 6 for complex ones)
- Always add a brief disclaimer if discussing procurement: "The final decision belongs to your organisation's authorised representative."
- End with a helpful note if appropriate`;

      const userContext = `User question: "${question}"
Structured answer: ${baseAnswer.text}
Intent: ${intent}
${context.page ? `Current page: ${context.page}` : ''}`;

      const enhanced = await localLLM.generate(systemPrompt, userContext, { maxTokens: 400, temperature: 0.3 });
      if (enhanced) baseAnswer.text = enhanced.trim();
      baseAnswer.llmEnhanced = true;
    } catch {
      // Use base answer as-is
    }
  }

  return {
    ...baseAnswer,
    intent,
    question,
    disclaimer: 'Ask IX can make mistakes. Verify important procurement information.',
    timestamp: new Date().toISOString(),
  };
}

module.exports = { processQuestion, classifyIntent, PLATFORM_KNOWLEDGE };
