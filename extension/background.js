/**
 * Unbreaking News - Background Service Worker
 * Handles claim analysis, scoring, and cross-tab communication
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const SENSATIONAL_WORDS = [
  // Clickbait phrases (high confidence misinformation markers)
  'they don\'t want you to know', 'exposed truth', 'what they\'re hiding',
  'mainstream media won\'t tell', 'wake up sheeple', 'exposed', 'exposed!',
  
  // Manipulative marketing
  'doctors hate', 'one weird trick', 'you won\'t believe',
  'miracle cure', 'secret they', 'banned by',
  
  // Conspiracy markers
  'hoax', 'false flag', 'cover-up', 'coverup', 'deep state',
  'plandemic', 'scamdemic',
  
  // Extreme sensationalism (only when clearly clickbait)
  'bombshell', 'earth-shattering', 'mind-blowing'
];

// Words that REDUCE suspicion (indicate factual/educational content)
const CREDIBILITY_BOOSTERS = [
  'according to', 'study shows', 'research indicates', 'published in',
  'peer-reviewed', 'data shows', 'statistics from', 'reported by',
  'university', 'journal', 'scientific', 'evidence suggests',
  'definition', 'defined as', 'refers to', 'is called', 'known as',
  'mathematically', 'theorem', 'formula', 'equation', 'proof',
  'historically', 'in history', 'championship', 'tournament', 'final',
  'won the', 'defeated', 'victory', 'score was', 'world cup', 'olympic'
];

// Context patterns - absolute words are OK in these contexts
const EDUCATIONAL_CONTEXT = /definition|theorem|law of|principle|formula|mathematics|physics|chemistry|biology|always (equals|results|produces|means|refers)|by definition/i;

const SPORTS_CONTEXT = /world cup|championship|tournament|olympic|final|semi-final|quarter-final|match|game|team|player|coach|season|league|cup|trophy|medal|won|defeated|victory|score/i;

const SCIENCE_CONTEXT = /scientific|study|research|university|professor|journal|published|peer-reviewed|experiment|hypothesis|theory|evidence|data|analysis/i;

const CREDIBLE_DOMAINS = [
  // Major news wire services
  'reuters.com', 'apnews.com', 'afp.com',
  
  // Established news organizations
  'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org', 'cnn.com', 
  'nytimes.com', 'washingtonpost.com', 'theguardian.com',
  'wsj.com', 'economist.com', 'ft.com',
  
  // Scientific/Academic
  'nature.com', 'science.org', 'sciencedirect.com', 
  'ncbi.nlm.nih.gov', 'pubmed.gov', 'jstor.org',
  'arxiv.org', 'scholar.google.com', 'researchgate.net',
  
  // Reference/Educational
  'wikipedia.org', 'britannica.com', 'khanacademy.org',
  'mathworld.wolfram.com', 'wolframalpha.com',
  'stanford.edu', 'mit.edu', 'harvard.edu', 'oxford.ac.uk',
  
  // Government & Official
  'gov', 'edu', 'who.int', 'cdc.gov', 'nih.gov', 'nasa.gov',
  'un.org', 'europa.eu', 'worldbank.org',
  
  // Fact-checkers
  'snopes.com', 'factcheck.org', 'politifact.com', 'fullfact.org',
  
  // Sports (official sources)
  'fifa.com', 'olympics.com', 'espn.com', 'nba.com', 'nfl.com',
  'uefa.com', 'mlb.com', 'nhl.com'
];

const FACT_CHECK_SITES = [
  { name: 'Snopes', url: 'https://www.snopes.com/search/' },
  { name: 'PolitiFact', url: 'https://www.politifact.com/search/?q=' },
  { name: 'FactCheck.org', url: 'https://www.factcheck.org/?s=' },
  { name: 'Full Fact', url: 'https://fullfact.org/search/?q=' }
];

// ============================================
// EXTERNAL API INTEGRATION
// ============================================

/**
 * Query Google Fact Check API for existing fact-checks
 * FREE - requires API key from Google Cloud Console
 * Docs: https://developers.google.com/fact-check/tools/api
 */
