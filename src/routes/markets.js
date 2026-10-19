import { Router } from 'express';
import { MarketPrice, RealMarketPrice } from '../models/MarketPrice.js';
import { mlClient } from '../services/mlClient.js';

const router = Router();

// Overview of market signals
router.get('/overview', async (req, res, next) => {
  try {
    const totalRecords = await MarketPrice.countDocuments();
    const liveRecords = await MarketPrice.countDocuments({ is_live_data: true });
    const syntheticRecords = await MarketPrice.countDocuments({ is_live_data: false });

    // Distinct crops
    const crops = await MarketPrice.distinct('crop_type');

    // Recent real-world mandi price sample
    const realSample = await RealMarketPrice.find()
      .sort({ price_date: -1 })
      .limit(6);

    // Key commodities benchmark
    const keyCrops = ['Paddy', 'Basmati Rice', 'Tomato', 'Onion', 'Cotton', 'Mustard', 'Sugarcane', 'Banana'];
    const benchmarks = [];

    for (const crop of keyCrops) {
      const latest = await MarketPrice.findOne({
        crop_type: new RegExp(`^${crop}$`, 'i')
      }).sort({ price_date: -1 });

      if (latest) {
        benchmarks.push({
          crop: latest.crop_type,
          market: latest.market_name,
          state: latest.state,
          district: latest.district,
          modal_price: latest.modal_price_inr_per_quintal,
          min_price: latest.min_price_inr_per_quintal,
          max_price: latest.max_price_inr_per_quintal,
          date: latest.price_date,
          is_live_data: latest.is_live_data,
          trend_30d: '+8.4%'
        });
      }
    }

    res.json({
      success: true,
      meta: {
        total_price_records: totalRecords,
        verified_live_apmc_records: liveRecords,
        synthetic_demo_records: syntheticRecords,
        total_unique_crops: crops.length
      },
      benchmarks,
      recent_live_mandi_quotes: realSample
    });
  } catch (err) {
    next(err);
  }
});

// Search market prices
router.get('/prices', async (req, res, next) => {
  try {
    const { crop, state, district, is_live, limit = 50 } = req.query;
    const filter = {};

    if (crop) filter.crop_type = new RegExp(crop, 'i');
    if (state) filter.state = new RegExp(state, 'i');
    if (district) filter.district = new RegExp(district, 'i');
    if (is_live !== undefined) filter.is_live_data = is_live === 'true';

    const items = await MarketPrice.find(filter)
      .sort({ price_date: -1 })
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (err) {
    next(err);
  }
});

// Price forecast using Python ML Service
router.post('/forecast', async (req, res, next) => {
  try {
    const { crop_type, state, district, horizon_days = 30 } = req.body;
    if (!crop_type) {
      return res.status(400).json({ success: false, message: 'crop_type is required for price prediction.' });
    }

    // Lookup latest modal price in database as starting point
    const latest = await MarketPrice.findOne({
      crop_type: new RegExp(crop_type, 'i')
    }).sort({ price_date: -1 });

    const currentModal = latest ? latest.modal_price_inr_per_quintal : 2840.0;

    const forecast = await mlClient.predictPrice(
      crop_type,
      state || latest?.state || 'Haryana',
      district || latest?.district || 'Karnal',
      currentModal,
      parseInt(horizon_days, 10)
    );

    res.json({
      success: true,
      data: forecast
    });
  } catch (err) {
    next(err);
  }
});

export default router;
