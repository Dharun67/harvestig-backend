import { Router } from 'express';
import Harvest from '../models/Harvest.js';
import Recommendation from '../models/Recommendation.js';
import { MarketPrice } from '../models/MarketPrice.js';
import { mlClient } from '../services/mlClient.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get recommendations for a harvest or general list
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { harvestId, limit = 20 } = req.query;
    const filter = {};
    if (harvestId) filter.harvest_id = harvestId;

    let items = await Recommendation.find(filter)
      .sort({ generated_at: -1 })
      .limit(parseInt(limit, 10));

    // If no stored recommendation exists for a specific harvest, evaluate on-the-fly!
    if (items.length === 0 && harvestId) {
      const harvest = await Harvest.findById(harvestId) || await Harvest.findOne({ harvest_id: harvestId });
      if (harvest) {
        const latestPrice = await MarketPrice.findOne({
          crop_type: new RegExp(harvest.crop_type, 'i')
        }).sort({ price_date: -1 });

        const currPrice = latestPrice ? latestPrice.modal_price_inr_per_quintal : 2840;
        const evalResult = await mlClient.getPostHarvestDecision({
          harvest_id: harvest.harvest_id,
          crop_type: harvest.crop_type,
          quantity_kg: harvest.quantity_kg,
          current_local_price_inr_per_quintal: currPrice,
          state: harvest.state,
          district: harvest.district
        });

        return res.json({
          success: true,
          mode: 'dynamic_decision_engine',
          harvest_id: harvest.harvest_id,
          recommended_option: evalResult.recommended_option,
          top_net_upside_inr: evalResult.top_net_upside_inr,
          confidence_score: evalResult.overall_confidence,
          options: evalResult.options,
          circular_biomass_opportunity: evalResult.circular_biomass_opportunity,
          disclaimer: evalResult.disclaimer
        });
      }
    }

    res.json({
      success: true,
      count: items.length,
      data: items.map(r => ({
        id: r._id,
        harvestId: r.harvest_id,
        title: r.option_type.replace(/_/g, ' ').toUpperCase(),
        rationale: `Estimated net profit of INR ${r.estimated_net_profit_inr.toLocaleString()} with risk level ${r.risk_level}.`,
        estimatedNetValue: r.estimated_net_profit_inr,
        expectedRevenue: r.expected_revenue_inr,
        transportCost: r.transport_cost_inr,
        storageCost: r.storage_cost_inr,
        confidence: Math.round(r.confidence_score * 100),
        riskLevel: r.risk_level,
        dataFreshness: 'Refreshed today'
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Dynamic decision evaluation endpoint
router.post('/evaluate', authenticate, async (req, res, next) => {
  try {
    const { harvest_id, crop_type, quantity_kg, current_price, holding_days, state, district } = req.body;

    let harvestCrop = crop_type;
    let qty = quantity_kg ? parseFloat(quantity_kg) : 4000;
    let currPrice = current_price ? parseFloat(current_price) : 2840;
    let userState = state || 'Haryana';
    let userDist = district || 'Karnal';

    if (harvest_id) {
      const h = await Harvest.findById(harvest_id) || await Harvest.findOne({ harvest_id });
      if (h) {
        harvestCrop = h.crop_type;
        qty = h.quantity_kg;
        userState = h.state;
        userDist = h.district;
      }
    }

    if (!currPrice || currPrice <= 0) {
      const latestPrice = await MarketPrice.findOne({
        crop_type: new RegExp(harvestCrop || 'Rice', 'i')
      }).sort({ price_date: -1 });
      currPrice = latestPrice ? latestPrice.modal_price_inr_per_quintal : 2840;
    }

    const decision = await mlClient.getPostHarvestDecision({
      harvest_id: harvest_id || 'HAR_CUSTOM',
      crop_type: harvestCrop || 'Basmati Rice',
      quantity_kg: qty,
      current_local_price_inr_per_quintal: currPrice,
      holding_days_intended: holding_days ? parseInt(holding_days, 10) : 21,
      state: userState,
      district: userDist
    });

    res.json({
      success: true,
      data: decision
    });
  } catch (err) {
    next(err);
  }
});

export default router;
