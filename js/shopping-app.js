/**
 * UI layer for the shared household shopping list. Mirrors the structure
 * of todo-app.js (repo-backed, plain DOM rendering) but scoped to
 * groceries / daily items, with a quantity field instead of a due date.
 */
(function (global) {
  'use strict';

  var CATEGORY_LABELS = { food: '食材', daily: '日用品' };

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
    this.selectedCategory = 'food';
    this.editingId = null;

    this.dom = {
      tabBtns: Array.prototype.slice.call(document.querySelectorAll('#shopping-section .tab-btn')),
      list: document.getElementById('shopping-list'),
      empty: document.getElementById('shopping-empty'),

      addBtn: document.getElementById('add-shopping-btn'),
      dialog: document.getElementById('add-shopping-dialog'),
      heading: document.getElementById('shopping-dialog-heading'),
      submitBtn: document.getElementById('shopping-dialog-submit-btn'),
      form: document.getElementById('add-shopping-form'),
      nameInput: document.getElementById('shopping-name-input'),
      categoryPicker: document.getElementById('shopping-category-picker'),
      quantityInput: document.getElementById('shopping-quantity-input'),
      cancelBtn: document.getElementById('shopping-cancel-btn')
    };
  }

  ShoppingApp.prototype.init = function () {
    var self = this;
    this.bindEvents();
    global.GoalTracker.enableDragReorder(this.dom.list, '.drag-handle', function (ids) {
      self.persistOrder(ids);
    });
    return this.loadData().then(function () {
      self.render();
    });
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
        self.render();
      });
    });

    this.dom.addBtn.addEventListener('click', function () {
      self.openDialog();
    });
    this.dom.cancelBtn.addEventListener('click', function () {
      self.dom.dialog.close();
    });
    this.dom.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.handleFormSubmit();
    });
    Array.prototype.forEach.call(this.dom.categoryPicker.children, function (btn) {
      btn.addEventListener('click', function () {
        self.selectedCategory = btn.getAttribute('data-category');
        Array.prototype.forEach.call(self.dom.categoryPicker.children, function (b) {
          b.classList.toggle('selected', b === btn);
        });
      });
    });
  };

  // Pass an item to edit it; call with no argument to add a new one.
  ShoppingApp.prototype.openDialog = function (item) {
    this.editingId = item ? item.id : null;
    this.dom.heading.textContent = item ? '買うものを編集' : '新しい買うもの';
    this.dom.submitBtn.textContent = item ? '保存' : '追加';
    this.dom.nameInput.value = item ? item.name : '';
    this.dom.quantityInput.value = item && item.quantity ? item.quantity : '';
    this.selectedCategory = item ? item.category : this.activeCategory;
    Array.prototype.forEach.call(this.dom.categoryPicker.children, function (b) {
      b.classList.toggle('selected', b.getAttribute('data-category') === this.selectedCategory);
    }, this);
    this.dom.dialog.showModal();
    this.dom.nameInput.focus();
  };

  ShoppingApp.prototype.handleFormSubmit = function () {
    var self = this;
    var name = this.dom.nameInput.value.trim();
    if (!name) return;
    var quantity = this.dom.quantityInput.value.trim() || null;

    if (this.editingId) {
      var item = this.items.find(function (t) { return t.id === self.editingId; });
      this.repo.updateItem(this.editingId, { name: name, category: this.selectedCategory, quantity: quantity }).then(function () {
        item.name = name;
        item.category = self.selectedCategory;
        item.quantity = quantity;
        self.dom.dialog.close();
        self.render();
      });
      return;
    }

    var maxPosition = this.items
      .filter(function (t) { return t.category === self.selectedCategory; })
      .reduce(function (max, t) { return Math.max(max, t.position || 0); }, 0);
    this.repo.addItem({ name: name, category: this.selectedCategory, position: maxPosition + 10, quantity: quantity }).then(function (created) {
      self.items.push(created);
      self.dom.dialog.close();
      self.render();
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

  ShoppingApp.prototype.buildRow = function (item) {
    var self = this;
    var row = el('li', 'todo-row' + (item.bought ? ' done' : ''));
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

    var body = el('span', 'todo-body');
    var title = el('span', 'todo-title', item.name);
    body.appendChild(title);
    if (item.quantity) {
      body.appendChild(el('span', 'todo-due-badge', item.quantity));
    }
    body.addEventListener('click', function () {
      self.openDialog(item);
    });
    row.appendChild(body);

    var del = el('button', 'todo-delete', '×');
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
    this.dom.empty.hidden = visible.length > 0;
    visible.forEach(function (item) {
      self.dom.list.appendChild(self.buildRow(item));
    });
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ShoppingApp = ShoppingApp;
})(window);
