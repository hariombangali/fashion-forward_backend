const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

// --- Helpers ---

/**
 * Build a filter object from query params for product listing.
 */
function buildProductFilter(query, visibility) {
  const filter = { active: true };

  // Visibility
  if (visibility === 'retail') {
    filter['visibility.retail'] = true;
  } else if (visibility === 'wholesale') {
    filter['visibility.wholesale'] = true;
  }

  // Category (accepts ObjectId or slug)
  if (query.category) {
    if (mongoose.Types.ObjectId.isValid(query.category)) {
      filter.category = query.category;
    }
    // If slug is passed, it will be resolved by the caller
  }

  // Price range (retail)
  if (query.minPrice || query.maxPrice) {
    filter.retailPrice = {};
    if (query.minPrice) filter.retailPrice.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.retailPrice.$lte = Number(query.maxPrice);
  }

  // Sizes (comma-separated)
  if (query.sizes) {
    const sizesArr = query.sizes.split(',').map((s) => s.trim());
    filter.sizes = { $in: sizesArr };
  }

  // Colors (comma-separated, match by name)
  if (query.colors) {
    const colorsArr = query.colors.split(',').map((c) => c.trim());
    filter['colors.name'] = { $in: colorsArr };
  }

  // Fabric
  if (query.fabric) {
    filter.fabric = query.fabric;
  }

  // Text search
  if (query.search) {
    filter.$text = { $search: query.search };
  }

  return filter;
}

/**
 * Build sort object from query param.
 */
