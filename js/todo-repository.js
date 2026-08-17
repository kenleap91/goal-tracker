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
      doneAt: row.done_at
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
      .order('created_at', { ascending: true })
      .then(function (res) {
        check(res);
        return res.data.map(toTodo);
      });
  };

  TodoRepository.prototype.addTodo = function (input) {
    var title = (input && input.title || '').trim();
    var listType = (input && input.listType) || 'shared';
    return this.client
      .from(TODOS_TABLE)
      .insert({ list_type: listType, title: title, created_by: this.userId })
      .select()
      .single()
      .then(function (res) {
        check(res);
        return toTodo(res.data);
      });
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

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.TodoRepository = TodoRepository;
})(window);
