(function () {
  'use strict';

  var G = window.GoalTracker;
  var authScreen = document.getElementById('auth-screen');
  var homeScreen = document.getElementById('home-screen');
  var sections = {
    goal: document.getElementById('goal-section'),
    todo: document.getElementById('todo-section'),
    chores: document.getElementById('chores-section')
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
      showMessage('確認コードを ' + email + ' に送りました。メール内の6桁のコードを入力してください。');
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

  function showHome() {
    homeScreen.hidden = false;
    Object.keys(sections).forEach(function (key) { sections[key].hidden = true; });
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
    } else {
      repo = new G.ChoreRepository(client, userId);
      appInstance = new G.ChoreApp(repo);
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
