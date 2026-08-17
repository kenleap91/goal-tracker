/**
 * Minimal touch/mouse drag-to-reorder for a <ul> of rows, using Pointer
 * Events (unifies mouse + touch + pen, no separate touch handlers needed).
 *
 * Rows must be direct children of listEl with a [data-id] attribute, and
 * must contain an element matching handleSelector to grab. Only the
 * immediate previous/next sibling is checked per pointermove, so a drag
 * across several rows resolves incrementally over a few move events —
 * simple to reason about and avoids the "jump" that comes from comparing
 * against every row while a CSS transform is also in play.
 */
(function (global) {
  'use strict';

  function enableDragReorder(listEl, handleSelector, onReorder) {
    var dragging = null;
    var startY = 0;

    function onPointerMove(e) {
      if (!dragging) return;
      dragging.style.transform = 'translateY(' + (e.clientY - startY) + 'px)';

      var prev = dragging.previousElementSibling;
      if (prev) {
        var prevRect = prev.getBoundingClientRect();
        if (e.clientY < prevRect.top + prevRect.height / 2) {
          listEl.insertBefore(dragging, prev);
          startY = e.clientY;
          dragging.style.transform = 'translateY(0px)';
          return;
        }
      }

      var next = dragging.nextElementSibling;
      if (next) {
        var nextRect = next.getBoundingClientRect();
        if (e.clientY > nextRect.top + nextRect.height / 2) {
          listEl.insertBefore(dragging, next.nextElementSibling);
          startY = e.clientY;
          dragging.style.transform = 'translateY(0px)';
        }
      }
    }

    function onPointerUp() {
      if (!dragging) return;
      var finished = dragging;
      finished.classList.remove('dragging');
      finished.style.transform = '';
      finished.style.position = '';
      finished.style.zIndex = '';
      dragging = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      var ids = Array.prototype.map.call(listEl.children, function (el) {
        return el.getAttribute('data-id');
      });
      onReorder(ids);
    }

    listEl.addEventListener('pointerdown', function (e) {
      var handle = e.target.closest(handleSelector);
      if (!handle) return;
      var row = handle.closest('[data-id]');
      if (!row || row.parentNode !== listEl) return;

      dragging = row;
      startY = e.clientY;
      dragging.classList.add('dragging');
      dragging.style.position = 'relative';
      dragging.style.zIndex = '10';
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
    });
  }

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.enableDragReorder = enableDragReorder;
})(window);
