/**
 * UI layer. Talks to the repository (storage.js) for persistence and to
 * the streaks helpers (streaks.js) for all date/streak math. Nothing in
 * here knows or cares whether data lives in localStorage or a server.
 */
(function (global) {
  'use strict';

  var S = global.GoalTracker.streaks;

  var COLORS = [
    '#a855c7', '#4fc3d9', '#e2574c', '#f59e0b',
    '#22c55e', '#3b82f6', '#ec4899', '#6366f1'
  ];

  var DONE_COLOR = '#9a9a9a';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Short haptic buzz on supported devices (Android Chrome/Firefox).
  // navigator.vibrate doesn't exist on iOS Safari, so this is a no-op there.
  function vibrate(pattern) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }

  function App(repo) {
    this.repo = repo;
    this.activities = [];
    this.completionSets = {}; // activityId -> Set<string>
    this.selectedDate = new Date();
    this.calendarMonth = startOfMonth(new Date());
    this.selectedCalendarDate = new Date();
    this.activeTab = 'today';
    this.selectedColor = COLORS[0];

    this.dom = {
      currentDateLabel: document.getElementById('current-date-label'),
      dateStrip: document.getElementById('date-strip'),
      prevDay: document.getElementById('prev-day'),
      nextDay: document.getElementById('next-day'),
      todayBtn: document.getElementById('today-btn'),

      tabBtns: Array.prototype.slice.call(document.querySelectorAll('#goal-section .tab-btn')),
      panels: {
        today: document.getElementById('tab-today'),
        calendar: document.getElementById('tab-calendar'),
        stats: document.getElementById('tab-stats')
      },

      activityList: document.getElementById('activity-list'),
      emptyState: document.getElementById('empty-state'),

      calPrev: document.getElementById('cal-prev'),
      calNext: document.getElementById('cal-next'),
      calMonthLabel: document.getElementById('cal-month-label'),
      calendarWeekdays: document.getElementById('calendar-weekdays'),
      calendarGrid: document.getElementById('calendar-grid'),
      calendarDayDetail: document.getElementById('calendar-day-detail'),

      statsList: document.getElementById('stats-list'),
      statsEmpty: document.getElementById('stats-empty'),

      csvExportBtn: document.getElementById('csv-export-btn'),
      csvExportDialog: document.getElementById('csv-export-dialog'),
      csvExportForm: document.getElementById('csv-export-form'),
      csvStartDate: document.getElementById('csv-start-date'),
      csvEndDate: document.getElementById('csv-end-date'),
      csvExportError: document.getElementById('csv-export-error'),
      csvCancelBtn: document.getElementById('csv-cancel-btn'),

      addBtn: document.getElementById('add-activity-btn'),
      addDialog: document.getElementById('add-activity-dialog'),
      addForm: document.getElementById('add-activity-form'),
      nameInput: document.getElementById('activity-name-input'),
      colorPicker: document.getElementById('color-picker'),
      cancelAddBtn: document.getElementById('cancel-add-btn'),

      detailDialog: document.getElementById('activity-detail-dialog'),
      detailName: document.getElementById('detail-activity-name'),
      detailCurrentStreak: document.getElementById('detail-current-streak'),
      detailBestStreak: document.getElementById('detail-best-streak'),
      detailTotalCount: document.getElementById('detail-total-count'),
      detailLastDone: document.getElementById('detail-last-done'),
      deleteBtn: document.getElementById('delete-activity-btn')
    };

    this.detailActivityId = null;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function startOfWeek(date) {
    var copy = new Date(date);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
  }

  App.prototype.init = function () {
    var self = this;
    this.buildColorPicker();
    this.bindEvents();
    return this.loadData().then(function () {
      self.render();
    });
  };

  App.prototype.loadData = function () {
    var self = this;
    return Promise.all([this.repo.getActivities(), this.repo.getCompletions()]).then(function (results) {
      self.activities = results[0];
      var rawCompletions = results[1];
      self.completionSets = {};
      self.activities.forEach(function (a) {
        self.completionSets[a.id] = new Set(rawCompletions[a.id] || []);
      });
    });
  };

  App.prototype.bindEvents = function () {
    var self = this;

    this.dom.prevDay.addEventListener('click', function () {
      self.selectedDate = S.addDays(self.selectedDate, -1);
      self.render();
    });
    this.dom.nextDay.addEventListener('click', function () {
      self.selectedDate = S.addDays(self.selectedDate, 1);
      self.render();
    });
    this.dom.todayBtn.addEventListener('click', function () {
      self.selectedDate = new Date();
      self.render();
    });

    this.dom.tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.switchTab(btn.getAttribute('data-tab'));
      });
    });

    this.dom.calPrev.addEventListener('click', function () {
      var m = self.calendarMonth;
      self.calendarMonth = new Date(m.getFullYear(), m.getMonth() - 1, 1);
      self.renderCalendarTab();
    });
    this.dom.calNext.addEventListener('click', function () {
      var m = self.calendarMonth;
      self.calendarMonth = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      self.renderCalendarTab();
    });

    this.dom.addBtn.addEventListener('click', function () {
      self.openAddDialog();
    });
    this.dom.cancelAddBtn.addEventListener('click', function () {
      self.dom.addDialog.close();
    });
    this.dom.addForm.addEventListener('submit', function (e) {
      e.preventDefault();
      self.handleAddSubmit();
    });

    this.dom.deleteBtn.addEventListener('click', function () {
      self.handleDeleteActivity();
    });

    this.dom.csvExportBtn.addEventListener('click', function () {
      self.openCsvDialog();
    });
    this.dom.csvCancelBtn.addEventListener('click', function () {
      self.dom.csvExportDialog.close();
    });
    this.dom.csvExportForm.addEventListener('submit', function (e) {
      e.preventDefault();
      self.handleCsvExport();
    });
  };

  App.prototype.buildColorPicker = function () {
    var self = this;
    this.dom.colorPicker.innerHTML = '';
    COLORS.forEach(function (color) {
      var swatch = el('button', 'color-swatch');
      swatch.type = 'button';
      swatch.style.backgroundColor = color;
      swatch.setAttribute('data-color', color);
      if (color === self.selectedColor) swatch.classList.add('selected');
      swatch.addEventListener('click', function () {
        self.selectedColor = color;
        Array.prototype.forEach.call(self.dom.colorPicker.children, function (c) {
          c.classList.toggle('selected', c === swatch);
        });
      });
      self.dom.colorPicker.appendChild(swatch);
    });
  };

  App.prototype.switchTab = function (tab) {
    this.activeTab = tab;
    this.dom.tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    Object.keys(this.dom.panels).forEach(function (key) {
      this.dom.panels[key].classList.toggle('active', key === tab);
    }, this);
    this.render();
  };

  App.prototype.render = function () {
    this.renderDateHeader();
    this.renderDateStrip();
    if (this.activeTab === 'today') this.renderTodayTab();
    if (this.activeTab === 'calendar') this.renderCalendarTab();
    if (this.activeTab === 'stats') this.renderStatsTab();
  };

  App.prototype.renderDateHeader = function () {
    var d = this.selectedDate;
    this.dom.currentDateLabel.textContent =
      (d.getMonth() + 1) + '月' + d.getDate() + '日(' + S.WEEKDAY_JA[d.getDay()] + ')';
  };

  App.prototype.renderDateStrip = function () {
    var self = this;
    var start = startOfWeek(this.selectedDate);
    var selectedStr = S.toDateStr(this.selectedDate);
    var todayStr = S.toDateStr(new Date());

    this.dom.dateStrip.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      var day = S.addDays(start, i);
      var dayStr = S.toDateStr(day);
      var cell = el('button', 'date-strip-cell');
      cell.type = 'button';
      if (dayStr === selectedStr) cell.classList.add('selected');
      if (dayStr === todayStr) cell.classList.add('is-today');
      cell.appendChild(el('span', 'date-strip-weekday', S.WEEKDAY_JA[day.getDay()]));
      cell.appendChild(el('span', 'date-strip-num', String(day.getDate())));
      cell.addEventListener('click', (function (d) {
        return function () {
          self.selectedDate = d;
          self.render();
        };
      })(day));
      this.dom.dateStrip.appendChild(cell);
    }
  };

  /**
   * Builds a single activity row (colored pill with a check circle, name,
   * status text and streak badge) for the given date. Used by both the
   * Today tab and the calendar's day-detail panel, since "mark this
   * activity done on this date" is the same interaction in both places.
   */
  App.prototype.buildActivityRow = function (activity, dateStr) {
    var self = this;
    var dateSet = this.completionSets[activity.id];
    var isDone = dateSet.has(dateStr);
    var streak = S.computeCurrentStreak(dateSet, dateStr);
    var sinceLast = S.daysSinceLastDone(dateSet, dateStr);

    var row = el('li', 'activity-row');
    row.style.backgroundColor = isDone ? DONE_COLOR : activity.color;

    var check = el('button', 'check-circle');
    check.type = 'button';
    check.setAttribute('aria-label', '達成をマーク');
    if (isDone) check.classList.add('checked');
    check.addEventListener('click', function (e) {
      e.stopPropagation();
      var willBeDone = !check.classList.contains('checked');
      vibrate(willBeDone ? [15, 40, 15] : 12);
      self.toggleCompletion(activity.id, dateStr);
    });
    row.appendChild(check);

    var info = el('div', 'activity-info');
    info.appendChild(el('span', 'activity-name', activity.name));

    var subtext;
    if (isDone) {
      subtext = streak > 1 ? streak + '日連続達成中' : '達成';
    } else if (sinceLast == null) {
      subtext = '記録なし';
    } else {
      subtext = '最近 ' + sinceLast + '日前';
    }
    info.appendChild(el('span', 'activity-sub', subtext));
    row.appendChild(info);

    if (streak > 0) {
      row.appendChild(el('span', 'streak-badge', '🔥' + streak));
    }
    row.appendChild(el('span', 'chevron', '›'));

    row.addEventListener('click', function () {
      self.openActivityDetail(activity.id);
    });

    return row;
  };

  App.prototype.renderTodayTab = function () {
    var self = this;
    var asOf = S.toDateStr(this.selectedDate);
    this.dom.activityList.innerHTML = '';
    this.dom.emptyState.hidden = this.activities.length > 0;

    this.activities.forEach(function (activity) {
      self.dom.activityList.appendChild(self.buildActivityRow(activity, asOf));
    });
  };

  App.prototype.toggleCompletion = function (activityId, dateStr) {
    var self = this;
    return this.repo.toggleCompletion(activityId, dateStr).then(function (nowDone) {
      var set = self.completionSets[activityId];
      if (nowDone) set.add(dateStr); else set.delete(dateStr);
      self.render();
    });
  };

  App.prototype.renderCalendarTab = function () {
    var self = this;
    var month = this.calendarMonth;
    this.dom.calMonthLabel.textContent = month.getFullYear() + '年' + (month.getMonth() + 1) + '月';

    this.dom.calendarWeekdays.innerHTML = '';
    S.WEEKDAY_JA.forEach(function (w) {
      self.dom.calendarWeekdays.appendChild(el('span', 'weekday-label', w));
    });

    var gridStart = startOfWeek(month);
    var todayStr = S.toDateStr(new Date());
    var selectedStr = this.selectedCalendarDate ? S.toDateStr(this.selectedCalendarDate) : null;

    this.dom.calendarGrid.innerHTML = '';
    for (var i = 0; i < 42; i++) {
      var day = S.addDays(gridStart, i);
      var dayStr = S.toDateStr(day);
      var inMonth = day.getMonth() === month.getMonth();

      var cell = el('button', 'calendar-cell');
      cell.type = 'button';
      if (!inMonth) cell.classList.add('outside-month');
      if (dayStr === todayStr) cell.classList.add('is-today');
      if (dayStr === selectedStr) cell.classList.add('selected');

      cell.appendChild(el('span', 'calendar-cell-num', String(day.getDate())));

      var dots = el('span', 'calendar-cell-dots');
      this.activities.forEach(function (activity) {
        if (self.completionSets[activity.id].has(dayStr)) {
          var dot = el('span', 'dot');
          dot.style.backgroundColor = activity.color;
          dots.appendChild(dot);
        }
      });
      cell.appendChild(dots);

      cell.addEventListener('click', (function (d) {
        return function () {
          self.selectedCalendarDate = d;
          self.renderCalendarTab();
        };
      })(day));

      this.dom.calendarGrid.appendChild(cell);
    }

    this.renderDayDetail();
  };

  App.prototype.renderDayDetail = function () {
    var self = this;
    var container = this.dom.calendarDayDetail;
    container.innerHTML = '';
    if (!this.selectedCalendarDate) return;

    var dateStr = S.toDateStr(this.selectedCalendarDate);
    var doneCount = this.activities.filter(function (a) { return self.completionSets[a.id].has(dateStr); }).length;

    var d = this.selectedCalendarDate;
    var heading = el('h3', 'day-detail-heading',
      d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日');
    heading.appendChild(el('span', 'day-detail-count', doneCount + ' 件達成'));
    container.appendChild(heading);

    if (this.activities.length === 0) {
      container.appendChild(el('p', 'empty-state', 'まだ目標がありません。右下の + から追加しましょう。'));
      return;
    }

    var list = el('ul', 'activity-list');
    this.activities.forEach(function (activity) {
      list.appendChild(self.buildActivityRow(activity, dateStr));
    });
    container.appendChild(list);
  };

  App.prototype.renderStatsTab = function () {
    var self = this;
    var todayStr = S.toDateStr(new Date());
    this.dom.statsList.innerHTML = '';
    this.dom.statsEmpty.hidden = this.activities.length > 0;

    var rows = this.activities.map(function (activity) {
      var dateSet = self.completionSets[activity.id];
      return {
        activity: activity,
        current: S.computeCurrentStreak(dateSet, todayStr),
        best: S.computeBestStreak(dateSet),
        total: dateSet.size
      };
    });
    rows.sort(function (a, b) { return b.current - a.current; });

    rows.forEach(function (row) {
      var card = el('li', 'stats-card');
      var head = el('div', 'stats-card-head');
      var dot = el('span', 'stats-color-dot');
      dot.style.backgroundColor = row.activity.color;
      head.appendChild(dot);
      head.appendChild(el('span', 'stats-name', row.activity.name));
      card.appendChild(head);

      var numbers = el('div', 'stats-numbers');
      numbers.appendChild(self.statNumberBox(row.current, '現在の連続日数'));
      numbers.appendChild(self.statNumberBox(row.best, '最長記録'));
      numbers.appendChild(self.statNumberBox(row.total, '合計達成日数'));
      card.appendChild(numbers);

      card.addEventListener('click', function () {
        self.openActivityDetail(row.activity.id);
      });

      self.dom.statsList.appendChild(card);
    });
  };

  App.prototype.statNumberBox = function (num, caption) {
    var box = el('div', 'stat-box');
    box.appendChild(el('span', 'stat-number', String(num)));
    box.appendChild(el('span', 'stat-caption', caption));
    return box;
  };

  App.prototype.openAddDialog = function () {
    this.dom.nameInput.value = '';
    this.selectedColor = COLORS[0];
    this.buildColorPicker();
    this.dom.addDialog.showModal();
    this.dom.nameInput.focus();
  };

  App.prototype.handleAddSubmit = function () {
    var self = this;
    var name = this.dom.nameInput.value.trim();
    if (!name) return;
    this.repo.addActivity({ name: name, color: this.selectedColor }).then(function (activity) {
      self.activities.push(activity);
      self.completionSets[activity.id] = new Set();
      self.dom.addDialog.close();
      self.render();
    });
  };

  App.prototype.openActivityDetail = function (activityId) {
    var activity = this.activities.find(function (a) { return a.id === activityId; });
    if (!activity) return;
    this.detailActivityId = activityId;

    var dateSet = this.completionSets[activityId];
    var todayStr = S.toDateStr(new Date());
    var current = S.computeCurrentStreak(dateSet, todayStr);
    var best = S.computeBestStreak(dateSet);
    var sinceLast = S.daysSinceLastDone(dateSet, todayStr);

    this.dom.detailName.textContent = activity.name;
    this.dom.detailCurrentStreak.textContent = String(current);
    this.dom.detailBestStreak.textContent = String(best);
    this.dom.detailTotalCount.textContent = String(dateSet.size);

    if (sinceLast == null) {
      this.dom.detailLastDone.textContent = 'まだ記録がありません。';
    } else if (sinceLast === 0) {
      this.dom.detailLastDone.textContent = '今日達成済みです。';
    } else {
      this.dom.detailLastDone.textContent = '最後の達成は ' + sinceLast + '日前です。';
    }

    this.dom.detailDialog.showModal();
  };

  App.prototype.handleDeleteActivity = function () {
    var self = this;
    var id = this.detailActivityId;
    if (!id) return;
    var activity = this.activities.find(function (a) { return a.id === id; });
    if (!activity) return;
    var ok = confirm('「' + activity.name + '」を削除しますか？記録もすべて削除されます。');
    if (!ok) return;

    this.repo.deleteActivity(id).then(function () {
      self.activities = self.activities.filter(function (a) { return a.id !== id; });
      delete self.completionSets[id];
      self.detailActivityId = null;
      self.dom.detailDialog.close();
      self.render();
    });
  };

  function csvField(value) {
    var str = String(value);
    if (/[",\r\n]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  App.prototype.openCsvDialog = function () {
    this.dom.csvStartDate.value = S.toDateStr(startOfMonth(new Date()));
    this.dom.csvEndDate.value = S.toDateStr(new Date());
    this.dom.csvExportError.hidden = true;
    this.dom.csvExportDialog.showModal();
  };

  App.prototype.handleCsvExport = function () {
    var self = this;
    var startStr = this.dom.csvStartDate.value;
    var endStr = this.dom.csvEndDate.value;

    if (!startStr || !endStr || startStr > endStr) {
      this.dom.csvExportError.textContent = '開始日は終了日より前(または同じ)の日付にしてください。';
      this.dom.csvExportError.hidden = false;
      return;
    }

    var header = ['日付'].concat(this.activities.map(function (a) { return a.name; }));
    var rows = [header];

    var cursor = S.parseDateStr(startStr);
    var endDate = S.parseDateStr(endStr);
    while (cursor <= endDate) {
      var dateStr = S.toDateStr(cursor);
      rows.push([dateStr].concat(self.activities.map(function (a) {
        return self.completionSets[a.id].has(dateStr) ? '1' : '0';
      })));
      cursor = S.addDays(cursor, 1);
    }

    var csv = rows.map(function (row) {
      return row.map(csvField).join(',');
    }).join('\r\n');

    // Prefix with a UTF-8 BOM so Excel (including Japanese locales) opens
    // the file with correct encoding instead of garbled text.
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'goal-tracker_' + startStr + '_' + endStr + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.dom.csvExportDialog.close();
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.App = App;
})(window);
