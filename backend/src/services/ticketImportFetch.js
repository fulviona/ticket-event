/**
 * Fetch HTML per import ticket da URL tramite proxy (Scrape.do / ScraperAPI).
 * Sportium /ticket/: pagine SPA — servono attese JS, proxy residenziali e (su Scrape.do) blockResources=false.
 */
const https = require('https');
const http = require('http');
const { pageTextLooksLikeSportiumTicket } = require('../utils/ticketPageText');

function htmlToPlainText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** ScraperAPI: tutti i parametri prima di `url` (documentazione ufficiale). */
function buildScraperApiUrl(apiKey, targetUrl, extra = {}) {
  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  params.set('url', targetUrl);
  return `https://api.scraperapi.com/?${params.toString()}`;
}

function buildScrapeDoUrl(token, targetUrl, extra = {}) {
  const params = new URLSearchParams();
  params.set('token', token);
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  params.set('url', targetUrl);
  return `https://api.scrape.do/?${params.toString()}`;
}

function fetchScraperProxyHtml(apiUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ${timeoutMs}ms`)), timeoutMs);
    const protocol = apiUrl.startsWith('https') ? https : http;
    const req = protocol.get(
      apiUrl,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          clearTimeout(timer);
          resolve(data);
        });
        res.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      }
    );
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const BLOCK_PATTERNS = [
  'Access Denied',
  '403 Forbidden',
  'Just a moment',
  'Bot detected',
  'captcha',
  'errors.edgesuite.net',
];

function isBlockedResponse(text) {
  return text.length < 100 || BLOCK_PATTERNS.some((p) => text.includes(p));
}

/**
 * @param {string} url URL target già normalizzato
 * @param {{ sportiumTicketPage?: boolean }} options
 * @returns {Promise<{ html: string, text: string } | null>}
 */
async function fetchWithScrapingService(url, options = {}) {
  const { sportiumTicketPage = false } = options;
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  const scrapeDoToken = process.env.SCRAPE_DO_TOKEN;

  if (!scraperApiKey && !scrapeDoToken) {
    console.log('[fetchWithScrapingService] Nessuna API key (SCRAPER_API_KEY o SCRAPE_DO_TOKEN)');
    return null;
  }

  const ticketLikeUrl = /\/ticket\//i.test(url);
  const strategies = [];

  /** @param {string} name @param {string} apiUrl @param {number} timeoutMs */
  const push = (name, apiUrl, timeoutMs) => {
    strategies.push({ name, apiUrl, timeoutMs });
  };

  if (sportiumTicketPage && scrapeDoToken) {
    const base = {
      render: 'true',
      super: 'true',
      geoCode: 'IT',
      blockResources: 'false',
      timeout: '90000',
    };
    push(
      'Scrape.do networkidle2 + customWait 6s + no blockResources',
      buildScrapeDoUrl(scrapeDoToken, url, {
        ...base,
        waitUntil: 'networkidle2',
        customWait: '6000',
      }),
      95000,
    );
    push(
      'Scrape.do networkidle0 + customWait 12s',
      buildScrapeDoUrl(scrapeDoToken, url, {
        ...base,
        waitUntil: 'networkidle0',
        customWait: '12000',
      }),
      95000,
    );
    push(
      'Scrape.do load + customWait 10s',
      buildScrapeDoUrl(scrapeDoToken, url, {
        ...base,
        waitUntil: 'load',
        customWait: '10000',
      }),
      95000,
    );
    push(
      'Scrape.do waitSelector #root + networkidle2',
      buildScrapeDoUrl(scrapeDoToken, url, {
        ...base,
        waitUntil: 'networkidle2',
        customWait: '4000',
        waitSelector: '#root',
      }),
      95000,
    );
    push(
      'Scrape.do waitSelector main + customWait 8s',
      buildScrapeDoUrl(scrapeDoToken, url, {
        ...base,
        waitUntil: 'networkidle2',
        customWait: '8000',
        waitSelector: 'main',
      }),
      95000,
    );
  }

  if (sportiumTicketPage && scraperApiKey) {
    push(
      'ScraperAPI premium + render + IT',
      buildScraperApiUrl(scraperApiKey, url, {
        country_code: 'it',
        render: 'true',
        premium: 'true',
      }),
      90000,
    );
    push(
      'ScraperAPI premium + wait #root',
      buildScraperApiUrl(scraperApiKey, url, {
        country_code: 'it',
        render: 'true',
        premium: 'true',
        wait_for_selector: '#root',
      }),
      90000,
    );
    if (process.env.SCRAPER_ULTRA_PREMIUM === 'true') {
      push(
        'ScraperAPI ultra_premium + render',
        buildScraperApiUrl(scraperApiKey, url, {
          country_code: 'it',
          render: 'true',
          ultra_premium: 'true',
        }),
        90000,
      );
    }
  }

  if (!sportiumTicketPage) {
    if (scraperApiKey) {
      push(
        'ScraperAPI render=false',
        buildScraperApiUrl(scraperApiKey, url, { country_code: 'it' }),
        20000,
      );
      push(
        'ScraperAPI render=true',
        buildScraperApiUrl(scraperApiKey, url, { country_code: 'it', render: 'true' }),
        45000,
      );
    }
    if (scrapeDoToken) {
      push(
        'Scrape.do render + super',
        buildScrapeDoUrl(scrapeDoToken, url, {
          render: 'true',
          super: 'true',
          geoCode: 'IT',
          blockResources: 'false',
          waitUntil: 'networkidle2',
          customWait: '3000',
          timeout: '60000',
        }),
        65000,
      );
    }
  }

  for (const { name, apiUrl, timeoutMs } of strategies) {
    try {
      console.log(`[fetchWithScrapingService] ${name}, timeout ${timeoutMs}ms`);
      const html = await fetchScraperProxyHtml(apiUrl, timeoutMs);
      const text = htmlToPlainText(html);
      if (isBlockedResponse(text)) {
        console.log(`[fetchWithScrapingService] ${name}: bloccato/vuoto (${text.length} char)`);
        continue;
      }
      if (sportiumTicketPage) {
        if (!pageTextLooksLikeSportiumTicket(text)) {
          console.log(
            `[fetchWithScrapingService] ${name}: ${text.length} char, contenuto non riconosciuto come ticket → strategia successiva`,
          );
          continue;
        }
        console.log(`[fetchWithScrapingService] OK ${text.length} char (${name})`);
        return { html, text };
      }
      if (ticketLikeUrl && !pageTextLooksLikeSportiumTicket(text) && text.length > 400) {
        console.log(`[fetchWithScrapingService] ${text.length} char senza schedina (${name}) → strategia successiva`);
        continue;
      }
      console.log(`[fetchWithScrapingService] OK ${text.length} char (${name})`);
      return { html, text };
    } catch (e) {
      console.log(`[fetchWithScrapingService] ${name}: ${e.message}`);
    }
  }

  return null;
}

module.exports = {
  fetchWithScrapingService,
  fetchScraperProxyHtml,
};