function buildSortOption(sortParam) {
  switch (sortParam) {
    case 'price_asc':
      return { retailPrice: 1 };
    case 'price_desc':
      return { retailPrice: -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'popular':
      return { ratingsCount: -1, ratingsAvg: -1 };
    default:
      return { createdAt: -1 };
  }
}

// --- Controllers ---

/**
 * @desc    Get public retail products with filters, sort, pagination
 * @route   GET /api/products
 */
const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    // Resolve category slug to ObjectId if needed
    let categoryFilter = req.query.category;
    if (categoryFilter && !mongoose.Types.ObjectId.isValid(categoryFilter)) {
      const cat = await Category.findOne({ slug: categoryFilter, active: true });
      if (cat) {
        req.query.category = cat._id.toString();
      } else {
        // No matching category — return empty
        return res.status(200).json({
          success: true,
          data: { products: [], page, limit, total: 0, totalPages: 0 },
        });
      }
    }

    // Admin can pass allVisibility=true to see products across all visibilities
    const isAdminAllView = req.query.allVisibility === 'true' && req.user?.role === 'admin';
    const filter = buildProductFilter(req.query, isAdminAllView ? null : 'retail');
    // Admin viewing all products — also include inactive if explicitly requested
    if (isAdminAllView && req.query.includeInactive === 'true') {
      delete filter.active;
    }
    const sort = buildSortOption(req.query.sort);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get wholesale products (requires wholesaler auth, checked at route level)
 * @route   GET /api/products/wholesale
 */
const getWholesaleProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    // Resolve category slug
    let categoryFilter = req.query.category;
    if (categoryFilter && !mongoose.Types.ObjectId.isValid(categoryFilter)) {
      const cat = await Category.findOne({ slug: categoryFilter, active: true });
      if (cat) {
        req.query.category = cat._id.toString();
      } else {
        return res.status(200).json({
          success: true,
          data: { products: [], page, limit, total: 0, totalPages: 0 },
        });
      }
    }

    const filter = buildProductFilter(req.query, 'wholesale');
    const sort = buildSortOption(req.query.sort);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Include wholesale-specific fields in the response
    const enriched = products.map((p) => ({
      ...p,
      wholesaleTiers: p.wholesaleTiers,
      wholesaleMOQ: p.wholesaleMOQ,
    }));

    res.status(200).json({
      success: true,
      data: {
        products: enriched,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by slug (public). Wholesale pricing shown only to wholesalers.
 * @route   GET /api/products/slug/:slug
 */
const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      active: true,
    }).populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const productObj = product.toObject();

    // If user is not a wholesaler, strip wholesale data
    const isWholesaler = req.user && req.user.role === 'wholesaler';
    if (!isWholesaler) {
      delete productObj.wholesaleTiers;
      delete productObj.wholesaleMOQ;
    }

    res.status(200).json({
      success: true,
      data: productObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by _id (admin)
 * @route   GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new product (admin)
 * @route   POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    const body = { ...req.body };

    // FormData sends everything as strings — parse JSON fields
    // Also accept sizeStock as an alias for stock (different form naming conventions)
    const jsonFields = ['sizes', 'colors', 'wholesaleTiers', 'tags', 'visibility', 'stock', 'sizeStock'];
    for (const field of jsonFields) {
      if (typeof body[field] === 'string') {
        try { body[field] = JSON.parse(body[field]); } catch { /* keep as-is */ }
      }
    }

    // Accept sizeStock as alias for stock
    if (body.sizeStock && (!body.stock || Object.keys(body.stock).length === 0)) {
      body.stock = body.sizeStock;
    }
    delete body.sizeStock;

    // Convert numeric strings
    const numFields = ['retailPrice', 'retailMRP', 'wholesaleMOQ', 'weightGrams'];
    for (const field of numFields) {
      if (body[field]) body[field] = Number(body[field]);
    }

    // Convert boolean strings
    if (typeof body.featured === 'string') body.featured = body.featured === 'true';
    if (typeof body.active === 'string') body.active = body.active === 'true';

    // Handle visibility as separate fields from form
    if (body.visibilityRetail !== undefined || body.visibilityWholesale !== undefined) {
      body.visibility = {
        retail: body.visibilityRetail === 'true' || body.visibilityRetail === true,
        wholesale: body.visibilityWholesale === 'true' || body.visibilityWholesale === true,
      };
      delete body.visibilityRetail;
      delete body.visibilityWholesale;
    }

    // Convert stock object (size-wise) — form may send stock_S, stock_M, etc.
    if (!body.stock || (typeof body.stock === 'object' && Object.keys(body.stock).length === 0)) {
      const stockMap = {};
      for (const key of Object.keys(body)) {
        if (key.startsWith('stock_')) {
          const size = key.replace('stock_', '');
          stockMap[size] = Number(body[key]) || 0;
          delete body[key];
        }
      }
      if (Object.keys(stockMap).length > 0) body.stock = stockMap;
    }

    // Ensure stock values are numbers
    if (body.stock && typeof body.stock === 'object') {
      const cleanStock = {};
      for (const [size, qty] of Object.entries(body.stock)) {
        cleanStock[size] = Number(qty) || 0;
      }
      body.stock = cleanStock;
    }

    // Category: if string name is sent instead of ObjectId, look up by name or slug
    if (body.category && !body.category.match(/^[0-9a-fA-F]{24}$/)) {
      // Try exact match first, then partial/starts-with match
      let cat = await Category.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${body.category}$`, 'i') } },
          { slug: body.category.toLowerCase().replace(/\s+/g, '-') },
        ],
      });
      // Fuzzy: try starts-with (e.g. "Kurtis" matches "Kurti")
      if (!cat) {
        cat = await Category.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${body.category.replace(/s$/i, '')}`, 'i') } },
            { name: { $regex: new RegExp(body.category, 'i') } },
          ],
        });
      }
      if (cat) {
        body.category = cat._id;
      } else {
        return res.status(400).json({ success: false, message: `Category "${body.category}" not found.` });
      }
    }

    // Handle image URLs from Cloudinary upload
    if (req.files && req.files.length > 0) {
      body.images = req.files.map(f => f.path || f.secure_url || f.url);
    }
    // Clean up existingImages field (not relevant for create)
    delete body.existingImages;

    // Filter out empty colors (no name)
    if (Array.isArray(body.colors)) {
      body.colors = body.colors.filter(c => c && c.name && c.name.trim());
    }

    // Ensure wholesaleTiers have numeric values + filter empty
    if (Array.isArray(body.wholesaleTiers)) {
      body.wholesaleTiers = body.wholesaleTiers
        .filter(t => t && t.minQty && t.pricePerPiece)
        .map(t => ({
          minQty: Number(t.minQty),
          maxQty: t.maxQty ? Number(t.maxQty) : null,
          pricePerPiece: Number(t.pricePerPiece),
        }));
    }

    // Filter empty tags
    if (Array.isArray(body.tags)) {
      body.tags = body.tags.filter(t => t && t.trim());
    }

    // Auto-generate SKU if not provided
    if (!body.sku) {
      const count = await Product.countDocuments();
      body.sku = `FF-${String(count + 1).padStart(5, '0')}`;
    }

    const product = await Product.create(body);

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `A product with this ${field} already exists`,
      });
    }
    next(error);
  }
};

