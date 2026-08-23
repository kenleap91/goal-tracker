/**
 * UI layer for the shared household shopping list ("買うものリスト").
 * Deliberately modeled on the Notes/Reminders checklist feel rather than
 * the ToDo section's dialog-based add/edit: an always-visible input row
 * for adding, and tap-anywhere-on-the-text inline editing (the "row" is
 * just a borderless <input>). Deletion uses the same visible button as
 * the ToDo list, not a swipe gesture.
 */
(function (global) {
  'use strict';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function ShoppingApp(repo) {
    this.repo = repo;
    this.items = [];
    this.activeCategory = 'food';

    this.dom = {
      tabBtns: Array.prototype.slice.call(document.querySelectorAll('#shopping-section .tab-btn')),
      list: document.getElementById('shopping-list'),
      addInput: document.getElementById('shopping-add-input')
    };
  }

  ShoppingApp.prototype.init = function () {
    var self = this;
    this.bindEvents();
    global.GoalTracker.enableDragReorder(this.dom.list, '.drag-handle', function (ids) {
      self.persistOrder(ids);
    });
    this.repo.subscribeToChanges(function (change) {
      self.applyRemoteChange(change);
    });
    return this.loadData().then(function () {
      self.render();
    });
  };

  // Realtime edits are patched into the DOM row-by-row instead of calling
  // render() (which rebuilds every row from scratch): unlike ToDo/chores/
  // assets, editing here happens directly in always-visible inputs inside
  // the list, so wiping the list would erase whatever the household member
  // using this screen is mid-typing in an unrelated row.
  ShoppingApp.prototype.applyRemoteChange = function (change) {
    var self = this;

    if (change.eventType === 'DELETE') {
      this.items = this.items.filter(function (t) { return t.id !== change.oldId; });
      var deleted = this.dom.list.querySelector('[data-id="' + change.oldId + '"]');
      if (deleted) deleted.remove();
      return;
    }

    var item = change.newItem;
    var idx = this.items.findIndex(function (t) { return t.id === item.id; });
    if (idx >= 0) this.items[idx] = item;
    else this.items.push(item);

    if (item.category !== this.activeCategory) return;

    var existing = this.dom.list.querySelector('[data-id="' + item.id + '"]');
    if (existing && existing.contains(document.activeElement)) return; // don't clobber an active edit
    if (existing) existing.remove();

    var rowEl = this.buildRow(item);
    var insertBefore = Array.prototype.find.call(this.dom.list.children, function (li) {
      var sibling = self.items.find(function (t) { return t.id === li.getAttribute('data-id'); });
      return sibling && (sibling.position || 0) > (item.position || 0);
    });
    if (insertBefore) this.dom.list.insertBefore(rowEl, insertBefore);
    else this.dom.list.appendChild(rowEl);
  };

  ShoppingApp.prototype.loadData = function () {
    var self = this;
    return this.repo.getItems().then(function (items) {
      self.items = items;
    });
  };

  ShoppingApp.prototype.bindEvents = function () {
    var self = this;

    this.dom.tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.activeCategory = btn.getAttribute('data-category');
        self.dom.tabBtns.forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        self.dom.addInput.value = '';
        self.render();
      });
    });

    this.dom.addInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      self.submitAdd();
    });
  };

  ShoppingApp.prototype.submitAdd = function () {
    var self = this;
    var name = this.dom.addInput.value.trim();
    if (!name) return;
    var maxPosition = this.items
      .filter(function (t) { return t.category === self.activeCategory; })
      .reduce(function (max, t) { return Math.max(max, t.position || 0); }, 0);
    this.dom.addInput.value = '';
    this.repo.addItem({ name: name, category: this.activeCategory, position: maxPosition + 10 }).then(function (created) {
      self.items.push(created);
      self.render();
      // Keeps focus on the (now-recreated) add row so the user can keep
      // typing items one after another, same as Notes' checklist.
      self.dom.addInput.focus();
    });
  };

  ShoppingApp.prototype.toggleBought = function (item) {
    var self = this;
    var bought = !item.bought;
    return this.repo.toggleBought(item.id, bought).then(function () {
      item.bought = bought;
      item.boughtAt = bought ? new Date().toISOString() : null;
      self.render();
    });
  };

  ShoppingApp.prototype.deleteItem = function (item) {
    var self = this;
    var ok = confirm('「' + item.name + '」を削除しますか?');
    if (!ok) return;
    this.repo.deleteItem(item.id).then(function () {
      self.items = self.items.filter(function (t) { return t.id !== item.id; });
      self.render();
    });
  };

  ShoppingApp.prototype.persistOrder = function (ids) {
    var self = this;
    this.repo.updatePositions(ids).then(function () {
      ids.forEach(function (id, index) {
        var item = self.items.find(function (t) { return t.id === id; });
        if (item) item.position = (index + 1) * 10;
      });
    });
  };

  ShoppingApp.prototype.saveName = function (item, value) {
    var name = value.trim();
    if (!name) { this.render(); return; }
    if (name === item.name) return;
    this.repo.updateItem(item.id, { name: name }).then(function () {
      item.name = name;
    });
  };

  ShoppingApp.prototype.saveQuantity = function (item, value) {
    var quantity = value.trim() || null;
    if (quantity === item.quantity) return;
    this.repo.updateItem(item.id, { quantity: quantity }).then(function () {
      item.quantity = quantity;
    });
  };

  ShoppingApp.prototype.buildRow = function (item) {
    var self = this;
    var row = el('li', 'shopping-row' + (item.bought ? ' done' : ''));
    row.setAttribute('data-id', item.id);

    row.appendChild(el('span', 'drag-handle', '⠿'));

    var check = el('button', 'todo-check');
    check.type = 'button';
    check.setAttribute('aria-label', '購入済みにする');
    if (item.bought) check.classList.add('checked');
    check.addEventListener('click', function () {
      self.toggleBought(item);
    });
    row.appendChild(check);

    var nameInput = el('input', 'shopping-name-input');
    nameInput.type = 'text';
    nameInput.value = item.name;
    nameInput.maxLength = 60;
    nameInput.addEventListener('blur', function () {
      self.saveName(item, nameInput.value);
    });
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    });
    row.appendChild(nameInput);

    var qtyInput = el('input', 'shopping-qty-input');
    qtyInput.type = 'text';
    qtyInput.placeholder = '数量';
    qtyInput.maxLength = 20;
    qtyInput.value = item.quantity || '';
    qtyInput.addEventListener('blur', function () {
      self.saveQuantity(item, qtyInput.value);
    });
    qtyInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); qtyInput.blur(); }
    });
    row.appendChild(qtyInput);

    var del = el('button', 'shopping-delete', '🗑️');
    del.type = 'button';
    del.setAttribute('aria-label', '削除');
    del.addEventListener('click', function () {
      self.deleteItem(item);
    });
    row.appendChild(del);

    return row;
  };

  ShoppingApp.prototype.render = function () {
    var self = this;
    var visible = this.items
      .filter(function (t) { return t.category === self.activeCategory; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    this.dom.list.innerHTML = '';
    visible.forEach(function (item) {
      self.dom.list.appendChild(self.buildRow(item));
    });
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ShoppingApp = ShoppingApp;
})(window);
