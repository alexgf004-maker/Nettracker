import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

// Ejecuta los módulos reales de importación y sincronización sin escribir en Firebase.
// Comparte con Playwright el mock que respeta la cancelación de DataSnapshot.forEach.
const root = fileURLToPath(new URL('../', import.meta.url));
const campaign = { id: 'MT_2026_10', year: 2026, month: 10, ownerArea: 'CPT MT' };

async function app(fixture = {}) {
  const pending = [];
  const state = { campaigns: [], cases: [], servicePoints: [], equipmentEvents: [], records: [],
    selectedCampaignId: campaign.id, sesionUsuario: { nombre: 'Usuario de prueba' } };
  const messages = [];
  let renders = 0;
  const context = vm.createContext({ window: { __FIXTURE__: fixture },
    setTimeout: callback => pending.push(callback) });
  const modules = new Map();
  const stubs = new Map([
    [resolve(root, 'js/state.js'), { state }],
    [resolve(root, 'js/views/render.js'), { render: () => { renders++; } }],
    [resolve(root, 'js/ui.js'), { showToast: message => messages.push(message) }],
    ['firebase-app', { initializeApp: () => ({}) }],
  ]);
  async function load(id) {
    if (modules.has(id)) return modules.get(id);
    const stub = stubs.get(id);
    const module = stub
      ? new vm.SyntheticModule(Object.keys(stub), function () {
        for (const [name, value] of Object.entries(stub)) this.setExport(name, value);
      }, { context, identifier: id })
      : new vm.SourceTextModule(await readFile(id, 'utf8'), { context, identifier: id });
    modules.set(id, module);
    await module.link((specifier, parent) => {
      if (specifier.endsWith('/firebase-app.js')) return load('firebase-app');
      if (specifier.endsWith('/firebase-database.js')) return load(resolve(root, 'tests/mock/firebase-database.js'));
      return load(resolve(dirname(parent.identifier), specifier));
    });
    return module;
  }
  async function use(path) {
    const module = await load(resolve(root, path));
    if (module.status !== 'evaluated') await module.evaluate();
    return module.namespace;
  }
  const flush = () => { while (pending.length) pending.shift()(); };
  const sync = await use('js/data/sync.js');
  sync.iniciarSync();
  flush();
  return { state, messages, use, flush, db: context.window.__DB__,
    writes: context.window.__WRITES__, renders: () => renders };
}

function officialFiles() {
  const row = (code, contract) => [code, contract, 'Cliente sintético', 'Dirección sintética'];
  const cr = Array.from({ length: 48 }, (_, index) => row(`CR1O2026${201 + index}`, `NC-MT-${index + 1}`));
  const disturbance = type => Array.from({ length: 12 }, (_, index) =>
    row(`${type}1O2026${String(index + 1).padStart(2, '0')}1O00`,
      index < 3 ? `NC-MT-${index + 1}` : `NC-BT-${index + 1}`));
  return [cr, disturbance('DA'), disturbance('DF')].map((rows, index) => ({
    name: `${['RT', 'DA', 'DF'][index]}.xlsx`, sheets: [{ name: 'DetaSorteoCPT',
      rows: [[], ['Número SIGET', 'Id del Usuario', 'Nombre del Usuario', 'Dirección'], ...rows] }],
  }));
}

test('el mock cancela forEach con push y recorre todo sin retorno', async () => {
  const instance = await app({ cases: { a: { code: 'A' }, b: { code: 'B' } } });
  const firebase = await instance.use('js/firebase.js');
  const snapshot = await firebase.get(firebase.casesRef);
  const cancelled = [];
  assert.equal(snapshot.forEach(child => cancelled.push(child.key)), true);
  assert.equal(cancelled.length, 1);
  const complete = [];
  assert.equal(snapshot.forEach(child => { complete.push(child.key); }), false);
  assert.equal(complete.length, 2);
});

test('carga todos los casos, campañas, puntos y eventos ya guardados', async () => {
  const cases = Object.fromEntries(Array.from({ length: 54 }, (_, index) =>
    [`case${index}`, { campaignId: campaign.id, updatedAt: index }]));
  const instance = await app({ cases,
    campaigns: { [campaign.id]: campaign, MT_2026_11: { ...campaign, month: 11 } },
    servicePoints: { p1: { contractNumber: 'NC-1' }, p2: { contractNumber: 'NC-2' } },
    equipmentEvents: { ev1: { occurredAt: 1 }, ev2: { occurredAt: 2 } },
  });
  assert.equal(instance.state.cases.length, 54);
  assert.equal(instance.state.campaigns.length, 2);
  assert.equal(instance.state.campaigns[0].month, 11);
  assert.equal(instance.state.servicePoints.length, 2);
  assert.equal(instance.state.equipmentEvents.length, 2);
  assert.equal(instance.state.equipmentEvents[0].id, 'ev2');
  assert.ok(instance.renders() > 0);
});

test('importa 54 de 72, carga los 54 y conserva el resultado al repetir y recargar', async () => {
  const instance = await app({ campaigns: { [campaign.id]: campaign } });
  const parser = await instance.use('js/domain/campaign-import.js');
  const actions = await instance.use('js/actions/campaign-import.js');
  const parsed = parser.parseCampaignSheets(officialFiles(), campaign);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 72);
  function prepare() {
    instance.state.campaignImport = { busy: false, rows: parser.reviewCampaignRows(
      parsed.rows, campaign, instance.state.cases, instance.state.servicePoints) };
  }
  prepare();
  assert.equal(instance.state.campaignImport.rows.filter(row => row.selected).length, 54);
  await actions.saveCampaignImport();
  instance.flush();
  assert.equal(Object.keys(instance.db.cases).length, 54);
  assert.equal(Object.keys(instance.db.caseIdsByCampaign[campaign.id]).length, 54);
  assert.equal(Object.keys(instance.db.caseCodeIndex).length, 54);
  assert.equal(Object.keys(instance.db.servicePoints).length, 48);
  assert.equal(instance.state.cases.filter(item => item.campaignId === campaign.id).length, 54);
  assert.equal(instance.state.servicePoints.length, 48);
  assert.equal(instance.state.view, 'campaign_detail');
  for (const type of ['CR', 'DA', 'DF']) {
    assert.equal(instance.state.cases.filter(item => item.caseType === type).length, type === 'CR' ? 48 : 3);
  }
  assert.match(instance.messages.at(-1), /54 casos creados/);
  const views = await instance.use('js/views/campaigns.js');
  const html = views.renderCampaignDetail();
  assert.match(html, /Casos vinculados \(54\)/);
  assert.match(html, /Precampaña · 48 puntos/);
  assert.equal((html.match(/onclick="openCase\('/g) || []).length, 54);
  for (const item of instance.state.cases) assert.ok(html.includes(`#${item.code}`));
  const writesBefore = instance.writes.length;
  prepare();
  await actions.saveCampaignImport();
  instance.flush();
  assert.equal(instance.writes.length, writesBefore);
  assert.match(instance.messages.at(-1), /54 ya registrados/);
  const reloaded = await app(instance.db);
  assert.equal(reloaded.state.cases.filter(item => item.campaignId === campaign.id).length, 54);
  assert.equal(reloaded.state.servicePoints.length, 48);
  const reloadedViews = await reloaded.use('js/views/campaigns.js');
  assert.match(reloadedViews.renderCampaignDetail(), /Casos vinculados \(54\)/);
});
