/*
 * Maranello 2027 — App_HTML
 * File: js/version.js
 *
 * Versione applicativa globale. Viene esposta su window.APP_VERSION e
 * mostrata nel footer (placeholder) e successivamente nella schermata
 * Impostazioni (Task 3, Req 24.6).
 *
 * Convenzione: SemVer (MAJOR.MINOR.PATCH).
 */

(function initAppVersion(global) {
  "use strict";

  // Versione corrente dell'App_HTML.
  // Incrementare ad ogni release significativa (Req 24.6).
  var APP_VERSION = "0.1.0";

  global.APP_VERSION = APP_VERSION;
})(typeof window !== "undefined" ? window : globalThis);
