const StoreSettings = require('../models/StoreSettings');
const Order = require('../models/Order');

/**
 * @desc    Public — get safe/public settings
 * @route   GET /api/settings
 */
const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSingleton();

    const publicData = {
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      tagline: settings.tagline,
      theme: settings.theme,
      announcement: settings.announcement,
      flashSale: settings.flashSale,
      contact: settings.contact,
      social: settings.social,
      freeShippingThreshold: settings.freeShippingThreshold,
      flatShippingRate: settings.flatShippingRate,
      liveNotifications: settings.liveNotifications,
      typography: settings.typography,
      darkModeDefault: settings.darkModeDefault,
    };

    res.json({ success: true, data: publicData });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — get full settings including internals
 * @route   GET /api/settings/admin
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSingleton();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — update settings
 * @route   PUT /api/settings
 */
const updateSettings = async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSingleton();
    let body = { ...req.body };

    // If the admin panel sent multipart/form-data with a JSON `settings` blob,
    // merge that into body so the rest of the controller sees all fields.
    if (body.settings && typeof body.settings === 'string') {
      try {
        const parsed = JSON.parse(body.settings);
        body = { ...parsed, ...body };
        delete body.settings;
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid settings JSON' });
      }
    }

    // Handle file uploads (logo / favicon)
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        body.logoUrl = req.files.logo[0].path;
      }
      if (req.files.favicon && req.files.favicon[0]) {
        body.faviconUrl = req.files.favicon[0].path;
      }
    }

    // Handle nested theme fields
    if (body['theme.primaryColor'] || body['theme.accentColor'] ||
        body['theme.gradientFrom'] || body['theme.gradientVia'] || body['theme.gradientTo']) {
      settings.theme = {
        ...settings.theme.toObject(),
        ...(body['theme.primaryColor'] && { primaryColor: body['theme.primaryColor'] }),
        ...(body['theme.accentColor'] && { accentColor: body['theme.accentColor'] }),
        ...(body['theme.gradientFrom'] && { gradientFrom: body['theme.gradientFrom'] }),
        ...(body['theme.gradientVia'] && { gradientVia: body['theme.gradientVia'] }),
        ...(body['theme.gradientTo'] && { gradientTo: body['theme.gradientTo'] }),
      };
      delete body['theme.primaryColor'];
      delete body['theme.accentColor'];
      delete body['theme.gradientFrom'];
      delete body['theme.gradientVia'];
      delete body['theme.gradientTo'];
    }
    if (body.theme && typeof body.theme === 'object') {
      settings.theme = { ...settings.theme.toObject(), ...body.theme };
      delete body.theme;
    }

    // Handle nested announcement fields
    if (body['announcement.enabled'] !== undefined) {
      settings.announcement.enabled = body['announcement.enabled'] === 'true' || body['announcement.enabled'] === true;
      delete body['announcement.enabled'];
    }
    if (body['announcement.messages']) {
      const msgs = body['announcement.messages'];
      settings.announcement.messages = Array.isArray(msgs) ? msgs : [msgs];
      delete body['announcement.messages'];
    }
    if (body['announcement.link']) {
      settings.announcement.link = body['announcement.link'];
      delete body['announcement.link'];
    }
    if (body['announcement.bgGradient']) {
      settings.announcement.bgGradient = body['announcement.bgGradient'];
      delete body['announcement.bgGradient'];
    }
    if (body['announcement.textColor']) {
      settings.announcement.textColor = body['announcement.textColor'];
      delete body['announcement.textColor'];
    }
    if (body.announcement && typeof body.announcement === 'object') {
      Object.assign(settings.announcement, body.announcement);
      delete body.announcement;
    }

    // Handle nested flashSale fields
    if (body['flashSale.enabled'] !== undefined) {
      settings.flashSale.enabled = body['flashSale.enabled'] === 'true' || body['flashSale.enabled'] === true;
      delete body['flashSale.enabled'];
    }
    if (body['flashSale.title']) {
      settings.flashSale.title = body['flashSale.title'];
      delete body['flashSale.title'];
    }
    if (body['flashSale.subtitle']) {
      settings.flashSale.subtitle = body['flashSale.subtitle'];
      delete body['flashSale.subtitle'];
    }
    if (body['flashSale.endsAt']) {
      settings.flashSale.endsAt = new Date(body['flashSale.endsAt']);
      delete body['flashSale.endsAt'];
    }
    if (body['flashSale.ctaText']) {
      settings.flashSale.ctaText = body['flashSale.ctaText'];
      delete body['flashSale.ctaText'];
    }
    if (body['flashSale.ctaLink']) {
      settings.flashSale.ctaLink = body['flashSale.ctaLink'];
      delete body['flashSale.ctaLink'];
    }
    if (body['flashSale.bgGradient']) {
      settings.flashSale.bgGradient = body['flashSale.bgGradient'];
      delete body['flashSale.bgGradient'];
    }
    if (body.flashSale && typeof body.flashSale === 'object') {
      if (body.flashSale.endsAt) body.flashSale.endsAt = new Date(body.flashSale.endsAt);
      Object.assign(settings.flashSale, body.flashSale);
      delete body.flashSale;
    }

    // Handle nested contact fields
    if (body.contact && typeof body.contact === 'object') {
      Object.assign(settings.contact, body.contact);
      delete body.contact;
    }

    // Handle nested social fields
    if (body.social && typeof body.social === 'object') {
      Object.assign(settings.social, body.social);
      delete body.social;
    }

    // Handle nested liveNotifications fields
    if (body['liveNotifications.enabled'] !== undefined) {
      settings.liveNotifications.enabled = body['liveNotifications.enabled'] === 'true' || body['liveNotifications.enabled'] === true;
      delete body['liveNotifications.enabled'];
    }
    if (body['liveNotifications.lookbackDays'] !== undefined) {
      settings.liveNotifications.lookbackDays = Number(body['liveNotifications.lookbackDays']);
      delete body['liveNotifications.lookbackDays'];
    }
    if (body.liveNotifications && typeof body.liveNotifications === 'object') {
      Object.assign(settings.liveNotifications, body.liveNotifications);
      delete body.liveNotifications;
    }

    // Handle numeric fields
    if (body.freeShippingThreshold !== undefined) {
      body.freeShippingThreshold = Number(body.freeShippingThreshold);
    }
    if (body.flatShippingRate !== undefined) {
      body.flatShippingRate = Number(body.flatShippingRate);
    }

    // Handle nested typography fields
    if (body.typography && typeof body.typography === 'object') {
      settings.typography = { ...settings.typography.toObject(), ...body.typography };
      delete body.typography;
    }

    // Handle darkModeDefault
    if (body.darkModeDefault !== undefined) {
      settings.darkModeDefault = body.darkModeDefault === true || body.darkModeDefault === 'true';
      delete body.darkModeDefault;
    }

    // Apply remaining top-level fields
    const allowedTopLevel = [
      'storeName', 'logoUrl', 'faviconUrl', 'tagline',
      'freeShippingThreshold', 'flatShippingRate',
    ];
    for (const key of allowedTopLevel) {
      if (body[key] !== undefined) {
        settings[key] = body[key];
      }
    }

    await settings.save();
    res.json({ success: true, data: settings, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Public — get recent purchases for live notification (FOMO)
 * @route   GET /api/settings/live-purchases
 */
const getRecentPurchases = async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSingleton();

    if (!settings.liveNotifications || !settings.liveNotifications.enabled) {
      return res.json({ success: true, data: [] });
    }

    const lookbackDays = settings.liveNotifications.lookbackDays || 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - lookbackDays);

    const orders = await Order.find({
      status: { $in: ['delivered', 'shipped'] },
      createdAt: { $gte: sinceDate },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('shippingAddress items createdAt')
      .lean();

    // Sanitize data — only expose first name, city, and first product name
    const purchases = orders.map((order) => {
      const fullName = order.shippingAddress?.fullName || '';
      const firstName = fullName.split(' ')[0] || 'Someone';

      return {
        customerFirstName: firstName,
        city: order.shippingAddress?.city || '',
        productName: order.items?.[0]?.name || 'an item',
        createdAt: order.createdAt,
      };
    });

    res.json({ success: true, data: purchases });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublicSettings,
  getSettings,
  updateSettings,
  getRecentPurchases,
};
