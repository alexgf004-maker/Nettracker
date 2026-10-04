import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignMapKml, campaignPointRows, distinctVisitPoints, estimatedFieldReturn, missingVisitFields, validCoordinates } from '../js/domain/pre-campaign.js';

test('agrupa CR y perturbaciones del mismo contrato en una visita, sin perder los códigos', () => {
  const cases = [
    { id: 'a', code: 'CR1O2026201', caseType: 'CR', campaignId: 'MT_2026_10', servicePointId: 'p1' },
    { id: 'b', code: 'DA1O2026041O00', caseType: 'DA', campaignId: 'MT_2026_10', servicePointId: 'p1' },
    { id: 'c', code: 'DF1O2026031O00', caseType: 'DF', campaignId: 'MT_2026_10', servicePointId: 'p2' },
    { id: 'd', code: 'CR1N2026201', caseType: 'CR', campaignId: 'MT_2026_11', servicePointId: 'p3' },
  ];
  const points = [
    { id: 'p1', contractNumber: 'NC-1', customerName: 'Cliente ficticio', address: 'Lugar ficticio', meterNumber: 'M1', electricalReference: 'CT1', feeder: 'AL1', coordinates: { lat: 13.7, lng: -89.2 } },
    { id: 'p2', contractNumber: 'NC-1', meterNumber: 'M1' },
    { id: 'p3', contractNumber: 'NC-3' },
  ];
  const rows = campaignPointRows('MT_2026_10', cases, points);
  assert.equal(rows.length, 3);
  const visits = distinctVisitPoints(rows);
  assert.equal(visits.length, 1);
  assert.deepEqual(visits[0].codes, ['CR1O2026201', 'DA1O2026041O00', 'DF1O2026031O00']);
  assert.deepEqual(missingVisitFields(visits[0]), []);
});

test('nunca fusiona casos sin NC y muestra los datos faltantes', () => {
  const rows = campaignPointRows('MT_2026_10', [
    { id: 'a', code: 'CR1O2026201', caseType: 'CR', campaignId: 'MT_2026_10' },
    { id: 'b', code: 'CR1O2026202', caseType: 'CR', campaignId: 'MT_2026_10' },
  ], []);
  assert.equal(distinctVisitPoints(rows).length, 2);
  assert.ok(missingVisitFields(rows[0].point).includes('NC'));
  assert.equal(validCoordinates({ lat: 0, lng: 0 }), false);
});

test('estima recepción diez días calendario después de entregar al contratista', () => {
  assert.equal(estimatedFieldReturn('2026-10-28'), '2026-11-07');
  assert.equal(estimatedFieldReturn(''), '');
});

test('exporta un punto con todos sus códigos y escapa texto XML del cliente', () => {
  const kml = campaignMapKml([{ customerName: 'A & B <Prueba>', contractNumber: 'NC-1', address: 'Lugar',
    codes: ['CR1O2026201', 'DA1O2026041O00'], coordinates: { lat: 13.7, lng: -89.2 } },
  { codes: ['DF1O2026031O00'], coordinates: null }], 'Octubre 2026');
  assert.match(kml, /A &amp; B &lt;Prueba&gt;/);
  assert.match(kml, /-89.2,13.7,0/);
  assert.match(kml, /CR1O2026201 · DA1O2026041O00/);
  assert.doesNotMatch(kml, /DF1O2026031O00/);
});