/**
 * @desc    Update a product (admin)
 * @route   PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Parse FormData strings same as createProduct
    const body = { ...req.body };
    const jsonFields = ['sizes', 'colors', 'wholesaleTiers', 'tags', 'visibility', 'stock', 'sizeStock'];
    for (const field of jsonFields) {
      if (typeof body[field] === 'string') {
        try { body[field] = JSON.parse(body[field]); } catch { /* keep */ }
      }
    }
    // sizeStock alias
    if (body.sizeStock && (!body.stock || Object.keys(body.stock).length === 0)) {
      body.stock = body.sizeStock;
    }
    delete body.sizeStock;

    const numFields = ['retailPrice', 'retailMRP', 'wholesaleMOQ', 'weightGrams'];
    for (const f of numFields) { if (body[f]) body[f] = Number(body[f]); }
    if (typeof body.featured === 'string') body.featured = body.featured === 'true';
    if (typeof body.active === 'string') body.active = body.active === 'true';
    if (body.category && !body.category.match(/^[0-9a-fA-F]{24}$/)) {
      const cat = await Category.findOne({
        $or: [{ name: { $regex: new RegExp(`^${body.category}$`, 'i') } }, { slug: body.category.toLowerCase() }],
      });
      if (cat) body.category = cat._id;
    }
    // Handle existingImages — admin sends back only the images they want to KEEP
    // Parse the JSON array of URLs that should be preserved
    let keptImages = [];
    if (body.existingImages) {
      try {
        keptImages = typeof body.existingImages === 'string'
          ? JSON.parse(body.existingImages)
          : body.existingImages;
      } catch { keptImages = []; }
      delete body.existingImages;
    } else {
      // If existingImages not sent, keep all current images
      keptImages = product.images || [];
    }

    // Add newly uploaded images
    const newImages = req.files && req.files.length > 0
      ? req.files.map(f => f.path || f.secure_url || f.url)
      : [];

    body.images = [...keptImages.filter(Boolean), ...newImages];
    if (Array.isArray(body.wholesaleTiers)) {
      body.wholesaleTiers = body.wholesaleTiers
        .filter(t => t && t.minQty && t.pricePerPiece)
        .map(t => ({
          minQty: Number(t.minQty), maxQty: t.maxQty ? Number(t.maxQty) : null, pricePerPiece: Number(t.pricePerPiece),
        }));
    }
    if (Array.isArray(body.colors)) {
      body.colors = body.colors.filter(c => c && c.name && c.name.trim());
    }
    // Ensure stock values are numbers
    if (body.stock && typeof body.stock === 'object') {
      const cleanStock = {};
      for (const [size, qty] of Object.entries(body.stock)) {
        cleanStock[size] = Number(qty) || 0;
      }
      body.stock = cleanStock;
    }

    // Apply updates and save (to trigger pre-save hooks for slug/stock)
    Object.assign(product, body);
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `A product with this ${field} already exists`,
      });
    }
    next(error);
  }
};

