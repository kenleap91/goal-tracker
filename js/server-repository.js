/**
 * Supabase-backed implementation of the repository interface documented in
 * storage.js. RLS policies scope every row to the signed-in user, so no
 * client-side filtering by user_id is needed for reads.
 */
(function (global) {
  'use strict';

  var ACTIVITIES_TABLE = 'goal_tracker_activities';
  var COMPLETIONS_TABLE = 'goal_tracker_completions';

  function toActivity(row) {
    return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at };
  }

  function ServerRepository(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  function check(res) {
    if (res.error) throw res.error;
    return res;
  }

  ServerRepository.prototype.getActivities = function () {
    return this.client
      .from(ACTIVITIES_TABLE)
      .select('*')
      .order('created_at', { ascending: true })
      .then(function (res) {
        check(res);
        return res.data.map(toActivity);
      });
  };

  ServerRepository.prototype.addActivity = function (input) {
    var name = (input && input.name || '').trim();
    var color = (input && input.color) || '#8a5cf6';
    return this.client
      .from(ACTIVITIES_TABLE)
      .insert({ user_id: this.userId, name: name, color: color })
      .select()
      .single()
      .then(function (res) {
        check(res);
        return toActivity(res.data);
      });
  };

  ServerRepository.prototype.deleteActivity = function (id) {
    return this.client
      .from(ACTIVITIES_TABLE)
      .delete()
      .eq('id', id)
      .then(function (res) {
        check(res);
      });
  };

  ServerRepository.prototype.getCompletions = function () {
    return this.client
      .from(COMPLETIONS_TABLE)
      .select('activity_id, date')
      .then(function (res) {
        check(res);
        var out = {};
        res.data.forEach(function (row) {
          if (!out[row.activity_id]) out[row.activity_id] = [];
          out[row.activity_id].push(row.date);
        });
        return out;
      });
  };

  ServerRepository.prototype.setCompletion = function (activityId, dateStr, done) {
    if (done) {
      return this.client
        .from(COMPLETIONS_TABLE)
        .upsert(
          { user_id: this.userId, activity_id: activityId, date: dateStr },
          { onConflict: 'activity_id,date', ignoreDuplicates: true }
        )
        .then(check);
    }
    return this.client
      .from(COMPLETIONS_TABLE)
      .delete()
      .eq('activity_id', activityId)
      .eq('date', dateStr)
      .then(check);
  };

  ServerRepository.prototype.toggleCompletion = function (activityId, dateStr) {
    var self = this;
    return this.client
      .from(COMPLETIONS_TABLE)
      .select('id')
      .eq('activity_id', activityId)
      .eq('date', dateStr)
      .maybeSingle()
      .then(function (res) {
        check(res);
        if (res.data) {
          return self.client
            .from(COMPLETIONS_TABLE)
            .delete()
            .eq('id', res.data.id)
            .then(function (delRes) { check(delRes); return false; });
        }
        return self.client
          .from(COMPLETIONS_TABLE)
          .insert({ user_id: self.userId, activity_id: activityId, date: dateStr })
          .then(function (insRes) { check(insRes); return true; });
      });
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ServerRepository = ServerRepository;
})(window);
