const { body } = require('express-validator');
const { STORE_CATEGORIES, STORE_STATUS } = require('../constants/storeCategories');

// Creating a store: category is optional (defaults to OTHER). Editing: it is required.
const categoryRule = (required) => {
  let chain = body('category');
  if (!required) chain = chain.optional({ values: 'falsy' });
  return chain
    .isIn(STORE_CATEGORIES)
    .withMessage(`Category must be one of: ${STORE_CATEGORIES.join(', ')}`);
};

const statusRule = body('status')
  .optional({ values: 'falsy' })
  .isIn(Object.values(STORE_STATUS))
  .withMessage('Status must be ACTIVE or INACTIVE');

// "optional" = empty or missing is fine, but if something is sent it must be valid
const optionalText = (field, label, max) =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .withMessage(`${label} must be text`)
    .bail()
    .trim()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

// Only http:// and https:// links. This blocks "javascript:..." links (XSS).
const optionalUrl = (field, label, max) =>
  optionalText(field, label, max)
    .bail()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${label} must be a valid link starting with http:// or https://`);

const phoneRule = body('phone')
  .optional({ values: 'falsy' })
  .isString()
  .withMessage('Phone must be text')
  .bail()
  .trim()
  .matches(/^[0-9+()\-\s]{7,20}$/)
  .withMessage('Phone must be 7 to 20 characters: digits, spaces, + ( ) -');

const pincodeRule = body('pincode')
  .optional({ values: 'falsy' })
  .isString()
  .withMessage('Pincode must be text')
  .bail()
  .trim()
  .matches(/^[A-Za-z0-9 -]{3,10}$/)
  .withMessage('Pincode must be 3 to 10 letters, digits, spaces or dashes');

// values: 'null' means 0 is a real value (the equator is latitude 0)
const latitudeRule = body('latitude')
  .optional({ values: 'null' })
  .isFloat({ min: -90, max: 90 })
  .withMessage('Latitude must be a number between -90 and 90')
  .toFloat();

const longitudeRule = body('longitude')
  .optional({ values: 'null' })
  .isFloat({ min: -180, max: 180 })
  .withMessage('Longitude must be a number between -180 and 180')
  .toFloat();

const timeRule = (field, label) =>
  body(field)
    .optional({ values: 'falsy' })
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage(`${label} must be in HH:MM format (24-hour)`);

const storeProfileRules = [
  optionalText('description', 'Description', 1000),
  phoneRule,
  optionalText('city', 'City', 100),
  optionalText('state', 'State', 100),
  pincodeRule,
  optionalUrl('website', 'Website', 255),
  optionalUrl('imageUrl', 'Image link', 500),
  latitudeRule,
  longitudeRule,
  timeRule('openingTime', 'Opening time'),
  timeRule('closingTime', 'Closing time'),
];

module.exports = { categoryRule, statusRule, storeProfileRules };