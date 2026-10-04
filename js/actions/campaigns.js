import { campaignDueDate, campaignIdFor, CAMPAIGN_STAGES } from '../domain/campaigns.js';
import { db, get, push, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

export function openNewCampaign() {
  state.campaignForm = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    ownerArea: state.instTab === 'cpt_bt' ? 'CPT BT' : 'CPT MT',
    receivedAt: '',
  };
  state.view = 'campaign_form';
  render();
}

export async function saveCampaign() {
  const form = state.campaignForm;
  const year = Number(form.year);
  const month = Number(form.month);
  const id = campaignIdFor(year, month, form.ownerArea);
  if (!id) return showToast('Revisa el año, mes y área');
  try {
    const existing = await get(ref(db, `campaigns/${id}`));
    if (existing.exists()) {
      state.selectedCampaignId = id;
      state.view = 'campaign_detail';
      showToast('Esta campaña ya existe');
      render();
      return;
    }
    const now = Date.now();
    const record = {
        year, month, ownerArea: form.ownerArea, authority: 'DGEHM',
        receivedAt: form.receivedAt || null,
        submissionDueAt: campaignDueDate(year, month),
        stage: 'pre_campaign',
        createdAt: now, createdBy: state.sesionUsuario?.nombre || 'Desconocido',
        updatedAt: now,
    };
    await update(ref(db), { [`campaigns/${id}`]: record });
    if (!state.campaigns.some(item => item.id === id)) state.campaigns.unshift({ id, ...record });
    state.selectedCampaignId = id;
    state.view = 'campaign_detail';
    showToast('Campaña creada');
    render();
  } catch (error) {
    showToast('No se pudo guardar la campaña: ' + error.message);
  }
}

export async function setCampaignStage(stage) {
  if (!CAMPAIGN_STAGES.some(([key]) => key === stage)) return;
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  if (!campaign || campaign.stage === stage) return;
  const now = Date.now();
  const eventId = push(ref(db, `campaigns/${campaign.id}/stageHistory`)).key;
  try {
    await update(ref(db), {
      [`campaigns/${campaign.id}/stage`]: stage,
      [`campaigns/${campaign.id}/updatedAt`]: now,
      [`campaigns/${campaign.id}/updatedBy`]: state.sesionUsuario?.nombre || 'Desconocido',
      [`campaigns/${campaign.id}/stageHistory/${eventId}`]: {
        from: campaign.stage || 'pre_campaign', to: stage, at: now,
        by: state.sesionUsuario?.nombre || 'Desconocido',
      },
    });
    showToast('Etapa actualizada');
  } catch (error) {
    showToast('No se pudo actualizar la etapa: ' + error.message);
  }
}