/**
 * @desc    Soft-delete a product (admin) — set active=false
 * @route   DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update stock map for a product (admin)
 * @route   PUT /api/products/:id/stock
 */
const updateStock = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const { stock } = req.body;
    if (!stock || typeof stock !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Stock must be an object mapping size to quantity (e.g. { "S": 20, "M": 35 })',
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Update the stock map
    for (const [size, qty] of Object.entries(stock)) {
      product.stock.set(size, Number(qty));
    }

    await product.save(); // triggers totalStock recalculation in pre-save

    res.status(200).json({
      success: true,
      data: {
        stock: Object.fromEntries(product.stock),
        totalStock: product.totalStock,
      },
      message: 'Stock updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get categories (with product counts). Admin gets all; public gets active only.
 * @route   GET /api/products/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const isAdmin = req.query.admin === 'true';
    const filter = isAdmin ? {} : { active: true };

    const categories = await Category.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    // Count active retail products per category
    const counts = await Product.aggregate([
      { $match: { active: true, 'visibility.retail': true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => { if (c._id) countMap[c._id.toString()] = c.count; });

    const withCounts = categories.map((cat) => ({
      ...cat,
      productCount: countMap[cat._id.toString()] || 0,
    }));

    res.status(200).json({ success: true, data: withCounts });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a category (admin)
 * @route   PUT /api/products/categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, description, sortOrder, active } = req.body;

    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({ name: name.trim(), _id: { $ne: category._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A category with this name already exists' });
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description;
    if (sortOrder !== undefined) category.sortOrder = Number(sortOrder) || 0;
    if (active !== undefined) category.active = active === 'true' || active === true;

    // Cloudinary upload via multer
    if (req.file) {
      category.image = req.file.path;
    } else if (req.body.image !== undefined) {
      category.image = req.body.image;
    }

    await category.save();
    res.json({ success: true, data: category, message: 'Category updated' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a category (admin) — blocked if products are assigned
 * @route   DELETE /api/products/categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${productCount} product${productCount > 1 ? 's are' : ' is'} assigned to this category`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new category (admin)
 * @route   POST /api/categories
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, image, parent, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    // Check for duplicate name
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists',
      });
    }

    // Validate parent if provided
    if (parent) {
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid parent category ID',
        });
      }
      const parentCat = await Category.findById(parent);
      if (!parentCat) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found',
        });
      }
    }

    const category = await Category.create({
      name: name.trim(),
      description,
      image,
      parent: parent || null,
      sortOrder: sortOrder || 0,
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 */
const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      featured: true,
      active: true,
      'visibility.retail': true,
    })
      .limit(8)
      .sort({ createdAt: -1 })
      .populate('category', 'name slug')
      .lean();

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Full-text search products using MongoDB text index
 * @route   GET /api/products/search
 */
const searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const filter = {
      $text: { $search: q.trim() },
      active: true,
      'visibility.retail': true,
    };

    const [products, total] = await Promise.all([
      Product.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get related products (same category, excluding current product)
 * @route   GET /api/products/:id/related
 */
const getRelatedProducts = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const products = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      active: true,
      'visibility.retail': true,
    })
      .limit(4)
      .sort({ createdAt: -1 })
      .populate('category', 'name slug')
      .lean();

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Live autocomplete suggestions (regex, partial-word safe)
 * @route   GET /api/products/suggest?q=kurti&limit=8
 */
const suggestProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(q.trim(), 'i');

    const products = await Product.find({
      active: true,
      'visibility.retail': true,
      $or: [{ name: regex }, { tags: regex }, { subCategory: regex }],
    })
      .limit(8)
      .select('name slug images category subCategory')
      .populate('category', 'name slug')
      .lean();

    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getWholesaleProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getFeaturedProducts,
  searchProducts,
  suggestProducts,
  getRelatedProducts,
};
