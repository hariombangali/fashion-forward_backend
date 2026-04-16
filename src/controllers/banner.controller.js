const Banner = require('../models/Banner');

/**
 * @desc    Public — get active banners for a placement
 * @route   GET /api/banners?placement=home-hero
 */
const getBanners = async (req, res, next) => {
  try {
    const placement = req.query.placement || 'home-hero';
    const banners = await Banner.find({ placement, active: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — list all banners (any status)
 * @route   GET /api/banners/admin
 */
const getAllBannersAdmin = async (req, res, next) => {
  try {
    const banners = await Banner.find()
      .sort({ placement: 1, sortOrder: 1, createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: banners,
      gradientPresets: Banner.GRADIENT_PRESETS,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — get single banner by id
 * @route   GET /api/banners/admin/:id
 */
const getBannerById = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id).lean();
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    res.json({ success: true, data: banner });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — create banner
 * @route   POST /api/banners
 */
const createBanner = async (req, res, next) => {
  try {
    const body = { ...req.body };
    // If image uploaded via multer-cloudinary, req.file.path holds Cloudinary URL
    if (req.file) body.imageUrl = req.file.path;

    // Normalize types
    if (body.sortOrder !== undefined) body.sortOrder = Number(body.sortOrder) || 0;
    if (body.overlayOpacity !== undefined) body.overlayOpacity = Math.max(0, Math.min(100, Number(body.overlayOpacity) || 0));
    if (typeof body.active === 'string') body.active = body.active === 'true';

    const banner = await Banner.create(body);
    res.status(201).json({ success: true, data: banner, message: 'Banner created' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — update banner
 * @route   PUT /api/banners/:id
 */
const updateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    const body = { ...req.body };
    if (req.file) body.imageUrl = req.file.path;
    if (body.sortOrder !== undefined) body.sortOrder = Number(body.sortOrder) || 0;
    if (body.overlayOpacity !== undefined) body.overlayOpacity = Math.max(0, Math.min(100, Number(body.overlayOpacity) || 0));
    if (typeof body.active === 'string') body.active = body.active === 'true';

    Object.assign(banner, body);
    await banner.save();
    res.json({ success: true, data: banner, message: 'Banner updated' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — delete banner
 * @route   DELETE /api/banners/:id
 */
const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — toggle active status
 * @route   PUT /api/banners/:id/toggle
 */
const toggleBannerActive = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    banner.active = !banner.active;
    await banner.save();
    res.json({ success: true, data: banner });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — bulk reorder banners
 * @route   PUT /api/banners/reorder
 * body: { ids: ['id1','id2',...] }
 */
const reorderBanners = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'ids array required' });
    }
    await Promise.all(
      ids.map((id, index) =>
        Banner.updateOne({ _id: id }, { $set: { sortOrder: index } })
      )
    );
    res.json({ success: true, message: 'Banners reordered' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBanners,
  getAllBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
  reorderBanners,
};
