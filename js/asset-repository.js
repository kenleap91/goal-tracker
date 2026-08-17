/**
 * Supabase-backed access to the shared household asset list. Same sharing
 * model as TodoRepository/ChoreRepository: any logged-in household member
 * can read/write. Live prices are NOT stored here — see price-service.js.
 */
(function (global) {
  'use strict';

  var ASSETS_TABLE = 'goal_tracker_assets';

  function toAsset(row) {
    return {
      id: row.id,
      category: row.category,
      assetType: row.asset_type,
      name: row.name,
      symbol: row.symbol,
      quantity: row.quantity,
      amount: row.amount,
      currency: row.currency,
      memo: row.memo,
      createdAt: row.created_at
    };
  }

  function check(res) {
    if (res.error) throw res.error;
    return res;
  }

  function AssetRepository(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  AssetRepository.prototype.getAssets = function () {
    return this.client
      .from(ASSETS_TABLE)
      .select('*')
      .order('created_at', { ascending: true })
      .then(function (res) {
        check(res);
        return res.data.map(toAsset);
      });
  };

  AssetRepository.prototype.addAsset = function (input) {
    return this.client
      .from(ASSETS_TABLE)
      .insert({
        category: input.category,
        asset_type: input.assetType,
        name: (input.name || '').trim(),
        symbol: input.symbol || null,
        quantity: input.quantity != null ? input.quantity : null,
        amount: input.amount != null ? input.amount : null,
        currency: input.currency || 'JPY',
        memo: input.memo || null,
        created_by: this.userId
      })
      .select()
      .single()
      .then(function (res) {
        check(res);
        return toAsset(res.data);
      });
  };

  AssetRepository.prototype.updateAsset = function (id, input) {
    return this.client
      .from(ASSETS_TABLE)
      .update({
        category: input.category,
        asset_type: input.assetType,
        name: (input.name || '').trim(),
        symbol: input.symbol || null,
        quantity: input.quantity != null ? input.quantity : null,
        amount: input.amount != null ? input.amount : null,
        currency: input.currency || 'JPY',
        memo: input.memo || null
      })
      .eq('id', id)
      .then(check);
  };

  AssetRepository.prototype.deleteAsset = function (id) {
    return this.client
      .from(ASSETS_TABLE)
      .delete()
      .eq('id', id)
      .then(check);
  };

  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.AssetRepository = AssetRepository;
})(window);
