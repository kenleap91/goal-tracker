/**
 * Vercel serverless function: proxies stock/ETF/crypto/FX quotes from
 * Yahoo Finance's unofficial quote endpoint so the browser can fetch them
 * without hitting CORS (Yahoo doesn't send CORS headers for direct
 * browser requests). This is best-effort, unofficial, undocumented data —
 * fine for a personal net-worth dashboard, not for trading decisions.
 *
 * GET /api/quote?symbols=AAPL,7203.T,BTC-USD,JPY=X
 * -> { AAPL: { price, currency, name }, ... }
 */
module.exports = async function handler(req, res) {
  var symbolsParam = req.query.symbols;
  if (!symbolsParam) {
    res.status(400).json({ error: 'symbols query param required' });
    return;
  }

  var symbols = String(symbolsParam)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  if (symbols.length === 0) {
    res.status(400).json({ error: 'no valid symbols provided' });
    return;
  }

  try {
    var url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbols.join(','));
    var upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
      }
    });

    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream error', status: upstream.status });
      return;
    }

    var data = await upstream.json();
    var quotes = (data && data.quoteResponse && data.quoteResponse.result) || [];
    var results = {};
    quotes.forEach(function (q) {
      results[q.symbol] = {
        price: q.regularMarketPrice,
        currency: q.currency,
        name: q.shortName || q.longName || q.symbol
      };
    });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
