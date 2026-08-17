/**
 * UI layer for the shared household chore log ("家事履歴"). Each row is a
 * place/task with a single last-done timestamp; the "実施" button bumps it
 * to now rather than keeping a full history, per the feature's design.
 */
(function (global) {
  'use strict';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function daysAgoLabel(isoString) {
    if (!isoString) return '記録なし';
    var done = new Date(isoString);
    var doneDay = new Date(done.getFullYear(), done.getMonth(), done.getDate());
    var today = new Date();
    var todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var diffDays = Math.round((todayDay - doneDay) / 86400000);
    if (diffDays <= 0) return '今日実施';
    return diffDays + '日前';
  }

  function ChoreApp(repo) {
    this.repo = repo;
    this.chores = [];

    this.dom = {
      list: document.getElementById('chore-list'),
      empty: document.getElementById('chore-empty'),

      addBtn: document.getElementById('add-chore-btn'),
      dialog: document.getElementById('add-chore-dialog'),
      form: document.getElementById('add-chore-form'),
      nameInput: document.getElementById('chore-name-input'),
      cancelBtn: document.getElementById('chore-cancel-btn')
    };
  }

  ChoreApp.prototype.init = function () {
    var self = this;
    this.bindEvents();
    return this.loadData().then(function () {
      self.render();
    });
  };

  ChoreApp.prototype.loadData = function () {
    var self = this;
    return this.repo.getChores().then(function (chores) {
      self.chores = chores;
    });
  };

  ChoreApp.prototype.bindEvents = function () {
    var self = this;
    this.dom.addBtn.addEventListener('click', function () {
      self.dom.nameInput.value = '';
      self.dom.dialog.showModal();
      self.dom.nameInput.focus();
    });
    this.dom.cancelBtn.addEventListener('click', function () {
      self.dom.dialog.close();
    });
    this.dom.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.handleAddSubmit();
    });
  };

  ChoreApp.prototype.handleAddSubmit = function () {
    var self = this;
    var name = this.dom.nameInput.value.trim();
    if (!name) return;
    this.repo.addChore(name).then(function (chore) {
      self.chores.push(chore);
      self.dom.dialog.close();
      self.render();
    });
  };

  ChoreApp.prototype.markDone = function (chore) {
    var self = this;
    return this.repo.markDone(chore.id).then(function (now) {
      chore.lastDoneAt = now;
      self.render();
    });
  };

  ChoreApp.prototype.deleteChore = function (chore) {
    var self = this;
    var ok = confirm('「' + chore.name + '」を削除しますか?');
    if (!ok) return;
    this.repo.deleteChore(chore.id).then(function () {
      self.chores = self.chores.filter(function (c) { return c.id !== chore.id; });
      self.render();
    });
  };

  ChoreApp.prototype.buildRow = function (chore) {
    var self = this;
    var row = el('li', 'chore-row');

    var info = el('div', 'chore-info');
    info.appendChild(el('span', 'chore-name', chore.name));
    info.appendChild(el('span', 'chore-sub', daysAgoLabel(chore.lastDoneAt)));
    row.appendChild(info);

    var doneBtn = el('button', 'btn-primary chore-done-btn', '実施');
    doneBtn.type = 'button';
    doneBtn.addEventListener('click', function () {
      self.markDone(chore);
    });
    row.appendChild(doneBtn);

    var del = el('button', 'todo-delete', '×');
    del.type = 'button';
    del.setAttribute('aria-label', '削除');
    del.addEventListener('click', function () {
      self.deleteChore(chore);
    });
    row.appendChild(del);

    return row;
  };

  ChoreApp.prototype.render = function () {
    var self = this;
    var sorted = this.chores.slice().sort(function (a, b) {
      if (!a.lastDoneAt) return -1;
      if (!b.lastDoneAt) return 1;
      return new Date(a.lastDoneAt) - new Date(b.lastDoneAt);
    });
    this.dom.list.innerHTML = '';
    this.dom.empty.hidden = sorted.length > 0;
    sorted.forEach(function (chore) {
      self.dom.list.appendChild(self.buildRow(chore));
    });
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ChoreApp = ChoreApp;
})(window);
