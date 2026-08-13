(function () {
  'use strict';

  var G = window.GoalTracker;
  var authScreen = document.getElementById('auth-screen');
  var appRoot = document.getElementById('app');
  var authForm = document.getElementById('auth-form');
  var authEmailInput = document.getElementById('auth-email-input');
  var authSubmitBtn = document.getElementById('auth-submit-btn');
  var authMessage = document.getElementById('auth-message');

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
      showMessage('ログインリンクを ' + email + ' に送りました。メールを確認してください。');
    }, function (err) {
      showMessage('送信に失敗しました: ' + (err && err.message ? err.message : err));
    }).then(function () {
      authSubmitBtn.disabled = false;
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

  function startApp(session) {
    var client = G.auth.getClient();
    var repo = new G.ServerRepository(client, session.user.id);
    return migrateLocalDataIfNeeded(repo).then(function () {
      authScreen.hidden = true;
      appRoot.hidden = false;
      var app = new G.App(repo);
      return app.init();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', function () {
      G.auth.signOut().then(function () { window.location.reload(); });
    });

    G.auth.getSession().then(function (session) {
      if (session) {
        startApp(session);
      } else {
        authScreen.hidden = false;
      }
    });

    G.auth.onAuthStateChange(function (session) {
      if (session && appRoot.hidden) {
        startApp(session);
      }
    });
  });
})();
