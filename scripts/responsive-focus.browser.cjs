const assert = require('node:assert/strict')
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const chrome = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean).find(existsSync)
assert.ok(chrome, 'Chrome or Chromium is required; set CHROME_BIN if needed')
const output = resolve('exampleSite/public')
const bundle = join(output, 'js/main.bundle.js')
assert.ok(existsSync(bundle), 'Build the example site with pnpm build first')
const fixtureDir = mkdtempSync(join(tmpdir(), 'datatable-focus-'))
const fixture = join(fixtureDir, 'index.html')
const table = (id, manual = false) => `<table id="${id}" class="table data-table"
  data-table-init="${manual ? 'manual' : 'auto'}" data-table-paging="true"
  data-table-paging-option-perPage="5" data-table-searchable="true">
  <thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${Array.from(
    { length: 12 }, (_, index) => `<tr><td>Item ${index + 1}</td><td>${index + 1}</td></tr>`
  ).join('')}</tbody></table>`
writeFileSync(fixture, `<!doctype html><html><head>
  <link rel="stylesheet" href="${pathToFileURL(join(output, 'css/main.css'))}">
  <style>
    .host { width: 600px; max-width: 100%; }
    body { padding: 16px; }
    .datatable-top { padding-inline: 0; }
    #always { min-width: 900px; }
    .form-select, .form-control { transition: none !important; }
  </style></head><body>
  <div class="host table-responsive keep-class" id="always-host">${table('always')}</div>
  ${['sm', 'md', 'lg', 'xl', 'xxl'].map(breakpoint =>
    `<div class="host table-responsive-${breakpoint}" id="breakpoint-${breakpoint}">${table(`table-${breakpoint}`)}</div>`
  ).join('')}
  <div class="host table-responsive keep-class" id="manual-host">${table('manual', true)}</div>
  <div class="host" id="bare-host">${table('bare')}</div>
  <div class="host table-responsive" id="shared-host">${table('shared')}<table><tr><td>Static sibling</td></tr></table></div>
  <div class="host table-responsive" id="static-host"><table><tr><td>Static table</td></tr></table></div>
  <div class="host table-responsive-custom" id="unknown-host">${table('unknown')}</div>
  <script src="${pathToFileURL(bundle)}"></script>
  <output id="result"></output>
  <script>
  window.addEventListener('load', () => setTimeout(() => {
    const result = {};
    try {
      document.documentElement.dataset.bsTheme = new URLSearchParams(location.search).get('theme');
      const api = window.hinodeDatatables;
      const manual = document.querySelector('#manual');
      const options = api.options(manual);
      options.classes.wrapper = 'custom-wrapper';
      options.classes.container = 'custom-container';
      const dt = new window.simpleDatatables.DataTable(manual, options);
      api.attach(manual, dt);
      api.attach(manual, dt);
      const responsive = element => [...element.classList].filter(name => /^table-responsive(?:-(?:sm|md|lg|xl|xxl))?$/.test(name));
      const clipped = element => {
        element.focus();
        const box = element.getBoundingClientRect();
        const shadow = getComputedStyle(element).boxShadow;
        const spread = Number(shadow.match(/ ([\\d.]+)px$/)?.[1] || 0);
        const edges = [];
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          const css = getComputedStyle(parent), rect = parent.getBoundingClientRect();
          if ((css.overflowX !== 'visible' && (box.left - spread < rect.left || box.right + spread > rect.right)) ||
              (css.overflowY !== 'visible' && (box.top - spread < rect.top || box.bottom + spread > rect.bottom))) edges.push(parent.id || parent.className);
        }
        return { shadow, edges, focused: document.activeElement === element };
      };
      const host = document.querySelector('#always-host');
      const container = host.querySelector('.datatable-container');
      result.auto = {
        select: clipped(host.querySelector('select')),
        search: clipped(host.querySelector('input')),
        pagination: clipped(host.querySelector('.page-link[data-page="2"]')),
        outerOverflow: getComputedStyle(host).overflowX,
        innerOverflow: getComputedStyle(container).overflowX,
        scrolls: container.scrollWidth > container.clientWidth,
        pageOverflows: document.documentElement.scrollWidth > innerWidth,
        customClass: host.classList.contains('keep-class')
      };
      result.width = innerWidth;
      result.breakpoints = ['sm', 'md', 'lg', 'xl', 'xxl'].map(name => {
        const breakpoint = document.querySelector('#breakpoint-' + name);
        return {
          outer: responsive(breakpoint),
          inner: responsive(breakpoint.querySelector('.datatable-container')),
          overflow: getComputedStyle(breakpoint.querySelector('.datatable-container')).overflowX
        };
      });
      const manualHost = document.querySelector('#manual-host');
      result.manual = { outer: responsive(manualHost), inner: responsive(dt.containerDOM), focus: clipped(dt.wrapperDOM.querySelector('input')) };
      dt.search('Item 12');
      result.searchRows = dt.dom.tBodies[0].rows.length;
      result.searchValue = dt.dom.tBodies[0].rows[0].cells[0].textContent;
      dt.search('');
      dt.page(2);
      result.pageValue = dt.dom.tBodies[0].rows[0].cells[0].textContent;
      dt.destroy();
      result.destroy = { classes: responsive(manualHost), customClass: manualHost.classList.contains('keep-class'), tables: manualHost.querySelectorAll('table').length };
      dt.init();
      api.attach(dt.dom, dt);
      result.sameInstance = { outer: responsive(manualHost), inner: responsive(dt.containerDOM), focus: clipped(dt.wrapperDOM.querySelector('input')) };
      dt.destroy();
      const restored = manualHost.querySelector('table');
      const next = new window.simpleDatatables.DataTable(restored, api.options(restored));
      api.attach(restored, next);
      result.reinitialize = { outer: responsive(manualHost), inner: responsive(next.containerDOM) };
      result.bare = responsive(document.querySelector('#bare-host .datatable-container'));
      result.shared = responsive(document.querySelector('#shared-host'));
      result.static = responsive(document.querySelector('#static-host'));
      result.unknown = document.querySelector('#unknown-host').className;
    } catch (error) { result.error = error.stack; }
    document.querySelector('#result').textContent = JSON.stringify(result);
  }, 30));
  </script></body></html>`)

