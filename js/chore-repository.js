/**
 * Supabase-backed access to the shared household chore log. Same sharing
 * model as TodoRepository: any logged-in household member can read/write.
 */
(function (global) {
  'use strict';

  var CHORES_TABLE = 'goal_tracker_chores';

  function toChore(row) {
    return { id: row.id, name: row.name, lastDoneAt: row.last_done_at };
  }

  function check(res) {
    if (res.error) throw res.error;
    return res;
  }

  function ChoreRepository(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  ChoreRepository.prototype.getChores = function () {
    return this.client
      .from(CHORES_TABLE)
      .select('*')
      .then(function (res) {
        check(res);
        return res.data.map(toChore);
      });
  };

  ChoreRepository.prototype.addChore = function (name) {
    return this.client
      .from(CHORES_TABLE)
      .insert({ name: (name || '').trim(), updated_by: this.userId })
      .select()
      .single()
      .then(function (res) {
        check(res);
        return toChore(res.data);
      });
  };

  ChoreRepository.prototype.markDone = function (id) {
    var self = this;
    var now = new Date().toISOString();
    return this.client
      .from(CHORES_TABLE)
      .update({ last_done_at: now, updated_by: self.userId })
      .eq('id', id)
      .then(check)
      .then(function () { return now; });
  };

  ChoreRepository.prototype.deleteChore = function (id) {
    return this.client
      .from(CHORES_TABLE)
      .delete()
      .eq('id', id)
      .then(check);
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ChoreRepository = ChoreRepository;
})(window);