async function queryGoogleFactCheck(claimText) {
  const { apiKeys = {} } = await chrome.storage.local.get(['apiKeys']);
  
  if (!apiKeys.googleFactCheck) {
    return { available: false, reason: 'No API key configured' };
  }
  
  try {
    const query = encodeURIComponent(claimText.substring(0, 200));
    const response = await fetch(
      `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${query}&key=${apiKeys.googleFactCheck}`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.claims && data.claims.length > 0) {
      // Found matching fact-checks!
      return {
        available: true,
        found: true,
        claims: data.claims.slice(0, 3).map(claim => ({
          text: claim.text,
          claimant: claim.claimant,
          reviews: claim.claimReview?.map(review => ({
            publisher: review.publisher?.name,
            rating: review.textualRating,
            url: review.url,
            title: review.title
          })) || []
        }))
      };
    }
    
    return { available: true, found: false };
  } catch (error) {
    console.error('Google Fact Check API error:', error);
    return { available: false, error: error.message };
  }
}

/**
 * Query Wikidata for structured facts
 * COMPLETELY FREE - no API key needed
 * Use for: sports results, elections, dates, factual queries
 */
async function queryWikidata(claimText) {
  const lowerClaim = claimText.toLowerCase();
  
  // Detect what kind of fact to verify
  let sparqlQuery = null;
  let queryType = null;
  
  // World Cup winner detection
  const worldCupMatch = lowerClaim.match(/(\d{4}).*(?:world cup|fifa)/i) || 
                        lowerClaim.match(/(?:world cup|fifa).*(\d{4})/i);
  if (worldCupMatch) {
    const year = worldCupMatch[1];
    queryType = 'world_cup';
    sparqlQuery = `
      SELECT ?winner ?winnerLabel ?eventLabel WHERE {
        ?event wdt:P31 wd:Q19317;           # instance of FIFA World Cup
               wdt:P580 ?startDate;          # start date
               wdt:P1346 ?winner.            # winner
        FILTER(YEAR(?startDate) = ${year})
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 1
    `;
  }
  
  // US President detection
  const presidentMatch = lowerClaim.match(/president.*(?:united states|us|usa|america)/i) ||
                         lowerClaim.match(/(?:united states|us|usa|america).*president/i);
  if (presidentMatch && !sparqlQuery) {
    queryType = 'us_president';
    sparqlQuery = `
      SELECT ?president ?presidentLabel ?startDate WHERE {
        ?president wdt:P39 wd:Q11696.       # position held: President of USA
        ?president p:P39 ?statement.
        ?statement ps:P39 wd:Q11696.
        OPTIONAL { ?statement pq:P580 ?startDate. }
        OPTIONAL { ?statement pq:P582 ?endDate. }
        FILTER(!BOUND(?endDate))            # No end date = current
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 1
    `;
  }
  
  // Olympics winner detection
  const olympicsMatch = lowerClaim.match(/(\d{4}).*(?:olympic|olympics)/i);
  if (olympicsMatch && !sparqlQuery) {
    queryType = 'olympics';
    // Generic Olympics query - would need more specific implementation
  }
  
  if (!sparqlQuery) {
    return { available: true, found: false, reason: 'No structured query available for this claim type' };
  }
  
  try {
    const response = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`,
      {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'UnbreakingNews/1.0 (Browser Extension)'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Wikidata error: ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.results?.bindings;
    
    if (results && results.length > 0) {
      const result = results[0];
      
      if (queryType === 'world_cup') {
        const winner = result.winnerLabel?.value;
        const event = result.eventLabel?.value;
        return {
          available: true,
          found: true,
          queryType,
          fact: `${winner} won the ${event}`,
          data: { winner, event }
        };
      }
      
      if (queryType === 'us_president') {
        const president = result.presidentLabel?.value;
        return {
          available: true,
          found: true,
          queryType,
          fact: `The current President of the United States is ${president}`,
          data: { president }
        };
      }
    }
    
    return { available: true, found: false };
  } catch (error) {
    console.error('Wikidata query error:', error);
    return { available: false, error: error.message };
  }
}

/**
 * Query ClaimBuster for check-worthiness score
 * FREE - requires API key from https://idir.uta.edu/claimbuster/
 */
async function queryClaimBuster(claimText) {
  const { apiKeys = {} } = await chrome.storage.local.get(['apiKeys']);
  
  if (!apiKeys.claimBuster) {
    return { available: false, reason: 'No API key configured' };
  }
  
  try {
    const response = await fetch(
      `https://idir.uta.edu/claimbuster/api/v2/score/text/${encodeURIComponent(claimText)}`,
      {
        headers: {
          'x-api-key': apiKeys.claimBuster
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`ClaimBuster error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // ClaimBuster returns a score 0-1 indicating how "check-worthy" the claim is
    if (data.results && data.results.length > 0) {
      const score = data.results[0].score;
      return {
        available: true,
        checkWorthiness: score,
        isCheckWorthy: score > 0.5,
        interpretation: score > 0.7 ? 'Highly check-worthy claim' :
                       score > 0.5 ? 'Moderately check-worthy' :
                       score > 0.3 ? 'Low priority for fact-checking' :
                       'Likely not a factual claim'
      };
    }
    
    return { available: true, found: false };
  } catch (error) {
    console.error('ClaimBuster API error:', error);
    return { available: false, error: error.message };
  }
}

// Store current claim data for popup access
let currentClaimData = null;

// ============================================
// FACT VERIFICATION VIA WEB SEARCH
// ============================================

/**
 * Verify factual claims by searching the web
 * Returns verification result with supporting evidence
 */
async function verifyFactualClaim(claimText) {
  try {
    // Extract key entities and facts from the claim
    const searchQuery = extractSearchQuery(claimText);
    
    // Use Google search to find verification
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    // For hackathon: we'll do client-side verification prompts
    // In production: integrate with Google Fact Check API or similar
    
    return {
      canVerify: true,
      searchQuery,
      verificationLinks: [
        {
          name: 'Google Search',
          url: searchUrl,
          type: 'search'
        },
        {
          name: 'Google News',
          url: `https://news.google.com/search?q=${encodeURIComponent(searchQuery)}`,
          type: 'news'
        },
        {
          name: 'Wikipedia',
          url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(searchQuery)}`,
          type: 'reference'
        }
      ],
      suggestion: 'Click links above to verify this factual claim'
    };
  } catch (error) {
    console.error('Verification error:', error);
    return { canVerify: false };
  }
}

/**
 * Extract the most searchable query from a claim
 */
function extractSearchQuery(text) {
  // Remove common filler words for better search
  let query = text
    .replace(/^(i heard that|someone said|apparently|supposedly|they say)\s*/i, '')
    .replace(/[!?]+/g, '')
    .trim();
  
  // If it's about a specific event, add verification keywords
  const eventPatterns = [
    { pattern: /won the (.*?)(world cup|championship|election|award)/i, suffix: ' winner' },
    { pattern: /died|passed away/i, suffix: ' death confirmed' },
    { pattern: /announced|confirmed|revealed/i, suffix: ' official' }
  ];
  
  for (const { pattern, suffix } of eventPatterns) {
    if (pattern.test(query)) {
      query = query.substring(0, 100) + suffix;
      break;
    }
  }
  
  // Limit length for search
  return query.substring(0, 150);
}

/**
 * Check claim against known facts database (expandable)
 * Returns null if no match, or { isTrue, correction } if found
 */
function checkKnownFacts(text) {
  const lowerText = text.toLowerCase();
  
  // Known facts database - easily expandable
  const KNOWN_FACTS = [
    {
      patterns: [/argentina.*won.*world cup.*2022/i, /2022.*world cup.*argentina/i],
      isTrue: true,
      fact: 'Argentina won the 2022 FIFA World Cup, defeating France in the final.'
    },
    {
      patterns: [/france.*won.*world cup.*2022/i, /2022.*world cup.*france.*won/i],
      isTrue: false,
      fact: 'France did NOT win the 2022 World Cup. Argentina won, defeating France in the final.',
      correction: 'Argentina won the 2022 FIFA World Cup.'
    },
    {
      patterns: [/france.*won.*world cup.*2018/i, /2018.*world cup.*france/i],
      isTrue: true,
      fact: 'France won the 2018 FIFA World Cup in Russia.'
    },
    {
      patterns: [/earth.*flat/i, /flat.*earth/i],
      isTrue: false,
      fact: 'The Earth is not flat. It is an oblate spheroid.',
      correction: 'Scientific consensus confirms Earth is roughly spherical.'
    },
    {
      patterns: [/covid.*5g/i, /5g.*covid|5g.*corona/i],
      isTrue: false,
      fact: 'There is no connection between 5G and COVID-19. This is a debunked conspiracy theory.',
      correction: 'COVID-19 is caused by the SARS-CoV-2 virus, not 5G technology.'
    },
    {
      patterns: [/vaccines.*cause.*autism/i, /autism.*caused.*vaccine/i],
      isTrue: false,
      fact: 'Vaccines do not cause autism. This claim has been thoroughly debunked.',
      correction: 'Multiple large studies have found no link between vaccines and autism.'
    },
    {
      patterns: [/trump.*won.*2020/i, /2020.*election.*stolen/i],
      isTrue: false,
      fact: 'Joe Biden won the 2020 US Presidential Election. Claims of widespread fraud were rejected by courts.',
      correction: 'Biden won 306 electoral votes to Trump\'s 232.'
    },
    {
      patterns: [/biden.*won.*2020/i, /biden.*president.*2020/i],
      isTrue: true,
      fact: 'Joe Biden won the 2020 US Presidential Election.'
    },
    {
      patterns: [/trump.*won.*2024/i, /trump.*president.*2024/i],
      isTrue: true,
      fact: 'Donald Trump won the 2024 US Presidential Election.'
    }
  ];
  
  for (const entry of KNOWN_FACTS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(lowerText)) {
        return {
          matched: true,
          isTrue: entry.isTrue,
          fact: entry.fact,
          correction: entry.correction || null
        };
      }
    }
  }
  
  return { matched: false };
}

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('Unbreaking News extension installed');
  
  // Create context menu item
  chrome.contextMenus.create({
    id: 'verify-claim',
    title: 'Verify this claim',
    contexts: ['selection']
  });
  
  // Initialize default settings
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          showFloatingButton: true,
          autoAnalyze: false,
          privacyMode: true,
          theme: 'auto'
        },
        reports: [],
        analysisHistory: []
      });
    }
  });
});

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'analyzeClaim':
      handleClaimAnalysis(request.text, request.url, request.domain)
        .then(sendResponse);
      return true; // Keep channel open for async response
      
    case 'getCurrentClaim':
      sendResponse(currentClaimData);
      return false;
      
    case 'saveReport':
      saveUserReport(request.report).then(sendResponse);
      return true;
      
    case 'getReports':
      getReports().then(sendResponse);
      return true;
      
    case 'getAnalysisHistory':
      getAnalysisHistory().then(sendResponse);
      return true;
      
    case 'clearHistory':
      clearHistory().then(sendResponse);
      return true;
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'verify-claim' && info.selectionText) {
    const url = new URL(tab.url);
    handleClaimAnalysis(info.selectionText, tab.url, url.hostname)
      .then(data => {
        currentClaimData = data;
        // Notify content script to show results
        chrome.tabs.sendMessage(tab.id, {
          action: 'showResults',
          data: data
        });
      });
  }
});

// ============================================
// CLAIM ANALYSIS ENGINE
// ============================================

async function handleClaimAnalysis(text, pageUrl, domain) {
  const timestamp = Date.now();
  
  // Check against known facts database FIRST
  const knownFactCheck = checkKnownFacts(text);
  
  // Run all analysis in parallel (including external APIs)
  const [
    heuristicScore,
    domainTrust,
    evidenceLinks,
    wikidataResult,
    googleFactCheckResult
  ] = await Promise.all([
    analyzeHeuristics(text),
    analyzeDomainTrust(domain, pageUrl),
    generateEvidenceLinks(text),
    queryWikidata(text),        // FREE - no key needed
    queryGoogleFactCheck(text)  // Needs API key
  ]);
  
  // Get verification links
  const verification = await verifyFactualClaim(text);
  
  // Adjust score based on known facts OR external API results
  let adjustedHeuristic = { ...heuristicScore };
  let factCheckResult = knownFactCheck;
  
  // If Wikidata found a result, use it to verify
  if (wikidataResult.found && wikidataResult.fact) {
    const wikiFact = wikidataResult.fact.toLowerCase();
    const claimLower = text.toLowerCase();
    
    // Check if the claim matches or contradicts Wikidata
    if (wikidataResult.queryType === 'world_cup') {
      const winner = wikidataResult.data.winner.toLowerCase();
      
      // Check if claim mentions the correct winner
      if (claimLower.includes(winner)) {
        factCheckResult = {
          matched: true,
          isTrue: true,
          fact: wikidataResult.fact,
          source: 'Wikidata'
        };
      } else {
        // Check if claim mentions a different team as winner
        const teams = ['argentina', 'france', 'germany', 'brazil', 'spain', 'italy', 'england'];
        const mentionedTeam = teams.find(t => claimLower.includes(t) && claimLower.includes('won'));
        if (mentionedTeam && mentionedTeam !== winner) {
          factCheckResult = {
            matched: true,
            isTrue: false,
            fact: `This claim appears incorrect. ${wikidataResult.fact}`,
            correction: wikidataResult.fact,
            source: 'Wikidata'
          };
        }
      }
    }
  }
  
  // If Google Fact Check found results, add them
  let externalFactChecks = [];
  if (googleFactCheckResult.found && googleFactCheckResult.claims) {
    externalFactChecks = googleFactCheckResult.claims;
    
    // If a professional fact-checker has rated this claim
    const firstReview = googleFactCheckResult.claims[0]?.reviews?.[0];
    if (firstReview) {
      const rating = firstReview.rating?.toLowerCase() || '';
      const isFalseRating = ['false', 'pants on fire', 'fake', 'incorrect', 'wrong', 'misleading'].some(r => rating.includes(r));
      const isTrueRating = ['true', 'correct', 'accurate', 'verified'].some(r => rating.includes(r));
      
      if (isFalseRating && !factCheckResult.matched) {
        factCheckResult = {
          matched: true,
          isTrue: false,
          fact: `Rated "${firstReview.rating}" by ${firstReview.publisher}`,
          source: firstReview.publisher,
          url: firstReview.url
        };
      } else if (isTrueRating && !factCheckResult.matched) {
        factCheckResult = {
          matched: true,
          isTrue: true,
          fact: `Rated "${firstReview.rating}" by ${firstReview.publisher}`,
          source: firstReview.publisher,
          url: firstReview.url
        };
      }
    }
  }
  
  // Apply fact-check results to score
  if (factCheckResult.matched) {
    if (factCheckResult.isTrue) {
      adjustedHeuristic.score = Math.min(100, adjustedHeuristic.score + 20);
      adjustedHeuristic.flags.unshift({
        type: 'verified-true',
        severity: 'positive',
        message: `✓ Verified: ${factCheckResult.fact}`,
        source: factCheckResult.source || 'Internal database'
      });
    } else {
      adjustedHeuristic.score = Math.max(0, Math.min(30, adjustedHeuristic.score - 40));
      adjustedHeuristic.flags.unshift({
        type: 'verified-false',
        severity: 'critical',
        message: `✗ FALSE: ${factCheckResult.fact}`,
        source: factCheckResult.source || 'Internal database'
      });
      if (factCheckResult.correction) {
        adjustedHeuristic.flags.splice(1, 0, {
          type: 'correction',
          severity: 'info',
          message: `Correction: ${factCheckResult.correction}`
        });
      }
    }
  }
  
  // Calculate overall credibility score
  const overallScore = calculateOverallScore(adjustedHeuristic, domainTrust);
  
  // Determine recommendation based on fact-check status
  let recommendation;
  if (factCheckResult.matched && !factCheckResult.isTrue) {
    recommendation = {
      level: 'false',
      color: '#dc2626',
      message: 'This claim has been fact-checked and found to be FALSE.',
      icon: '❌'
    };
  } else if (factCheckResult.matched && factCheckResult.isTrue) {
    recommendation = {
      level: 'verified',
      color: '#16a34a',
      message: 'This claim has been verified as accurate.',
      icon: '✅'
    };
  } else {
    recommendation = getRecommendation(overallScore);
  }
  
  const analysis = {
    id: `claim_${timestamp}`,
    timestamp,
    claim: text.substring(0, 500),
    pageUrl,
    domain,
    scores: {
      overall: factCheckResult.matched && !factCheckResult.isTrue ? Math.min(overallScore, 25) : overallScore,
      heuristic: adjustedHeuristic,
      domainTrust: domainTrust
    },
    evidenceLinks,
    verification,
    factCheck: factCheckResult,
    externalFactChecks,  // Results from Google Fact Check API
    wikidataResult,      // Results from Wikidata
    flags: adjustedHeuristic.flags,
    recommendation
  };
  
  // Store for popup access
  currentClaimData = analysis;
  
  // Save to history
  await saveToHistory(analysis);
  
  return analysis;
}

/**
 * Analyze text using heuristic patterns
 * Returns score 0-100 (higher = more credible)
 */
function analyzeHeuristics(text) {
  const flags = [];
  let score = 70; // Start neutral-positive
  const lowerText = text.toLowerCase();
  
  // First, detect content type for context-aware analysis
  const isEducational = EDUCATIONAL_CONTEXT.test(text);
  const isSports = SPORTS_CONTEXT.test(text);
  const isScientific = SCIENCE_CONTEXT.test(text);
  const hasCredibleContext = isEducational || isSports || isScientific;
  
  // BOOST: Check for credibility indicators FIRST
  const boosterCount = CREDIBILITY_BOOSTERS.filter(phrase => 
    lowerText.includes(phrase.toLowerCase())
  ).length;
  
  if (boosterCount > 0) {
    const boost = Math.min(boosterCount * 6, 25); // Max +25
    score += boost;
    flags.push({
      type: 'credible-context',
      severity: 'positive',
      message: `Contains ${boosterCount} credibility indicator(s)`
    });
  }
  
  // Check for sensational language (only clear clickbait phrases)
  const sensationalMatches = SENSATIONAL_WORDS.filter(word => 
    lowerText.includes(word.toLowerCase())
  );
  
  if (sensationalMatches.length > 0) {
    const penalty = sensationalMatches.length * 10;
    score -= penalty;
    flags.push({
      type: 'sensational',
      severity: sensationalMatches.length > 2 ? 'high' : 'medium',
      message: `Contains sensational phrase(s): "${sensationalMatches[0]}"`
    });
  }
  
  // Check for excessive capitalization (but not for short text or acronyms)
  const words = text.split(/\s+/);
  const allCapsWords = words.filter(w => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  const capsRatio = allCapsWords.length / words.length;
  
  if (capsRatio > 0.3 && words.length > 5) {
    score -= 12;
    flags.push({
      type: 'caps',
      severity: 'medium',
      message: 'Excessive capitalization detected'
    });
  }
  
  // Check for excessive punctuation (multiple ! or ?)
  const excessivePunctuation = /[!]{2,}|[?]{3,}|[!?]{2,}/.test(text);
  if (excessivePunctuation) {
    score -= 8;
    flags.push({
      type: 'punctuation',
      severity: 'low',
      message: 'Excessive punctuation (!!, ???)'
    });
  }
  
  // Check for unverifiable statistics (skip if educational/scientific context)
  const hasStats = /\d+%|millions of|billions of|thousands of/i.test(text);
  const hasSourceForStats = /according to|study|research|survey|report|data|census|official/i.test(text);
  
  if (hasStats && !hasSourceForStats && !hasCredibleContext) {
    score -= 8;
    flags.push({
      type: 'stats',
      severity: 'medium',
      message: 'Statistics without apparent source'
    });
  }
  
  // Check for absolute language - ONLY in suspicious contexts
  // Skip this check entirely for educational, sports, or scientific content
  if (!hasCredibleContext) {
    const suspiciousAbsolutes = /everyone knows|exposed|they always|always lying|never trust|all of them are|none of them/i;
    if (suspiciousAbsolutes.test(text)) {
      score -= 6;
      flags.push({
        type: 'absolute',
        severity: 'low',
        message: 'Generalizing language in opinion context'
      });
    }
  }
  
  // Check for emotional manipulation (more specific patterns)
  const emotionalTriggers = /you won't believe what|they don't want you to|exposed:|exposed!|the truth about.*exposed|what.*doesn't want you to know/i;
  if (emotionalTriggers.test(text)) {
    score -= 15;
    flags.push({
      type: 'emotional',
      severity: 'high',
      message: 'Clickbait/manipulation pattern detected'
    });
  }
  
  // Check for fear-mongering (but not legitimate warnings)
  const fearMongering = /terrifying truth|scary fact no one|before it's too late|spread this before/i;
  if (fearMongering.test(text)) {
    score -= 12;
    flags.push({
      type: 'fear',
      severity: 'high',
      message: 'Fear-based urgency language'
    });
  }
  
  // CONTEXT BONUSES
  if (isEducational) {
    score += 10;
    flags.push({
      type: 'educational',
      severity: 'positive',
      message: 'Educational/definitional content'
    });
  }
  
  if (isSports) {
    score += 8;
    flags.push({
      type: 'sports',
      severity: 'positive',
      message: 'Sports/competition context detected'
    });
  }
  
  if (isScientific) {
    score += 10;
    flags.push({
      type: 'scientific',
      severity: 'positive',
      message: 'Scientific/research context'
    });
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    flags,
    confidence: flags.length > 0 ? 'analyzed' : 'neutral'
  };
}

/**
 * Analyze domain trustworthiness
 */
function analyzeDomainTrust(domain, url) {
  let score = 50; // Neutral starting point
  const flags = [];
  
  // Check if it's a known credible domain
  const isCredible = CREDIBLE_DOMAINS.some(d => domain.includes(d));
  if (isCredible) {
    score = 85;
    flags.push({
      type: 'trusted',
      severity: 'positive',
      message: 'Known credible news source'
    });
  }
  
  // Check for .gov or .edu domains
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
    score = 90;
    flags.push({
      type: 'official',
      severity: 'positive',
      message: 'Official government/educational domain'
    });
  }
  
  // Check for suspicious TLDs
  const suspiciousTLDs = ['.xyz', '.top', '.click', '.buzz', '.info'];
  if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
    score -= 20;
    flags.push({
      type: 'tld',
      severity: 'medium',
      message: 'Potentially suspicious domain extension'
    });
  }
  
  // Check for typosquatting patterns
  const typoPatterns = /newss|goggle|facebok|twiter|yahooo/i;
  if (typoPatterns.test(domain)) {
    score -= 30;
    flags.push({
      type: 'typo',
      severity: 'high',
      message: 'Possible typosquatting domain'
    });
  }
  
  // Check domain age indicator (heuristic: very long subdomains)
  if ((domain.match(/\./g) || []).length > 3) {
    score -= 10;
    flags.push({
      type: 'subdomain',
      severity: 'low',
      message: 'Unusual subdomain structure'
    });
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    domain,
    flags,
    isKnownSource: isCredible
  };
}

/**
 * Generate evidence/search links for verification
 */
function generateEvidenceLinks(text) {
  // Clean and encode the search query
  const query = encodeURIComponent(text.substring(0, 150));
  
  return {
    searchEngines: [
      {
        name: 'Google',
        url: `https://www.google.com/search?q=${query}`,
        icon: '🔍'
      },
      {
        name: 'DuckDuckGo',
        url: `https://duckduckgo.com/?q=${query}`,
        icon: '🦆'
      },
      {
        name: 'Bing',
        url: `https://www.bing.com/search?q=${query}`,
        icon: '🅱️'
      }
    ],
    factCheckers: FACT_CHECK_SITES.map(site => ({
      name: site.name,
      url: site.url + query,
      icon: '✓'
    })),
    googleNews: `https://news.google.com/search?q=${query}`,
    reverseImageSearch: `https://images.google.com/searchbyimage?image_url=`
  };
}

