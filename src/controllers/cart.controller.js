const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Get user cart with populated product details
// @route   GET /api/cart
const getCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'cart.product',
      select: 'name slug images retailPrice retailMRP wholesaleTiers wholesaleMOQ sizes stock visibility active sku',
    });

    const cartItems = user.cart
      .filter(item => item.product && item.product.active)
      .map(item => {
        const p = item.product;
        let pricePerPiece = p.retailPrice;
        let tierLabel = '';

        if (req.user.role === 'wholesaler' && p.wholesaleTiers?.length > 0) {
          const wPrice = p.getWholesalePrice(item.quantity);
          if (wPrice) {
            pricePerPiece = wPrice;
            // Find tier label
            const tier = p.wholesaleTiers.find(
              t => item.quantity >= t.minQty && (!t.maxQty || item.quantity <= t.maxQty)
            );
            if (tier) tierLabel = `${tier.minQty}-${tier.maxQty || '∞'} pcs`;
          }
        }

        const sizeStock = p.stock?.get(item.size) || 0;

        return {
          _id: item._id,
          product: {
            _id: p._id,
            name: p.name,
            slug: p.slug,
            image: p.images?.[0] || '',
            sku: p.sku,
            retailPrice: p.retailPrice,
            retailMRP: p.retailMRP,
          },
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          pricePerPiece,
          subtotal: pricePerPiece * item.quantity,
          tierLabel,
          inStock: sizeStock >= item.quantity,
          availableStock: sizeStock,
        };
      });

    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const shippingCharge = req.user.role === 'wholesaler' ? 0 : (subtotal >= 999 ? 0 : 80);

    res.json({
      success: true,
      data: {
        items: cartItems,
        itemCount: cartItems.length,
        subtotal,
        shippingCharge,
        total: subtotal + shippingCharge,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
const addToCart = async (req, res, next) => {
  try {
    const { productId, size, color, quantity = 1 } = req.body;

    if (!productId || !size) {
      return res.status(400).json({ success: false, message: 'Product ID and size are required.' });
    }

    const product = await Product.findById(productId);
    if (!product || !product.active) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Check visibility
    if (req.user.role === 'customer' && !product.visibility.retail) {
      return res.status(404).json({ success: false, message: 'Product not available.' });
    }
    if (req.user.role === 'wholesaler' && !product.visibility.wholesale) {
      return res.status(404).json({ success: false, message: 'Product not available for wholesale.' });
    }

    // Check stock
    const sizeStock = product.stock?.get(size) || 0;
    if (sizeStock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${sizeStock} units available in size ${size}.` });
    }

    const user = await User.findById(req.user._id);

    // Check if already in cart (same product + size + color)
    const existingIndex = user.cart.findIndex(
      item => item.product.toString() === productId && item.size === size && item.color === (color || '')
    );

    if (existingIndex > -1) {
      user.cart[existingIndex].quantity += quantity;
    } else {
      user.cart.push({ product: productId, size, color: color || '', quantity });
    }

    await user.save();
    res.json({ success: true, message: 'Item added to cart.', data: { cartCount: user.cart.length } });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const user = await User.findById(req.user._id);
    const cartItem = user.cart.id(itemId);

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found.' });
    }

    // Check stock
    const product = await Product.findById(cartItem.product);
    const sizeStock = product?.stock?.get(cartItem.size) || 0;
    if (sizeStock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${sizeStock} units available.` });
    }

    cartItem.quantity = quantity;
    await user.save();

    res.json({ success: true, message: 'Cart updated.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
const removeFromCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.cart = user.cart.filter(item => item._id.toString() !== req.params.itemId);
    await user.save();
    res.json({ success: true, message: 'Item removed from cart.', data: { cartCount: user.cart.length } });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
const clearCart = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { cart: [] });
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle wishlist
// @route   POST /api/wishlist/:productId
const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user._id);

    const index = user.wishlist.indexOf(productId);
    if (index > -1) {
      user.wishlist.splice(index, 1);
      await user.save();
      res.json({ success: true, message: 'Removed from wishlist.', data: { wishlisted: false } });
    } else {
      user.wishlist.push(productId);
      await user.save();
      res.json({ success: true, message: 'Added to wishlist.', data: { wishlisted: true } });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get wishlist
// @route   GET /api/wishlist
const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist',
      select: 'name slug images retailPrice retailMRP sizes stock active',
      match: { active: true },
    });
    res.json({ success: true, data: user.wishlist.filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart,
  toggleWishlist, getWishlist,
};
