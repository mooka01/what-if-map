// Hash routing shared by every screen. app.js fills in `render`.
export const nav = {
  render: () => {},
  // Set before showing the safety screen: { mapId, canContinue }.
  safety: null,
  go(route = '') {
    const hash = `#/${route.replace(/^#?\/?/, '')}`;
    if (location.hash === hash || (hash === '#/' && !location.hash)) nav.render();
    else location.hash = hash;
  },
};
