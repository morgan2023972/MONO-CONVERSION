const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const schema = {
  type: "object",
  required: ["event", "shop", "template", "timestamp", "funnel_step"],
  properties: {
    event: {
      type: "string",
      enum: [
        "funnel_page_view",
        "landing_view",
        "view_item",
        "add_to_cart",
        "view_cart",
        "begin_checkout",
      ],
    },
    shop: { type: "string", minLength: 3 },
    template: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    funnel_step: {
      type: "string",
      enum: ["landing", "product", "cart", "checkout"],
    },
    session_id: { type: "string", maxLength: 128 },
    visitor_id: { type: "string", maxLength: 128 },
    page_title: { type: "string", maxLength: 300 },
    page_path: { type: "string", maxLength: 500 },
    section_id: { type: "string", maxLength: 128 },
    product_id: { anyOf: [{ type: "integer" }, { type: "string" }] },
    product_title: { type: "string", maxLength: 500 },
    product_price: { type: "number", minimum: 0 },
    cart_item_count: { type: "integer", minimum: 0 },
    cart_total: { type: "number", minimum: 0 },
    consent_analytics: { type: "boolean" },
  },
  additionalProperties: true,
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function validateEvent(payload) {
  const ok = validate(payload);
  if (ok) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors || []).map((error) => {
    const path = error.instancePath || error.schemaPath;
    return `${path} ${error.message}`;
  });

  return { valid: false, errors };
}

module.exports = { validateEvent };