/**
 * Calculate overall credibility score
 */
function calculateOverallScore(heuristic, domain) {
  // Weighted average: 60% text analysis, 40% domain trust
  const weighted = (heuristic.score * 0.6) + (domain.score * 0.4);
  return Math.round(weighted);
}

/**
 * Get recommendation based on score
 */
function getRecommendation(score) {
  if (score >= 75) {
    return {
      level: 'credible',
      color: '#22c55e',
      message: 'This claim appears credible, but always verify important information.',
      icon: '✅'
    };
  } else if (score >= 50) {
    return {
      level: 'uncertain',
      color: '#eab308',
      message: 'This claim has some red flags. Cross-reference with trusted sources.',
      icon: '⚠️'
    };
  } else {
    return {
      level: 'suspicious',
      color: '#ef4444',
      message: 'This claim shows multiple warning signs. Verify before sharing.',
      icon: '🚨'
    };
  }
}

// ============================================
// STORAGE FUNCTIONS
// ============================================

async function saveToHistory(analysis) {
  const { settings } = await chrome.storage.local.get(['settings']);
  
  // Respect privacy mode - don't store full claims
  const historyEntry = settings?.privacyMode ? {
    id: analysis.id,
    timestamp: analysis.timestamp,
    domain: analysis.domain,
    score: analysis.scores.overall,
    recommendation: analysis.recommendation.level
  } : analysis;
  
  const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
  analysisHistory.unshift(historyEntry);
  
  // Keep only last 100 entries
  if (analysisHistory.length > 100) {
    analysisHistory.pop();
  }
  
  await chrome.storage.local.set({ analysisHistory });
}

async function saveUserReport(report) {
  const { reports = [] } = await chrome.storage.local.get(['reports']);
  
  reports.unshift({
    ...report,
    timestamp: Date.now()
  });
  
  // Keep only last 500 reports
  if (reports.length > 500) {
    reports.pop();
  }
  
  await chrome.storage.local.set({ reports });
  return { success: true, total: reports.length };
}

async function getReports() {
  const { reports = [] } = await chrome.storage.local.get(['reports']);
  return reports;
}

async function getAnalysisHistory() {
  const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
  return analysisHistory;
}

async function clearHistory() {
  await chrome.storage.local.set({ analysisHistory: [], reports: [] });
  return { success: true };
}