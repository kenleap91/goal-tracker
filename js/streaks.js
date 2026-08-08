/**
 * Date helpers and streak math. Pure functions only, no DOM/storage access,
 * so they're easy to reason about and reuse regardless of where the data
 * came from.
 */
(function (global) {
  'use strict';

  var WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

  function toDateStr(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function parseDateStr(str) {
    var parts = str.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(date, delta) {
    var copy = new Date(date);
    copy.setDate(copy.getDate() + delta);
    return copy;
  }

  function diffDays(dateStrA, dateStrB) {
    var a = parseDateStr(dateStrA);
    var b = parseDateStr(dateStrB);
    var msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((b.getTime() - a.getTime()) / msPerDay);
  }

  /**
   * Current streak as of `asOfDateStr`, counting consecutive completed days
   * backward. If `asOfDateStr` itself isn't completed yet, the streak is
   * still "alive" as long as the previous day was completed (today isn't
   * over yet), matching how most habit trackers count streaks.
   */
  function computeCurrentStreak(dateSet, asOfDateStr) {
    var anchor = parseDateStr(asOfDateStr);
    if (!dateSet.has(asOfDateStr)) {
      anchor = addDays(anchor, -1);
    }
    var streak = 0;
    var cursor = anchor;
    while (dateSet.has(toDateStr(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function computeBestStreak(dateSet) {
    var dates = Array.from(dateSet).sort();
    var best = 0;
    var current = 0;
    var prev = null;
    for (var i = 0; i < dates.length; i++) {
      var d = dates[i];
      if (prev !== null && diffDays(prev, d) === 1) {
        current++;
      } else {
        current = 1;
      }
      if (current > best) best = current;
      prev = d;
    }
    return best;
  }

  /**
   * Days between the most recent completion on/before `asOfDateStr` and
   * `asOfDateStr` itself. Returns 0 if completed on that date, null if
   * never completed on or before that date.
   */
  function daysSinceLastDone(dateSet, asOfDateStr) {
    var dates = Array.from(dateSet).filter(function (d) { return d <= asOfDateStr; }).sort();
    if (dates.length === 0) return null;
    var last = dates[dates.length - 1];
    return diffDays(last, asOfDateStr);
  }

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.streaks = {
    WEEKDAY_JA: WEEKDAY_JA,
    toDateStr: toDateStr,
    parseDateStr: parseDateStr,
    addDays: addDays,
    diffDays: diffDays,
    computeCurrentStreak: computeCurrentStreak,
    computeBestStreak: computeBestStreak,
    daysSinceLastDone: daysSinceLastDone
  };
})(window);
