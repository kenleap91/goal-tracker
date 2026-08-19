/**
 * UI layer for the shared household chore log ("家事履歴"). Each row is a
 * place/task with a single last-done timestamp; the "実施" button bumps it
 * to now, and the date label can be tapped to correct it (or clear it back
 * to 未実施) rather than keeping a full history.
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

  // yyyy-mm-dd for a <input type="date">, in local time.
  function toDateInputValue(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // Noon local time avoids the date shifting by a day across timezones
  // when the string is later parsed back with `new Date(...)`.
  function fromDateInputValue(value) {
    return new Date(value + 'T12:00:00').toISOString();
  }

  // Days from today (local) until dateStr (yyyy-mm-dd). Negative = overdue.
  function daysUntil(dateStr) {
    var today = new Date();
    var todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var parts = dateStr.split('-').map(Number);
    var target = new Date(parts[0], parts[1] - 1, parts[2]);
    return Math.round((target - todayDay) / 86400000);
  }

  function nextDueLabel(dateStr) {
    var diff = daysUntil(dateStr);
    var mmdd = dateStr.slice(5).replace('-', '/');
    if (diff < 0) return '次回 ' + mmdd + '(期限切れ)';
    if (diff === 0) return '次回 ' + mmdd + '(今日)';
    return '次回 ' + mmdd + '(あと' + diff + '日)';
  }

  function ChoreApp(repo) {
    this.repo = repo;
    this.chores = [];
    this.editingId = null;

    this.dom = {
      list: document.getElementById('chore-list'),
      empty: document.getElementById('chore-empty'),

      addBtn: document.getElementById('add-chore-btn'),
      dialog: document.getElementById('add-chore-dialog'),
      form: document.getElementById('add-chore-form'),
      nameInput: document.getElementById('chore-name-input'),
      nextDueInput: document.getElementById('chore-next-due-input'),
      cancelBtn: document.getElementById('chore-cancel-btn'),

      dateDialog: document.getElementById('edit-chore-date-dialog'),
      dateForm: document.getElementById('edit-chore-date-form'),
      dateInput: document.getElementById('chore-date-input'),
      nextDueEditInput: document.getElementById('chore-next-due-edit-input'),
      dateClearBtn: document.getElementById('chore-date-clear-btn'),
      dateCancelBtn: document.getElementById('chore-date-cancel-btn')
    };
  }

  ChoreApp.prototype.init = function () {
    var self = this;
    this.bindEvents();
    global.GoalTracker.enableDragReorder(this.dom.list, '.drag-handle', function (ids) {
      self.persistOrder(ids);
    });
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
      self.dom.nextDueInput.value = '';
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

    this.dom.dateCancelBtn.addEventListener('click', function () {
      self.dom.dateDialog.close();
    });
    this.dom.dateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      self.handleDateSubmit();
    });
    this.dom.dateClearBtn.addEventListener('click', function () {
      self.handleDateClear();
    });
  };

  ChoreApp.prototype.handleAddSubmit = function () {
    var self = this;
    var name = this.dom.nameInput.value.trim();
    if (!name) return;
    var nextDueDate = this.dom.nextDueInput.value || null;
    var maxPosition = this.chores.reduce(function (max, c) { return Math.max(max, c.position || 0); }, 0);
    this.repo.addChore(name, maxPosition + 10, nextDueDate).then(function (chore) {
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

  ChoreApp.prototype.openDateDialog = function (chore) {
    this.editingId = chore.id;
    this.dom.dateInput.value = toDateInputValue(chore.lastDoneAt);
    this.dom.nextDueEditInput.value = chore.nextDueDate || '';
    this.dom.dateDialog.showModal();
    // <dialog> auto-focuses its first focusable control, which on mobile
    // pops the native date picker open instantly — before the user can
    // see which field (実施日 vs 次回実施日) they're even looking at.
    // Blur it so the picker only opens once they deliberately tap a field.
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  };

  ChoreApp.prototype.handleDateSubmit = function () {
    var self = this;
    if (!this.editingId) return;
    var value = this.dom.dateInput.value;
    var iso = value ? fromDateInputValue(value) : null;
    var nextDueDate = this.dom.nextDueEditInput.value || null;
    Promise.all([
      this.repo.updateLastDone(this.editingId, iso),
      this.repo.updateNextDueDate(this.editingId, nextDueDate)
    ]).then(function () {
      var chore = self.chores.find(function (c) { return c.id === self.editingId; });
      if (chore) {
        chore.lastDoneAt = iso;
        chore.nextDueDate = nextDueDate;
      }
      self.dom.dateDialog.close();
      self.render();
    });
  };

  ChoreApp.prototype.handleDateClear = function () {
    var self = this;
    if (!this.editingId) return;
    this.repo.updateLastDone(this.editingId, null).then(function () {
      var chore = self.chores.find(function (c) { return c.id === self.editingId; });
      if (chore) chore.lastDoneAt = null;
      self.dom.dateDialog.close();
      self.render();
    });
  };

  ChoreApp.prototype.persistOrder = function (ids) {
    var self = this;
    this.repo.updatePositions(ids).then(function () {
      ids.forEach(function (id, index) {
        var chore = self.chores.find(function (c) { return c.id === id; });
        if (chore) chore.position = (index + 1) * 10;
      });
    });
  };

  ChoreApp.prototype.buildRow = function (chore) {
    var self = this;
    var row = el('li', 'chore-row');
    row.setAttribute('data-id', chore.id);

    row.appendChild(el('span', 'drag-handle', '⠿'));

    var info = el('div', 'chore-info');
    info.appendChild(el('span', 'chore-name', chore.name));
    var sub = el('span', 'chore-sub', daysAgoLabel(chore.lastDoneAt));
    sub.addEventListener('click', function () {
      self.openDateDialog(chore);
    });
    info.appendChild(sub);
    if (chore.nextDueDate) {
      var diff = daysUntil(chore.nextDueDate);
      var badgeClass = 'chore-due-badge' + (diff <= 7 ? ' urgent' : '');
      var badge = el('span', badgeClass, nextDueLabel(chore.nextDueDate));
      badge.addEventListener('click', function () {
        self.openDateDialog(chore);
      });
      info.appendChild(badge);
    }
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
      return (a.position || 0) - (b.position || 0);
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
