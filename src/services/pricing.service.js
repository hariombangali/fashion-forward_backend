/**
 * Pricing Service — Wholesale tier pricing calculator
 */

/**
 * Calculate item price based on user type and quantity.
 * For retail customers, returns the product's retailPrice.
 * For wholesalers, finds the applicable tier from product.wholesaleTiers.
 */
const calculateItemPrice = (product, quantity, userType) => {
  try {
    if (userType !== 'wholesaler') {
      return product.retailPrice;
    }

    // Wholesaler — find applicable tier
    if (!product.wholesaleTiers || product.wholesaleTiers.length === 0) {
      return product.retailPrice;
    }

    const sorted = [...product.wholesaleTiers].sort((a, b) => a.minQty - b.minQty);

    let applicableTier = null;
    for (const tier of sorted) {
      if (quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty)) {
        applicableTier = tier;
      }
    }

    // If quantity exceeds all tiers, use the highest tier
    if (!applicableTier && sorted.length > 0 && quantity >= sorted[sorted.length - 1].minQty) {
      applicableTier = sorted[sorted.length - 1];
    }

    return applicableTier ? applicableTier.pricePerPiece : product.retailPrice;
  } catch (error) {
    console.error('Error calculating item price:', error.message);
    return product.retailPrice;
  }
};

/**
 * Calculate shipping charge.
 * Retail: Rs 80 if subtotal < 999, else free.
 * Wholesale: always free.
 */
const calculateShipping = (subtotal, userType) => {
  try {
    if (userType === 'wholesaler') {
      return 0;
    }
    return subtotal < 999 ? 80 : 0;
  } catch (error) {
    console.error('Error calculating shipping:', error.message);
    return 0;
  }
};

/**
 * Validate Minimum Order Quantity for a product.
 * Returns { valid: boolean, moq: number }.
 */
const validateMOQ = (product, quantity) => {
  try {
    const moq = product.wholesaleMOQ || 1;
    return {
      valid: quantity >= moq,
      moq,
    };
  } catch (error) {
    console.error('Error validating MOQ:', error.message);
    return { valid: false, moq: product.wholesaleMOQ || 1 };
  }
};

module.exports = {
  calculateItemPrice,
  calculateShipping,
  validateMOQ,
};
