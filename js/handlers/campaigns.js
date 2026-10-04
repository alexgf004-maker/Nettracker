import { openNewCampaign, saveCampaign, setCampaignStage } from '../actions/campaigns.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

window.newCampaign = openNewCampaign;
window.saveCampaign = saveCampaign;
window.setCampaignStage = setCampaignStage;
window.setCampaignField = (key, value) => { state.campaignForm[key] = value; };
window.setCampaignAreaView = value => { state.campaignAreaView = value; render(); };
window.openCampaign = id => {
  state.tab = 'campaigns';
  state.instSection = 'campaigns';
  state.selectedCampaignId = id;
  state.view = 'campaign_detail';
  render();
};
