/**
 * Supabase-backed access to the shared household todo list. Unlike
 * ServerRepository (goal tracker), rows aren't scoped to the signed-in
 * user by RLS — any logged-in household member can read/write all of it.
 */
(function (global) {
  'use strict';

  var TODOS_TABLE = 'goal_tracker_todos';

  function toTodo(row) {
    return {
      id: row.id,
      listType: row.list_type,
      title: row.title,
      done: row.done,
      createdAt: row.created_at,
      doneAt: row.done_at,
      position: row.position,
      dueDate: row.due_date
    };
  }

  function check(res) {
    if (res.error) throw res.error;
    return res;
  }

  function TodoRepository(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  TodoRepository.prototype.getTodos = function () {
    return this.client
      .from(TODOS_TABLE)
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .then(function (res) {
        check(res);
        return res.data.map(toTodo);
      });
  };

  TodoRepository.prototype.addTodo = function (input) {
    var title = (input && input.title || '').trim();
    var listType = (input && input.listType) || 'shared';
    var position = (input && input.position) || 0;
    var dueDate = (input && input.dueDate) || null;
    return this.client
      .from(TODOS_TABLE)
      .insert({ list_type: listType, title: title, created_by: this.userId, position: position, due_date: dueDate })
      .select()
      .single()
      .then(function (res) {
        check(res);
        return toTodo(res.data);
      });
  };

  TodoRepository.prototype.updateTodo = function (id, input) {
    var patch = {};
    if (input.title != null) patch.title = input.title.trim();
    if (input.listType != null) patch.list_type = input.listType;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;
    return this.client
      .from(TODOS_TABLE)
      .update(patch)
      .eq('id', id)
      .then(check);
  };

  TodoRepository.prototype.toggleDone = function (id, done) {
    return this.client
      .from(TODOS_TABLE)
      .update({ done: done, done_at: done ? new Date().toISOString() : null })
      .eq('id', id)
      .then(check);
  };

  TodoRepository.prototype.deleteTodo = function (id) {
    return this.client
      .from(TODOS_TABLE)
      .delete()
      .eq('id', id)
      .then(check);
  };

  // ids is an array of todo ids in their desired new order (within one
  // list_type). Positions are recomputed as sequential multiples of 10.
  TodoRepository.prototype.updatePositions = function (ids) {
    var self = this;
    return Promise.all(ids.map(function (id, index) {
      return self.client
        .from(TODOS_TABLE)
        .update({ position: (index + 1) * 10 })
        .eq('id', id)
        .then(check);
    }));
  };

  // Realtime: fires onChange({ eventType, newItem, oldId }) whenever any
  // household member's client writes to this table, so every screen stays
  // in sync without a manual refresh. newItem is the already-mapped row
  // (present for INSERT/UPDATE); oldId is the deleted row's id (DELETE).
  TodoRepository.prototype.subscribeToChanges = function (onChange) {
    return this.client
      .channel(TODOS_TABLE + '_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TODOS_TABLE }, function (payload) {
        onChange({
          eventType: payload.eventType,
          newItem: payload.new && payload.new.id ? toTodo(payload.new) : null,
          oldId: payload.old && payload.old.id
        });
      })
      .subscribe();
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.TodoRepository = TodoRepository;
})(window);