test.after(() => rmSync(fixtureDir, { recursive: true, force: true }))
for (const width of [1400, 400]) for (const theme of ['light', 'dark']) {
  test(`responsive controls remain visible at width ${width} in ${theme} mode`, () => {
    const run = spawnSync(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu',
      '--allow-file-access-from-files', '--virtual-time-budget=1000',
      `--window-size=${width},1000`, '--dump-dom', `${pathToFileURL(fixture).href}?theme=${theme}`
    ], { encoding: 'utf8', timeout: 30000 })
    assert.equal(run.status, 0, run.stderr)
    const encoded = run.stdout.match(/<output id="result">([^<]+)<\/output>/)?.[1]
    assert.ok(encoded, 'browser fixture must report its results')
    const result = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
    assert.equal(result.error, undefined)
    for (const control of [result.auto.select, result.auto.search, result.auto.pagination, result.manual.focus]) {
      assert.equal(control.focused, true, 'the inspected control must receive focus')
      assert.notEqual(control.shadow, 'none', 'focus feedback must remain enabled')
      assert.deepEqual(control.edges, [], 'focus shadow must not be clipped by an ancestor')
    }
    assert.equal(result.auto.outerOverflow, 'visible')
    assert.equal(result.auto.innerOverflow, 'auto')
    assert.equal(result.auto.scrolls, true)
    assert.equal(result.auto.pageOverflows, false)
    assert.equal(result.auto.customClass, true)
    for (const [index, [name, threshold]] of [
      ['sm', 576], ['md', 768], ['lg', 992], ['xl', 1200], ['xxl', 1400]
    ].entries()) {
      assert.deepEqual(result.breakpoints[index].outer, [])
      assert.deepEqual(result.breakpoints[index].inner, [`table-responsive-${name}`])
      assert.equal(result.breakpoints[index].overflow, result.width < threshold ? 'auto' : 'visible')
    }
    assert.deepEqual(result.manual.outer, [])
    assert.deepEqual(result.manual.inner, ['table-responsive'])
    assert.equal(result.searchRows, 1)
    assert.equal(result.searchValue, 'Item 12')
    assert.equal(result.pageValue, 'Item 6')
    assert.deepEqual(result.destroy, { classes: ['table-responsive'], customClass: true, tables: 1 })
    assert.deepEqual(result.sameInstance.outer, [])
    assert.deepEqual(result.sameInstance.inner, ['table-responsive'])
    assert.deepEqual(result.sameInstance.focus.edges, [])
    assert.deepEqual(result.reinitialize, { outer: [], inner: ['table-responsive'] })
    assert.deepEqual(result.bare, [])
    assert.deepEqual(result.shared, ['table-responsive'])
    assert.deepEqual(result.static, ['table-responsive'])
    assert.equal(result.unknown, 'host table-responsive-custom')
  })
}
