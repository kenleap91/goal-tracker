/**
 * Public Supabase project config for goal-tracker. Safe to commit: this key
 * is meant to be exposed client-side and access is enforced by Postgres RLS
 * policies (see supabase/schema.sql), not by keeping this value secret.
 */
(function (global) {
  'use strict';
  global.GoalTracker = global.GoalTracker || {};
  global.GoalTracker.SUPABASE_URL = 'https://mfnmhpobusgnbhkegnav.supabase.co';
  global.GoalTracker.SUPABASE_ANON_KEY = 'sb_publishable_vJXZoGMb_I945LSrR5uLVg_a2rnSFCf';
})(window);
