/**
 * iOS-style swipe-to-reveal-delete for list rows, using Pointer Events.
 *
 * Each row must be a direct <li> child of listEl with [data-id], containing
 * a contentSelector element (the visible card that slides) layered above a
 * deleteBtnSelector button (revealed underneath). touch-action: pan-y on
 * the content element lets the browser keep handling vertical list scroll
 * natively; we only take over once real horizontal movement is seen, so a
 * plain tap (e.g. focusing a text input) is never hijacked.
 */
(function (global) {
  'use strict';

  var REVEAL = 88;
  var THRESHOLD = 40;
  var MOVE_START = 6;

  function enableSwipeDelete(listEl, contentSelector, deleteBtnSelector, onDelete) {
    var openRow = null;

    function setOpen(row, open) {
      var content = row.querySelector(contentSelector);
      content.style.transition = '';
      content.style.transform = open ? 'translateX(-' + REVEAL + 'px)' : '';
      row.classList.toggle('swiped', open);
      openRow = open ? row : (openRow === row ? null : openRow);
    }

    listEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.drag-handle')) return;
      var content = e.target.closest(contentSelector);
      if (!content) return;
      var row = content.closest('li');
      if (!row) return;

      if (openRow && openRow !== row) setOpen(openRow, false);

      var startX = e.clientX;
      var baseX = row.classList.contains('swiped') ? -REVEAL : 0;
      var moved = false;
      var pointerId = e.pointerId;

      function move(ev) {
        if (ev.pointerId !== pointerId) return;
        var dx = ev.clientX - startX;
        if (!moved) {
          if (Math.abs(dx) < MOVE_START) return;
          moved = true;
          content.setPointerCapture(pointerId);
          content.style.transition = 'none';
        }
        var x = Math.max(-REVEAL, Math.min(0, baseX + dx));
        content.style.transform = 'translateX(' + x + 'px)';
      }

      function end(ev) {
        content.removeEventListener('pointermove', move);
        content.removeEventListener('pointerup', end);
        content.removeEventListener('pointercancel', end);
        if (!moved) return;
        content.style.transition = '';
        var dx = ev.clientX - startX;
        var finalX = Math.max(-REVEAL, Math.min(0, baseX + dx));
        setOpen(row, finalX <= -THRESHOLD);
      }

      content.addEventListener('pointermove', move);
      content.addEventListener('pointerup', end);
      content.addEventListener('pointercancel', end);
    });

    listEl.addEventListener('click', function (e) {
      var delBtn = e.target.closest(deleteBtnSelector);
      if (delBtn) {
        var row = delBtn.closest('li');
        onDelete(row);
        if (openRow === row) openRow = null;
        return;
      }
      if (openRow) setOpen(openRow, false);
    });
  }

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.enableSwipeDelete = enableSwipeDelete;
})(window);
