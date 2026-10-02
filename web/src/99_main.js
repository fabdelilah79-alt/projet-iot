/* EnergyLab — démarrage de l'application */
(function (root) {
  'use strict';
  const EL = root.EL;
  if (typeof document === 'undefined') return;
  function start() {
    if (EL.applyTheme) EL.applyTheme();
    EL.boot().catch(function (e) {
      console.error(e);
      const main = document.getElementById('view');
      if (main) main.innerHTML = '<div class="note bad">Erreur au démarrage : ' + EL.util.escapeHtml(e.message) + '</div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : this);
