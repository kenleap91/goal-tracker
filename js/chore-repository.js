/**
 * Supabase-backed access to the shared household chore log. Same sharing
 * model as TodoRepository: any logged-in household member can read/write.
 */
(function (global) {
  'use strict';

  var CHORES_TABLE = 'goal_tracker_chores';

  function toChore(row) {
    return { id: row.id, name: row.name, lastDoneAt: row.last_done_at, position: row.position, nextDueDate: row.next_due_date };
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
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .then(function (res) {
        check(res);
        return res.data.map(toChore);
      });
  };

  ChoreRepository.prototype.addChore = function (name, position, nextDueDate) {
    return this.client
      .from(CHORES_TABLE)
      .insert({ name: (name || '').trim(), updated_by: this.userId, position: position || 0, next_due_date: nextDueDate || null })
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

  // isoStringOrNull: pass null to revert the chore to 未実施 (not yet done).
  ChoreRepository.prototype.updateLastDone = function (id, isoStringOrNull) {
    return this.client
      .from(CHORES_TABLE)
      .update({ last_done_at: isoStringOrNull, updated_by: this.userId })
      .eq('id', id)
      .then(check);
  };

  ChoreRepository.prototype.updateNextDueDate = function (id, dateOrNull) {
    return this.client
      .from(CHORES_TABLE)
      .update({ next_due_date: dateOrNull, updated_by: this.userId })
      .eq('id', id)
      .then(check);
  };

  ChoreRepository.prototype.deleteChore = function (id) {
    return this.client
      .from(CHORES_TABLE)
      .delete()
      .eq('id', id)
      .then(check);
  };

  // ids is an array of chore ids in their desired new order.
  ChoreRepository.prototype.updatePositions = function (ids) {
    var self = this;
    return Promise.all(ids.map(function (id, index) {
      return self.client
        .from(CHORES_TABLE)
        .update({ position: (index + 1) * 10 })
        .eq('id', id)
        .then(check);
    }));
  };

  ChoreRepository.prototype.subscribeToChanges = function (onChange) {
    return this.client
      .channel(CHORES_TABLE + '_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: CHORES_TABLE }, function (payload) {
        onChange({
          eventType: payload.eventType,
          newItem: payload.new && payload.new.id ? toChore(payload.new) : null,
          oldId: payload.old && payload.old.id
        });
      })
      .subscribe();
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ChoreRepository = ChoreRepository;
})(window);
