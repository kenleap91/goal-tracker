(function () {
  'use strict';

  var G = window.GoalTracker;
  var authScreen = document.getElementById('auth-screen');
  var homeScreen = document.getElementById('home-screen');
  var sections = {
    goal: document.getElementById('goal-section'),
    todo: document.getElementById('todo-section'),
    chores: document.getElementById('chores-section'),
    assets: document.getElementById('assets-section')
  };
  var sectionApps = {};
  var client = null;
  var userId = null;
  var authForm = document.getElementById('auth-form');
  var authEmailInput = document.getElementById('auth-email-input');
  var authSubmitBtn = document.getElementById('auth-submit-btn');
  var authCodeForm = document.getElementById('auth-code-form');
  var authCodeInput = document.getElementById('auth-code-input');
  var authCodeSubmitBtn = document.getElementById('auth-code-submit-btn');
  var authMessage = document.getElementById('auth-message');
  var pendingEmail = null;

  function showMessage(text) {
    authMessage.textContent = text;
    authMessage.hidden = false;
  }

  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = authEmailInput.value.trim();
    if (!email) return;
    authSubmitBtn.disabled = true;
    G.auth.sendMagicLink(email).then(function () {
      pendingEmail = email;
      authForm.hidden = true;
      authCodeForm.hidden = false;
      showMessage('確認コードを ' + email + ' に送りました。メール内の8桁のコードを入力してください。');
      authCodeInput.focus();
    }, function (err) {
      showMessage('送信に失敗しました: ' + (err && err.message ? err.message : err));
    }).then(function () {
      authSubmitBtn.disabled = false;
    });
  });

  authCodeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = authCodeInput.value.replace(/\s+/g, '');
    var email = pendingEmail || authEmailInput.value.trim();
    if (!code) return;
    if (!email) {
      showMessage('メールアドレスが分からなくなりました。お手数ですが最初からやり直してください。');
      authForm.hidden = false;
      authCodeForm.hidden = true;
      return;
    }
    authCodeSubmitBtn.disabled = true;
    G.auth.verifyCode(email, code).then(function () {
      showMessage('');
      authMessage.hidden = true;
    }, function (err) {
      showMessage('ログインに失敗しました: ' + (err && err.message ? err.message : err));
      authCodeSubmitBtn.disabled = false;
    });
  });

  // Migrates any pre-existing localStorage data into Supabase the first
  // time a user logs in on a device that already had local records, so
  // switching to server storage doesn't lose history.
  function migrateLocalDataIfNeeded(repo) {
    var local = new G.LocalStorageRepository();
    return Promise.all([local.getActivities(), repo.getActivities()]).then(function (results) {
      var localActivities = results[0];
      var serverActivities = results[1];
      if (localActivities.length === 0 || serverActivities.length > 0) return;

      return local.getCompletions().then(function (localCompletions) {
        var idMap = {};
        return localActivities
          .reduce(function (chain, activity) {
            return chain
              .then(function () { return repo.addActivity({ name: activity.name, color: activity.color }); })
              .then(function (created) { idMap[activity.id] = created.id; });
          }, Promise.resolve())
          .then(function () {
            var dateOps = [];
            Object.keys(localCompletions).forEach(function (oldId) {
              var newId = idMap[oldId];
              if (!newId) return;
              localCompletions[oldId].forEach(function (dateStr) {
                dateOps.push(repo.setCompletion(newId, dateStr, true));
              });
            });
            return Promise.all(dateOps);
          });
      });
    });
  }

  function daysUntil(dateStr, todayDay) {
    var parts = dateStr.split('-').map(Number);
    var target = new Date(parts[0], parts[1] - 1, parts[2]);
    return Math.round((target - todayDay) / 86400000);
  }

  function dueLabel(dateStr, diff, todayWord) {
    var mmdd = dateStr.slice(5).replace('-', '/');
    if (diff < 0) return mmdd + '(期限切れ)';
    if (diff === 0) return mmdd + '(' + todayWord + ')';
    return mmdd + '(あと' + diff + '日)';
  }

  function buildDashboardItem(label, dateStr, diff, todayWord, urgentThreshold, onClick) {
    var li = document.createElement('li');
    li.className = 'dashboard-item';
    var name = document.createElement('span');
    name.textContent = label;
    var date = document.createElement('span');
    date.className = 'dashboard-item-date' + (diff <= urgentThreshold ? ' urgent' : '');
    date.textContent = dueLabel(dateStr, diff, todayWord);
    li.appendChild(name);
    li.appendChild(date);
    li.addEventListener('click', onClick);
    return li;
  }

  function renderDashboard() {
    var dashboard = document.getElementById('home-dashboard');
    var todoGroup = document.getElementById('dashboard-todo-group');
    var todoList = document.getElementById('dashboard-todo-list');
    var choreGroup = document.getElementById('dashboard-chore-group');
    var choreList = document.getElementById('dashboard-chore-list');

    var todoRepo = new G.TodoRepository(client, userId);
    var choreRepo = new G.ChoreRepository(client, userId);
    var today = new Date();
    var todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return Promise.all([todoRepo.getTodos(), choreRepo.getChores()]).then(function (results) {
      var todos = results[0];
      var chores = results[1];

      var dueTodos = todos
        .filter(function (t) { return !t.done && t.dueDate && daysUntil(t.dueDate, todayDay) <= 3; })
        .sort(function (a, b) { return daysUntil(a.dueDate, todayDay) - daysUntil(b.dueDate, todayDay); });

      var dueChores = chores
        .filter(function (c) { return c.nextDueDate && daysUntil(c.nextDueDate, todayDay) <= 7; })
        .sort(function (a, b) { return daysUntil(a.nextDueDate, todayDay) - daysUntil(b.nextDueDate, todayDay); });

      todoList.innerHTML = '';
      dueTodos.forEach(function (t) {
        var diff = daysUntil(t.dueDate, todayDay);
        todoList.appendChild(buildDashboardItem(t.title, t.dueDate, diff, '今日まで', 3, function () {
          showSection('todo');
        }));
      });
      todoGroup.hidden = dueTodos.length === 0;

      choreList.innerHTML = '';
      dueChores.forEach(function (c) {
        var diff = daysUntil(c.nextDueDate, todayDay);
        choreList.appendChild(buildDashboardItem(c.name, c.nextDueDate, diff, '今日', 7, function () {
          showSection('chores');
        }));
      });
      choreGroup.hidden = dueChores.length === 0;

      dashboard.hidden = dueTodos.length === 0 && dueChores.length === 0;
    });
  }

  function showHome() {
    homeScreen.hidden = false;
    Object.keys(sections).forEach(function (key) { sections[key].hidden = true; });
    renderDashboard();
  }

  function showSection(key) {
    homeScreen.hidden = true;
    Object.keys(sections).forEach(function (k) { sections[k].hidden = (k !== key); });
    if (sectionApps[key]) return;

    var repo, appInstance;
    if (key === 'goal') {
      repo = new G.ServerRepository(client, userId);
      appInstance = new G.App(repo);
    } else if (key === 'todo') {
      repo = new G.TodoRepository(client, userId);
      appInstance = new G.TodoApp(repo);
    } else if (key === 'chores') {
      repo = new G.ChoreRepository(client, userId);
      appInstance = new G.ChoreApp(repo);
    } else {
      repo = new G.AssetRepository(client, userId);
      appInstance = new G.AssetApp(repo);
    }
    sectionApps[key] = appInstance;
    appInstance.init();
  }

  function startApp(session) {
    client = G.auth.getClient();
    userId = session.user.id;
    var migrationRepo = new G.ServerRepository(client, userId);
    return migrateLocalDataIfNeeded(migrationRepo).then(function () {
      authScreen.hidden = true;
      showHome();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', function () {
      G.auth.signOut().then(function () { window.location.reload(); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.home-card'), function (card) {
      card.addEventListener('click', function () {
        showSection(card.getAttribute('data-section'));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (btn) {
      btn.addEventListener('click', function () {
        showHome();
      });
    });

    G.auth.getSession().then(function (session) {
      if (session) {
        startApp(session);
      } else {
        authScreen.hidden = false;
      }
    });

    G.auth.onAuthStateChange(function (session) {
      if (session && homeScreen.hidden && client === null) {
        startApp(session);
      }
    });
  });
})();
