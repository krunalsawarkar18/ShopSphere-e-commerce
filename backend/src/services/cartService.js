function buildCartResponse(user) {
  const items = (user.cartItems || []).map((item) => {
    const product = item.product;
    const lineTotal = product.price * item.quantity;

    return {
      product: {
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        description: product.description,
        category: product.category,
        stock: product.stock
      },
      quantity: item.quantity,
      lineTotal
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = subtotal > 0 ? 0 : 0;

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee
  };
}

module.exports = { buildCartResponse };
