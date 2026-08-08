(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var repo = window.GoalTracker.createRepository();
    var app = new window.GoalTracker.App(repo);
    app.init();
  });
})();
