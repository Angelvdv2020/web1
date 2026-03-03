(function initHeaderHandlers() {
  const buttons = document.querySelectorAll('.nav-text-btn[data-route]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetRoute = button.dataset.route;
      if (!targetRoute || window.location.pathname === targetRoute) {
        return;
      }
      window.location.assign(targetRoute);
    });
  });
})();
