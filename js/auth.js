/**
 * Supabase auth: magic-link (passwordless) sign-in via email.
 */
(function (global) {
  'use strict';

  var G = global.GoalTracker;
  var client = global.supabase.createClient(G.SUPABASE_URL, G.SUPABASE_ANON_KEY);

  function getClient() {
    return client;
  }

  function getSession() {
    return client.auth.getSession().then(function (res) { return res.data.session; });
  }

  // shouldCreateUser: false means only pre-registered accounts (Ken/Nao,
  // created directly in the Supabase dashboard) can request a login code.
  // Anyone else's email is rejected instead of silently creating a new
  // account, since the household data (assets included) is open to any
  // signed-in user once inside.
  function sendMagicLink(email) {
    return client.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: global.location.origin, shouldCreateUser: false }
    }).then(function (res) {
      if (res.error) throw res.error;
    });
  }

  function verifyCode(email, token) {
    return client.auth.verifyOtp({ email: email, token: token, type: 'email' }).then(function (res) {
      if (res.error) throw res.error;
      return res.data.session;
    });
  }

  function onAuthStateChange(callback) {
    client.auth.onAuthStateChange(function (_event, session) {
      callback(session);
    });
  }

  function signOut() {
    return client.auth.signOut();
  }

  G.auth = {
    getClient: getClient,
    getSession: getSession,
    sendMagicLink: sendMagicLink,
    verifyCode: verifyCode,
    onAuthStateChange: onAuthStateChange,
    signOut: signOut
  };
})(window);
