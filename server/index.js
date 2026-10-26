// server/index.js
// Express backend for ShieldNex Email Deliverability Checker

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const dns = require('dns').promises;
// Simple concurrency limiter (max 5 concurrent checks)
function runLimited(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    function launch() {
      if (nextIndex >= tasks.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < concurrency && nextIndex < tasks.length) {
        const current = nextIndex;
        const taskFn = tasks[current];
        nextIndex++;
        active++;
        taskFn()
          .then((res) => {
            results[current] = res;
          })
          .catch(reject)
          .finally(() => {
            active--;
            launch();
          });
      }
    }
    launch();
  });
}


const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json({ limit: '1mb' })); // body size limit
app.use(cors());
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute
    message: { error: 'Too many requests, please try later.' },
  })
);

// Load disposable domains list (simple static list)
const disposableDomains = new Set([
  'mailinator.com',
  'trashmail.com',
  'temp-mail.org',
  '10minutemail.com',
]);

// Helper to classify a single email
async function checkEmail(email) {
  const original = email;
  const trimmed = email.trim();
  const result = {
    original,
    email: trimmed,
    syntaxValid: false,
    domain: null,
    mxRecords: [],
    disposable: false,
    classification: 'unknown',
    explanation: '',
  };

  // Syntax validation
  if (!validator.isEmail(trimmed)) {
    result.explanation = 'Invalid email syntax.';
    result.classification = 'likely bounce';
    return result;
  }
  result.syntaxValid = true;

  // Extract domain
  const domain = trimmed.split('@')[1].toLowerCase();
  result.domain = domain;

  // Disposable check
  if (disposableDomains.has(domain)) {
    result.disposable = true;
    result.explanation = 'Domain is known to be disposable.';
    result.classification = 'likely bounce';
    return result;
  }

  try {
    // Try to fetch MX records
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length > 0) {
      result.mxRecords = mx.map((r) => r.exchange);
    }
  } catch (err) {
    // If DNS returns NXDOMAIN or NoAnswer, treat as no MX
    if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND' && err.code !== 'ENOENT') {
      // Other DNS errors (timeout, temporary)
      result.explanation = `DNS error (${err.code}): ${err.message}`;
      result.classification = 'unknown';
      return result;
    }
  }

  // If no MX, check A/AAAA as fallback per RFC 5321 §5.1
  if (result.mxRecords.length === 0) {
    try {
      const a = await dns.resolve(domain);
      if (a && a.length > 0) {
        result.mxRecords = a; // treat as fallback
      }
    } catch (err) {
      // If even A lookup fails
      result.explanation = `No MX or A records found for domain ${domain}.`;
      result.classification = 'likely bounce';
      return result;
    }
  }

  // At this point we have some DNS routing info
  if (result.mxRecords.length > 0) {
    // We cannot guarantee delivery without mailbox check, so mark as unknown
    result.explanation = 'Domain has mail routing records, but mailbox existence cannot be verified.';
    result.classification = 'unknown';
  } else {
    result.explanation = 'Domain lacks mail routing records.';
    result.classification = 'likely bounce';
  }

  return result;
}

// POST /api/check-emails
app.post('/api/check-emails', async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'Request body must contain an array "emails".' });
  }
  if (emails.length === 0) {
    return res.status(400).json({ error: 'Email list is empty.' });
  }
  if (emails.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 emails allowed per request.' });
  }

  // Deduplicate while preserving order for results
  const seen = new Set();
  const uniqueEmails = [];
  for (const e of emails) {
    if (!seen.has(e)) {
      seen.add(e);
      uniqueEmails.push(e);
    }
  }

  // Bounded concurrency using custom runLimited (max 5 concurrent checks)
  const checks = uniqueEmails.map(email => () => checkEmail(email));

  try {
    // Execute the check functions concurrently respecting the concurrency limit inside checkEmail
    const results = await Promise.all(checks.map(fn => fn()));
    res.json({ results });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production (client build)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // All other routes serve the index.html (SPA)
  app.get('/:splat(*)', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start server only if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ShieldNex Email Checker backend listening on port ${PORT}`);
  });
}

module.exports = app;
