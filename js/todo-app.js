/**
 * UI layer for the shared household ToDo section. Mirrors the structure of
 * app.js (repo-backed, plain DOM rendering) but scoped to todos.
 */
(function (global) {
  'use strict';

  var LIST_LABELS = { shared: '共通', ken: 'Ken', nao: 'Nao' };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function TodoApp(repo) {
    this.repo = repo;
    this.todos = [];
    this.activeList = 'shared';
    this.selectedListType = 'shared';
    this.editingId = null;

    this.dom = {
      tabBtns: Array.prototype.slice.call(document.querySelectorAll('#todo-section .tab-btn')),
      list: document.getElementById('todo-list'),
      empty: document.getElementById('todo-empty'),

      addBtn: document.getElementById('add-todo-btn'),
      dialog: document.getElementById('add-todo-dialog'),
      heading: document.getElementById('todo-dialog-heading'),
      submitBtn: document.getElementById('todo-dialog-submit-btn'),
      form: document.getElementById('add-todo-form'),
      titleInput: document.getElementById('todo-title-input'),
      listPicker: document.getElementById('todo-list-picker'),
      cancelBtn: document.getElementById('todo-cancel-btn'),

      csvBtn: document.getElementById('todo-csv-btn')
    };
  }

  TodoApp.prototype.init = function () {
    var self = this;
    this.bindEvents();
    global.GoalTracker.enableDragReorder(this.dom.list, '.drag-handle', function (ids) {
      self.persistOrder(ids);
    });
    return this.loadData().then(function () {
      self.render();
    });
  };

  TodoApp.prototype.loadData = function () {
    var self = this;
    return this.repo.getTodos().then(function (todos) {
      self.todos = todos;
    });
  };

  TodoApp.prototype.bindEvents = function () {
    var self = this;

    this.dom.tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.activeList = btn.getAttribute('data-list');
        self.dom.tabBtns.forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        self.render();
      });
    });

    this.dom.addBtn.addEventListener('click', function () {
      self.openDialog();
    });
    this.dom.cancelBtn.addEventListener('click', function () {
      self.dom.dialog.close();
    });
    this.dom.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.handleFormSubmit();
    });
    Array.prototype.forEach.call(this.dom.listPicker.children, function (btn) {
      btn.addEventListener('click', function () {
        self.selectedListType = btn.getAttribute('data-list');
        Array.prototype.forEach.call(self.dom.listPicker.children, function (b) {
          b.classList.toggle('selected', b === btn);
        });
      });
    });

    this.dom.csvBtn.addEventListener('click', function () {
      self.exportCsv();
    });
  };

  // Pass a todo to edit it; call with no argument to add a new one.
  TodoApp.prototype.openDialog = function (todo) {
    this.editingId = todo ? todo.id : null;
    this.dom.heading.textContent = todo ? 'ToDoを編集' : '新しいToDo';
    this.dom.submitBtn.textContent = todo ? '保存' : '追加';
    this.dom.titleInput.value = todo ? todo.title : '';
    this.selectedListType = todo ? todo.listType : this.activeList;
    Array.prototype.forEach.call(this.dom.listPicker.children, function (b) {
      b.classList.toggle('selected', b.getAttribute('data-list') === this.selectedListType);
    }, this);
    this.dom.dialog.showModal();
    this.dom.titleInput.focus();
  };

  TodoApp.prototype.handleFormSubmit = function () {
    var self = this;
    var title = this.dom.titleInput.value.trim();
    if (!title) return;

    if (this.editingId) {
      var todo = this.todos.find(function (t) { return t.id === self.editingId; });
      this.repo.updateTodo(this.editingId, { title: title, listType: this.selectedListType }).then(function () {
        todo.title = title;
        todo.listType = self.selectedListType;
        self.dom.dialog.close();
        self.render();
      });
      return;
    }

    var maxPosition = this.todos
      .filter(function (t) { return t.listType === self.selectedListType; })
      .reduce(function (max, t) { return Math.max(max, t.position || 0); }, 0);
    this.repo.addTodo({ title: title, listType: this.selectedListType, position: maxPosition + 10 }).then(function (created) {
      self.todos.push(created);
      self.dom.dialog.close();
      self.render();
    });
  };

  TodoApp.prototype.toggleDone = function (todo) {
    var self = this;
    var done = !todo.done;
    return this.repo.toggleDone(todo.id, done).then(function () {
      todo.done = done;
      todo.doneAt = done ? new Date().toISOString() : null;
      self.render();
    });
  };

  TodoApp.prototype.deleteTodo = function (todo) {
    var self = this;
    var ok = confirm('「' + todo.title + '」を削除しますか?');
    if (!ok) return;
    this.repo.deleteTodo(todo.id).then(function () {
      self.todos = self.todos.filter(function (t) { return t.id !== todo.id; });
      self.render();
    });
  };

  TodoApp.prototype.persistOrder = function (ids) {
    var self = this;
    this.repo.updatePositions(ids).then(function () {
      ids.forEach(function (id, index) {
        var todo = self.todos.find(function (t) { return t.id === id; });
        if (todo) todo.position = (index + 1) * 10;
      });
    });
  };

  TodoApp.prototype.buildRow = function (todo) {
    var self = this;
    var row = el('li', 'todo-row' + (todo.done ? ' done' : ''));
    row.setAttribute('data-id', todo.id);

    row.appendChild(el('span', 'drag-handle', '⠿'));

    var check = el('button', 'todo-check');
    check.type = 'button';
    check.setAttribute('aria-label', '完了をマーク');
    if (todo.done) check.classList.add('checked');
    check.addEventListener('click', function () {
      self.toggleDone(todo);
    });
    row.appendChild(check);

    var title = el('span', 'todo-title', todo.title);
    title.addEventListener('click', function () {
      self.openDialog(todo);
    });
    row.appendChild(title);

    var del = el('button', 'todo-delete', '×');
    del.type = 'button';
    del.setAttribute('aria-label', '削除');
    del.addEventListener('click', function () {
      self.deleteTodo(todo);
    });
    row.appendChild(del);

    return row;
  };

  TodoApp.prototype.render = function () {
    var self = this;
    var visible = this.todos
      .filter(function (t) { return t.listType === self.activeList; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    this.dom.list.innerHTML = '';
    this.dom.empty.hidden = visible.length > 0;
    visible.forEach(function (todo) {
      self.dom.list.appendChild(self.buildRow(todo));
    });
  };

  function csvField(value) {
    var str = String(value);
    if (/[",\r\n]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  TodoApp.prototype.exportCsv = function () {
    var header = ['リスト', '内容', '完了', '作成日時', '完了日時'];
    var rows = [header].concat(this.todos.map(function (t) {
      return [LIST_LABELS[t.listType] || t.listType, t.title, t.done ? '1' : '0', t.createdAt || '', t.doneAt || ''];
    }));
    var csv = rows.map(function (row) {
      return row.map(csvField).join(',');
    }).join('\r\n');

    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'todo_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.TodoApp = TodoApp;
})(window);
