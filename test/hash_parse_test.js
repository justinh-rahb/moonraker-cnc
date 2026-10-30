function parseHash(hash) {
  const route = hash.startsWith('#') ? hash.slice(1) : hash;
  const normalized = route.startsWith('/') ? route.slice(1) : route;
  const parts = normalized.split('/');
  const head = parts[0];

  if (head === 'files') {
    const path = parts.length > 1 ? parts.slice(1).map(decodeURIComponent).join('/') : '';
    return { route: 'files', path };
  }

  if (head === 'settings') {
    const tab = parts.length > 1 ? decodeURIComponent(parts[1]) : '';
    const tabMapping = {
      general: 'General',
      interface: 'Interface',
      macros: 'Macros',
      panels: 'Panels',
      cameras: 'Cameras',
      sysinfo: 'Sysinfo',
    };
    const tabName = tab ? (tabMapping[tab.toLowerCase()] || tab) : 'General';
    return { route: 'settings', tab: tabName };
  }

  return { route: 'none' };
}

const tests = [
  '#/files',
  '#/files/',
  '#/files/path/to/file.gcode',
  '#/files/path%20with%20space/sub',
  '#/settings',
  '#/settings/cameras',
  '#/settings/unknown',
  '#/other/thing',
  '',
  '#',
];

for (const h of tests) {
  console.log(h.padEnd(30), '=>', JSON.stringify(parseHash(h)));
}
