/**
 * UI layer for the shared household asset dashboard ("資産管理"). Stocks,
 * ETFs and crypto get their value from live quotes (see price-service.js);
 * cash entries use a manually entered amount. Everything is converted to
 * JPY for the summary using the USD/JPY rate from the same quote source.
 */
(function (global) {
  'use strict';

  var CATEGORY_LABELS = { shared: '共通', ken: 'Ken', nao: 'Nao' };
  var CATEGORY_COLORS = { shared: '#8a5cf6', ken: '#3b82f6', nao: '#ec4899' };
  var TYPE_LABELS = { stock: '株式', etf: 'ETF', crypto: '暗号資産', cash: '現金・貯金' };

  var jpyFormatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

  function formatJpy(value) {
    return jpyFormatter.format(Math.round(value));
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function AssetApp(repo) {
    this.repo = repo;
    this.assets = [];
    this.quotes = {};
    this.activeCategory = 'shared';
    this.editingId = null;
    this.selectedCategory = 'shared';
    this.selectedType = 'stock';
    this.selectedCurrency = 'JPY';

    this.dom = {
      tabBtns: Array.prototype.slice.call(document.querySelectorAll('#assets-section .tab-btn')),
      list: document.getElementById('asset-list'),
      empty: document.getElementById('asset-empty'),
      totalEl: document.getElementById('asset-total'),
      summaryBar: document.getElementById('asset-summary-bar'),
      summaryLegend: document.getElementById('asset-summary-legend'),
      refreshBtn: document.getElementById('assets-refresh-btn'),

      addBtn: document.getElementById('add-asset-btn'),
      dialog: document.getElementById('add-asset-dialog'),
      heading: document.getElementById('asset-dialog-heading'),
      submitBtn: document.getElementById('asset-dialog-submit-btn'),
      form: document.getElementById('add-asset-form'),
      nameInput: document.getElementById('asset-name-input'),
      categoryPicker: document.getElementById('asset-category-picker'),
      typePicker: document.getElementById('asset-type-picker'),
      pricedFields: document.getElementById('asset-priced-fields'),
      symbolInput: document.getElementById('asset-symbol-input'),
      quantityInput: document.getElementById('asset-quantity-input'),
      cashFields: document.getElementById('asset-cash-fields'),
      amountInput: document.getElementById('asset-amount-input'),
      currencySection: document.getElementById('asset-currency-section'),
      currencyPicker: document.getElementById('asset-currency-picker'),
      memoInput: document.getElementById('asset-memo-input'),
      cancelBtn: document.getElementById('asset-cancel-btn')
    };
  }

  AssetApp.prototype.init = function () {
    var self = this;
    this.bindEvents();
    global.GoalTracker.enableDragReorder(this.dom.list, '.drag-handle', function (ids) {
      self.persistOrder(ids);
    });
    return this.loadData().then(function () {
      self.render();
    });
  };

  AssetApp.prototype.loadData = function () {
    var self = this;
    return this.repo.getAssets().then(function (assets) {
      self.assets = assets;
      return self.refreshQuotes();
    });
  };

  AssetApp.prototype.refreshQuotes = function () {
    var self = this;
    if (this.assets.length === 0) {
      this.quotes = {};
      return Promise.resolve();
    }
    var symbols = this.assets
      .filter(function (a) { return a.symbol; })
      .map(function (a) { return a.symbol; });
    symbols.push('JPY=X');
    return global.GoalTracker.priceService.getQuotes(symbols).then(function (quotes) {
      self.quotes = quotes;
    });
  };

  AssetApp.prototype.bindEvents = function () {
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

    this.dom.refreshBtn.addEventListener('click', function () {
      self.refreshQuotes().then(function () { self.render(); });
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

    Array.prototype.forEach.call(this.dom.typePicker.children, function (btn) {
      btn.addEventListener('click', function () {
        self.selectedType = btn.getAttribute('data-type');
        Array.prototype.forEach.call(self.dom.typePicker.children, function (b) {
          b.classList.toggle('selected', b === btn);
        });
        self.updateFieldVisibility();
      });
    });

    Array.prototype.forEach.call(this.dom.currencyPicker.children, function (btn) {
      btn.addEventListener('click', function () {
        self.selectedCurrency = btn.getAttribute('data-currency');
        Array.prototype.forEach.call(self.dom.currencyPicker.children, function (b) {
          b.classList.toggle('selected', b === btn);
        });
      });
    });
  };

  AssetApp.prototype.updateFieldVisibility = function () {
    var isCash = this.selectedType === 'cash';
    this.dom.pricedFields.hidden = isCash;
    this.dom.cashFields.hidden = !isCash;
    this.dom.currencySection.hidden = !isCash;
  };

  AssetApp.prototype.selectPickerValue = function (picker, attr, value) {
    Array.prototype.forEach.call(picker.children, function (b) {
      b.classList.toggle('selected', b.getAttribute(attr) === value);
    });
  };

  // Pass an asset to edit it; call with no argument to add a new one.
  AssetApp.prototype.openDialog = function (asset) {
    this.editingId = asset ? asset.id : null;
    this.dom.heading.textContent = asset ? '資産を編集' : '新しい資産';
    this.dom.submitBtn.textContent = asset ? '保存' : '追加';

    this.dom.nameInput.value = asset ? asset.name : '';
    this.selectedCategory = asset ? asset.category : this.activeCategory;
    this.selectedType = asset ? asset.assetType : 'stock';
    this.selectedCurrency = asset ? asset.currency : 'JPY';
    this.dom.symbolInput.value = asset && asset.symbol ? asset.symbol : '';
    this.dom.quantityInput.value = asset && asset.quantity != null ? asset.quantity : '';
    this.dom.amountInput.value = asset && asset.amount != null ? asset.amount : '';
    this.dom.memoInput.value = asset && asset.memo ? asset.memo : '';

    this.selectPickerValue(this.dom.categoryPicker, 'data-category', this.selectedCategory);
    this.selectPickerValue(this.dom.typePicker, 'data-type', this.selectedType);
    this.selectPickerValue(this.dom.currencyPicker, 'data-currency', this.selectedCurrency);
    this.updateFieldVisibility();

    this.dom.dialog.showModal();
    this.dom.nameInput.focus();
  };

  AssetApp.prototype.handleFormSubmit = function () {
    var self = this;
    var name = this.dom.nameInput.value.trim();
    if (!name) return;

    var isCash = this.selectedType === 'cash';
    var input = {
      category: this.selectedCategory,
      assetType: this.selectedType,
      name: name,
      symbol: isCash ? null : this.dom.symbolInput.value.trim().toUpperCase(),
      quantity: isCash ? null : (this.dom.quantityInput.value === '' ? null : Number(this.dom.quantityInput.value)),
      amount: isCash ? (this.dom.amountInput.value === '' ? null : Number(this.dom.amountInput.value)) : null,
      currency: isCash ? this.selectedCurrency : 'JPY',
      memo: this.dom.memoInput.value.trim()
    };

    var save;
    if (this.editingId) {
      save = this.repo.updateAsset(this.editingId, input);
    } else {
      var maxPosition = this.assets
        .filter(function (a) { return a.category === input.category; })
        .reduce(function (max, a) { return Math.max(max, a.position || 0); }, 0);
      input.position = maxPosition + 10;
      save = this.repo.addAsset(input);
    }

    save.then(function () {
      return self.loadData().then(function () {
        self.dom.dialog.close();
        self.render();
      });
    });
  };

  AssetApp.prototype.persistOrder = function (ids) {
    var self = this;
    this.repo.updatePositions(ids).then(function () {
      ids.forEach(function (id, index) {
        var asset = self.assets.find(function (a) { return a.id === id; });
        if (asset) asset.position = (index + 1) * 10;
      });
    });
  };

  AssetApp.prototype.deleteAsset = function (asset) {
    var self = this;
    var ok = confirm('「' + asset.name + '」を削除しますか?');
    if (!ok) return;
    this.repo.deleteAsset(asset.id).then(function () {
      self.assets = self.assets.filter(function (a) { return a.id !== asset.id; });
      self.render();
    });
  };

  AssetApp.prototype.fxRate = function () {
    var q = this.quotes['JPY=X'];
    return q && q.price ? q.price : null;
  };

  // Returns the JPY value, or null if it can't be computed yet (quote not
  // loaded / fetch failed).
  AssetApp.prototype.valueJpy = function (asset) {
    if (asset.assetType === 'cash') {
      var amt = asset.amount || 0;
      if (asset.currency === 'JPY') return amt;
      var rate = this.fxRate();
      return rate ? amt * rate : null;
    }
    var quote = this.quotes[asset.symbol];
    if (!quote || quote.price == null || asset.quantity == null) return null;
    var native = quote.price * asset.quantity;
    var currency = quote.currency || 'JPY';
    if (currency === 'JPY') return native;
    var fx = this.fxRate();
    return fx ? native * fx : null;
  };

  AssetApp.prototype.render = function () {
    this.renderSummary();
    this.renderList();
  };

  AssetApp.prototype.renderSummary = function () {
    var self = this;
    var totals = { shared: 0, ken: 0, nao: 0 };
    var grandTotal = 0;
    this.assets.forEach(function (asset) {
      var v = self.valueJpy(asset);
      if (v == null) return;
      totals[asset.category] += v;
      grandTotal += v;
    });

    this.dom.totalEl.textContent = formatJpy(grandTotal);

    this.dom.summaryBar.innerHTML = '';
    this.dom.summaryLegend.innerHTML = '';
    ['shared', 'ken', 'nao'].forEach(function (cat) {
      var pct = grandTotal > 0 ? (totals[cat] / grandTotal) * 100 : 0;
      var seg = el('span', 'asset-summary-segment');
      seg.style.width = pct + '%';
      seg.style.backgroundColor = CATEGORY_COLORS[cat];
      self.dom.summaryBar.appendChild(seg);

      var legendItem = el('span', 'asset-summary-legend-item');
      var dot = el('span', 'asset-summary-dot');
      dot.style.backgroundColor = CATEGORY_COLORS[cat];
      legendItem.appendChild(dot);
      legendItem.appendChild(document.createTextNode(CATEGORY_LABELS[cat] + ' ' + formatJpy(totals[cat])));
      self.dom.summaryLegend.appendChild(legendItem);
    });
  };

  AssetApp.prototype.buildRow = function (asset) {
    var self = this;
    var row = el('li', 'asset-row');
    row.setAttribute('data-id', asset.id);

    row.appendChild(el('span', 'drag-handle', '⠿'));

    var info = el('div', 'asset-info');
    var head = el('div', 'asset-head');
    var name = el('span', 'asset-name', asset.name);
    name.addEventListener('click', function () {
      self.openDialog(asset);
    });
    head.appendChild(name);
    head.appendChild(el('span', 'asset-type-badge', TYPE_LABELS[asset.assetType] || asset.assetType));
    info.appendChild(head);

    var detailParts = [];
    if (asset.assetType === 'cash') {
      detailParts.push((asset.currency === 'JPY' ? '¥' : '$') + Number(asset.amount || 0).toLocaleString());
    } else {
      if (asset.symbol) detailParts.push(asset.symbol);
      if (asset.quantity != null) detailParts.push(asset.quantity + '口');
    }
    info.appendChild(el('span', 'asset-sub', detailParts.join(' ・ ')));

    if (asset.memo) {
      info.appendChild(el('span', 'asset-memo', asset.memo));
    }
    row.appendChild(info);

    var value = this.valueJpy(asset);
    row.appendChild(el('span', 'asset-value', value == null ? '取得中…' : formatJpy(value)));

    var del = el('button', 'todo-delete', '×');
    del.type = 'button';
    del.setAttribute('aria-label', '削除');
    del.addEventListener('click', function () {
      self.deleteAsset(asset);
    });
    row.appendChild(del);

    return row;
  };

  AssetApp.prototype.renderList = function () {
    var self = this;
    var visible = this.assets
      .filter(function (a) { return a.category === self.activeCategory; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    this.dom.list.innerHTML = '';
    this.dom.empty.hidden = visible.length > 0;
    visible.forEach(function (asset) {
      self.dom.list.appendChild(self.buildRow(asset));
    });
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.AssetApp = AssetApp;
})(window);
