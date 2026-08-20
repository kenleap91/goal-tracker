/**
 * Supabase-backed access to the shared household shopping list. Same
 * sharing model as TodoRepository: any logged-in household member can
 * read/write all of it.
 */
(function (global) {
  'use strict';

  var ITEMS_TABLE = 'goal_tracker_shopping_items';

  function toItem(row) {
    return {
      id: row.id,
      category: row.category,
      name: row.name,
      quantity: row.quantity,
      bought: row.bought,
      createdAt: row.created_at,
      boughtAt: row.bought_at,
      position: row.position
    };
  }

  function check(res) {
    if (res.error) throw res.error;
    return res;
  }

  function ShoppingRepository(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  ShoppingRepository.prototype.getItems = function () {
    return this.client
      .from(ITEMS_TABLE)
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .then(function (res) {
        check(res);
        return res.data.map(toItem);
      });
  };

  ShoppingRepository.prototype.addItem = function (input) {
    var name = (input && input.name || '').trim();
    var category = (input && input.category) || 'food';
    var position = (input && input.position) || 0;
    var quantity = (input && input.quantity) || null;
    return this.client
      .from(ITEMS_TABLE)
      .insert({ category: category, name: name, quantity: quantity, created_by: this.userId, position: position })
      .select()
      .single()
      .then(function (res) {
        check(res);
        return toItem(res.data);
      });
  };

  ShoppingRepository.prototype.updateItem = function (id, input) {
    var patch = {};
    if (input.name != null) patch.name = input.name.trim();
    if (input.category != null) patch.category = input.category;
    if (input.quantity !== undefined) patch.quantity = input.quantity || null;
    return this.client
      .from(ITEMS_TABLE)
      .update(patch)
      .eq('id', id)
      .then(check);
  };

  ShoppingRepository.prototype.toggleBought = function (id, bought) {
    return this.client
      .from(ITEMS_TABLE)
      .update({ bought: bought, bought_at: bought ? new Date().toISOString() : null })
      .eq('id', id)
      .then(check);
  };

  ShoppingRepository.prototype.deleteItem = function (id) {
    return this.client
      .from(ITEMS_TABLE)
      .delete()
      .eq('id', id)
      .then(check);
  };

  // ids is an array of item ids in their desired new order (within one
  // category). Positions are recomputed as sequential multiples of 10.
  ShoppingRepository.prototype.updatePositions = function (ids) {
    var self = this;
    return Promise.all(ids.map(function (id, index) {
      return self.client
        .from(ITEMS_TABLE)
        .update({ position: (index + 1) * 10 })
        .eq('id', id)
        .then(check);
    }));
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.ShoppingRepository = ShoppingRepository;
})(window);
