/**
 * Thin client for the /api/quote Vercel serverless function (see
 * api/quote.js). Batches all requested symbols into one request; no
 * persistence, just an in-memory cache for the current page load.
 */
(function (global) {
  'use strict';

  var cache = {};

  // symbols: array of ticker strings (e.g. ['AAPL', '7203.T', 'BTC-USD']).
  // Returns a promise of { [symbol]: { price, currency, name } }.
  function getQuotes(symbols) {
    var unique = symbols.filter(function (s, i) { return s && symbols.indexOf(s) === i; });
    if (unique.length === 0) return Promise.resolve({});

    return fetch('/api/quote?symbols=' + encodeURIComponent(unique.join(',')))
      .then(function (res) {
        if (!res.ok) throw new Error('quote fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        unique.forEach(function (symbol) {
          if (data[symbol]) cache[symbol] = data[symbol];
        });
        return data;
      });
  }

  function getCached(symbol) {
    return cache[symbol] || null;
  }

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.priceService = {
    getQuotes: getQuotes,
    getCached: getCached
  };
})(window);
