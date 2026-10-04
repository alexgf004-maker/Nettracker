import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCampaignSheets, reviewCampaignRows } from '../js/domain/campaign-import.js';

const campaign = { id: 'MT_2026_10', year: 2026, month: 10, ownerArea: 'CPT MT' };
const official = (name, data) => ({ name, sheets: [{ name: 'DetaSorteoCPT', rows: [
  [], ['Número SIGET', 'Id del Usuario', 'Nombre del  Usuario', 'Dirección'], ...data,
] }] });

test('separa las tres perturbaciones MT de los listados oficiales compartidos', () => {
  const files = [
    official('RT.xlsx', [['CR1O2026201', 'NC-MT-1', 'Prueba 1', 'Dirección 1'], ['CR1O2026202', 'NC-MT-2', 'Prueba 2', 'Dirección 2']]),
    official('DA.xlsx', [['DA1O2026041O00', 'NC-MT-1', 'Prueba 1', 'Dirección 1'], ['DA1O2026051O00', 'NC-BT-1', 'Prueba BT', 'Dirección BT']]),
    official('DF.xlsx', [['DF1O2026031O00', 'NC-MT-2', 'Prueba 2', 'Dirección 2'], ['DF1O2026041O00', 'NC-BT-2', 'Prueba BT', 'Dirección BT']]),
  ];
  const parsed = parseCampaignSheets(files, campaign);
  const reviewed = reviewCampaignRows(parsed.rows, campaign, [], []);
  assert.equal(parsed.errors.length, 0);
  assert.equal(reviewed.filter(row => row.selected).length, 4);
  assert.equal(reviewed.filter(row => row.issue === 'Perturbación sin CR de esta campaña').length, 2);
});

test('lee solo Listado, enriquece columnas y rechaza períodos o contratos conflictivos', () => {
  const files = [{ name: 'Preparado.xlsx', sheets: [
    { name: 'Listado', rows: [
      ['NC', 'CÓDIGO SIGET', 'NOMBRE', 'DIRECCIÓN', 'CORTE', 'MEDIDOR', 'LATITUD', 'LONGITUD', 'UBICACIÓN', 'ALIMENTADOR', 'URBANIDAD'],
      ['NC-MT-1', '[CR1O2026201]', 'Cliente', 'Dirección', 'CT123', 'M123', 13.7, -89.2, '', 'AL013-23000', 'R'],
      ['NC-ERROR', 'CR1N2026202', 'Cliente', 'Dirección'],
    ] },
    { name: 'Fecha1', rows: [['Número SIGET', 'Id del Usuario', 'Nombre del  Usuario', 'Dirección'], ['CR1O2026203', 'NC-MT-3', 'Cliente', 'Dirección']] },
  ] }, official('Otro.xlsx', [['CR1O2026201', 'NC-OTRO', 'Cliente', 'Dirección']])];
  const parsed = parseCampaignSheets(files, campaign);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].networkVoltageLL, 23000);
  assert.equal(parsed.rows[0].electricalReference, 'CT123');
  assert.equal(parsed.rows[0].urbanity, 'R');
  assert.equal(reviewCampaignRows(parsed.rows, campaign, [], [])[0].selected, false);
  assert.equal(parsed.errors.length, 2);
});

test('no importa expedientes existentes ligados a otra campaña o con contrato distinto', () => {
  const rows = [{ code: 'CR1O2026201', contractNumber: 'NC-UNO' }];
  const cases = [{ id: 'c1', code: rows[0].code, workflowType: 'campaign', caseType: 'CR', ownerArea: 'CPT MT', campaignId: 'MT_2026_09', servicePointId: 'sp1' }];
  const points = [{ id: 'sp1', contractNumber: 'NC-DOS' }];
  assert.match(reviewCampaignRows(rows, campaign, cases, points)[0].issue, /otra área o campaña/);
  cases[0].campaignId = null;
  assert.match(reviewCampaignRows(rows, campaign, cases, points)[0].issue, /contrato difiere/);
});
