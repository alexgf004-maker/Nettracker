// Handlers globales del módulo de expedientes.
import { openEditCase, openNewCase, saveCase } from '../actions/cases.js';
import { classifyCase } from '../domain/cases.js';
import { campaignPeriodFromCode } from '../domain/campaigns.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

window.setInstSection = section => {
  state.instSection = section;
  state.view = 'lista';
  state.selectedCampaignId = null;
  state.search = '';
  state.caseSearch = '';
  render();
};

window.setCaseFilter = filter => { state.caseFilter = filter; render(); };
window.setCaseAreaFilter = area => { state.caseAreaFilter = area; render(); };
window.setCaseSearch = value => {
  state.caseSearch = value;
  const input = document.getElementById('case-search');
  const position = input?.selectionStart;
  render();
  const nextInput = document.getElementById('case-search');
  if (nextInput && position !== undefined) {
    nextInput.focus();
    nextInput.setSelectionRange(position, position);
  }
};

window.newCase = campaignId => openNewCase(typeof campaignId === 'string' ? campaignId : '');
window.editCase = openEditCase;
window.saveCase = saveCase;
window.refreshCaseForm = () => {
  const period = campaignPeriodFromCode(state.caseForm.code);
  const matches = period && state.campaigns.filter(item => item.year === period.year && item.month === period.month && item.ownerArea === state.caseForm.ownerArea);
  if (matches?.length === 1) state.caseForm.campaignId = matches[0].id;
  render();
};
window.setCaseField = (key, value) => {
  state.caseForm[key] = value;
  if (key === 'code') {
    const classification = classifyCase(value);
    const defaults = ['', 'DGEHM', 'Reclamo de usuario', 'Requerimiento interno'];
    if (defaults.includes(state.caseForm.source)) {
      state.caseForm.source = classification.workflowType === 'campaign'
        ? 'DGEHM'
        : classification.workflowType === 'complaint' ? 'Reclamo de usuario' : 'Requerimiento interno';
    }
  }
  if (key === 'ownerArea' && state.campaigns.find(item => item.id === state.caseForm.campaignId)?.ownerArea !== value) state.caseForm.campaignId = '';
  if (['ownerArea', 'urbanity', 'campaignId'].includes(key)) render();
};
