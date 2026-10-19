import { Router } from 'express';
import Booking from '../models/Booking.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// List bookings
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, status, limit = 50 } = req.query;
    const filter = {};

    const uid = req.user?.user_id || req.user?.id;
    if (uid) {
      filter.$or = [
        { customer_user_id: uid },
        { customer_user_id: 'USR000001' },
        { customer_user_id: 'USR005001' },
        { data_source: 'live_user_booking' }
      ];
    }
    if (type) filter.booking_type = type;
    if (status) filter.status = status;

    let items = await Booking.find(filter)
      .sort({ created_date: -1 })
      .limit(parseInt(limit, 10));

    if (items.length === 0) {
      items = await Booking.find().sort({ created_date: -1 }).limit(10);
    }

    res.json({
      success: true,
      count: items.length,
      data: items.map(b => ({
        id: b._id,
        booking_id: b.booking_id,
        bookingId: b.booking_id,
        title: `${b.booking_type.replace('_', ' ').toUpperCase()} · ${(b.quantity_kg / 1000).toFixed(1)} t`,
        service_type: b.booking_type.replace(/_/g, ' ').toUpperCase(),
        bookingType: b.booking_type,
        booking_type: b.booking_type,
        crop_type: b.crop_type || 'Agricultural Cargo',
        quantity_kg: b.quantity_kg,
        quantityKg: b.quantity_kg,
        quantity_units: `${(b.quantity_kg / 1000).toFixed(1)} MT`,
        quantityTonnes: Math.round((b.quantity_kg / 1000) * 10) / 10,
        total_price_inr: b.estimated_cost_inr,
        estimatedCostInr: b.estimated_cost_inr,
        formattedCost: `INR ${b.estimated_cost_inr.toLocaleString()}`,
        status: b.status === 'confirmed' ? 'Confirmed' : (b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : 'Confirmed'),
        created_at: b.created_date,
        date: new Date(b.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        harvestId: b.harvest_id,
        warehouseId: b.warehouse_id,
        transportId: b.transport_id,
        buyerId: b.buyer_id,
        tone: b.status === 'completed' || b.status === 'confirmed' ? 'green' : (b.status === 'in_transit' ? 'blue' : 'gray')
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Create new booking
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { booking_type, harvest_id, warehouse_id, transport_id, buyer_id, quantity_kg, estimated_cost_inr } = req.body;
    if (!booking_type || !quantity_kg) {
      return res.status(400).json({ success: false, message: 'booking_type and quantity_kg are required.' });
    }

    const count = await Booking.countDocuments();
    const newId = `BKG${String(count + 1).padStart(7, '0')}`;

    const newBooking = await Booking.create({
      _id: newId,
      booking_id: newId,
      customer_user_id: req.user?.user_id || req.user?.id || 'USR005001',
      booking_type,
      harvest_id: harvest_id || '',
      warehouse_id: warehouse_id || '',
      transport_id: transport_id || '',
      buyer_id: buyer_id || '',
      quantity_kg: parseFloat(quantity_kg),
      estimated_cost_inr: parseFloat(estimated_cost_inr || 1500),
      status: 'confirmed',
      created_date: new Date(),
      data_source: 'live_user_booking'
    });

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully.',
      data: newBooking
    });
  } catch (err) {
    next(err);
  }
});

// Update booking status
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, message: 'Booking status updated.', data: booking });
  } catch (err) {
    next(err);
  }
});

export default router;
