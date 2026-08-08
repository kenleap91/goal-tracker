/**
 * Data access layer for goal-tracker.
 *
 * Everything the UI needs to read/write is defined by the "repository"
 * interface below. Today the only implementation is LocalStorageRepository,
 * which keeps everything in the browser's localStorage. All methods return
 * Promises even though localStorage is synchronous, so that a future
 * server-backed implementation (e.g. one that calls fetch()) is a drop-in
 * replacement with no changes needed in app.js.
 *
 * Repository interface:
 *   getActivities(): Promise<Activity[]>
 *   addActivity({ name, color }): Promise<Activity>
 *   deleteActivity(id): Promise<void>
 *   getCompletions(): Promise<Record<activityId, string[]>>   // dates as 'YYYY-MM-DD'
 *   setCompletion(activityId, dateStr, done): Promise<void>
 *   toggleCompletion(activityId, dateStr): Promise<boolean>   // returns new completed state
 *
 * Activity shape: { id: string, name: string, color: string, createdAt: string }
 *
 * To migrate to a server later: implement this same interface against your
 * API (e.g. ServerRepository using fetch()), then change createRepository()
 * below to return it instead. No other file needs to change.
 */
(function (global) {
  'use strict';

  var ACTIVITIES_KEY = 'goal-tracker:activities';
  var COMPLETIONS_KEY = 'goal-tracker:completions';

  function generateId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      console.warn('goal-tracker: failed to read', key, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function LocalStorageRepository() {}

  LocalStorageRepository.prototype.getActivities = function () {
    var activities = readJSON(ACTIVITIES_KEY, []);
    return Promise.resolve(activities);
  };

  LocalStorageRepository.prototype.addActivity = function (input) {
    var activities = readJSON(ACTIVITIES_KEY, []);
    var activity = {
      id: generateId(),
      name: (input && input.name || '').trim(),
      color: (input && input.color) || '#8a5cf6',
      createdAt: new Date().toISOString()
    };
    activities.push(activity);
    writeJSON(ACTIVITIES_KEY, activities);
    return Promise.resolve(activity);
  };

  LocalStorageRepository.prototype.deleteActivity = function (id) {
    var activities = readJSON(ACTIVITIES_KEY, []).filter(function (a) { return a.id !== id; });
    writeJSON(ACTIVITIES_KEY, activities);

    var completions = readJSON(COMPLETIONS_KEY, {});
    delete completions[id];
    writeJSON(COMPLETIONS_KEY, completions);

    return Promise.resolve();
  };

  LocalStorageRepository.prototype.getCompletions = function () {
    return Promise.resolve(readJSON(COMPLETIONS_KEY, {}));
  };

  LocalStorageRepository.prototype.setCompletion = function (activityId, dateStr, done) {
    var completions = readJSON(COMPLETIONS_KEY, {});
    var dates = completions[activityId] || [];
    var idx = dates.indexOf(dateStr);
    if (done && idx === -1) {
      dates.push(dateStr);
    } else if (!done && idx !== -1) {
      dates.splice(idx, 1);
    }
    completions[activityId] = dates;
    writeJSON(COMPLETIONS_KEY, completions);
    return Promise.resolve();
  };

  LocalStorageRepository.prototype.toggleCompletion = function (activityId, dateStr) {
    var completions = readJSON(COMPLETIONS_KEY, {});
    var dates = completions[activityId] || [];
    var idx = dates.indexOf(dateStr);
    var nowDone;
    if (idx === -1) {
      dates.push(dateStr);
      nowDone = true;
    } else {
      dates.splice(idx, 1);
      nowDone = false;
    }
    completions[activityId] = dates;
    writeJSON(COMPLETIONS_KEY, completions);
    return Promise.resolve(nowDone);
  };

  function createRepository() {
    // Swap this out for a server-backed implementation later, e.g.:
    //   return new ServerRepository('/api');
    return new LocalStorageRepository();
  }

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.createRepository = createRepository;
})(window);
