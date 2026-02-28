function resolveIdentifiers(payload) {
  if (payload.email) {
    return { email: payload.email };
  }
  if (payload.customer_id) {
    return { customer_id: String(payload.customer_id) };
  }
  if (payload.visitor_id) {
    return { visitor_id: payload.visitor_id };
  }
  if (payload.session_id) {
    return { session_id: payload.session_id };
  }
  return {};
}

function toBrevoEvent(payload, defaultCurrency) {
  const base = {
    shop: payload.shop,
    template: payload.template,
    funnel_step: payload.funnel_step,
    timestamp: payload.timestamp,
  };

  const eventData = { ...base };

  if (payload.page_title) eventData.page_title = payload.page_title;
  if (payload.page_path) eventData.page_path = payload.page_path;
  if (payload.section_id) eventData.section_id = payload.section_id;
  if (payload.product_id !== undefined)
    eventData.product_id = payload.product_id;
  if (payload.product_title) eventData.product_title = payload.product_title;
  if (payload.product_price !== undefined)
    eventData.product_price = payload.product_price;
  if (payload.cart_item_count !== undefined)
    eventData.cart_item_count = payload.cart_item_count;
  if (payload.cart_total !== undefined)
    eventData.cart_total = payload.cart_total;

  if (
    payload.event === "view_item" ||
    payload.event === "view_cart" ||
    payload.event === "begin_checkout"
  ) {
    eventData.currency = payload.currency || defaultCurrency;
  }

  return {
    eventName: payload.event,
    identifiers: resolveIdentifiers(payload),
    eventData,
  };
}

module.exports = { toBrevoEvent };
