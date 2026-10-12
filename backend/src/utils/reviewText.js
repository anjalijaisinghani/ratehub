const AppError = require('./AppError');

const REVIEW_MIN = 10;
const REVIEW_MAX = 1000;
const REPLY_MIN = 5;
const REPLY_MAX = 1000;

// Control characters (except tab and line feed) have no place in a review or a reply
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Cleans text and checks its length. Returns the clean text, or throws a 400.
// HTML is NOT removed here: the text is stored as typed, and React escapes it when displaying.
const cleanText = (value, { min, max, message, code }) => {
  if (typeof value !== 'string') throw AppError.badRequest(message, code);

  const text = value
    .replace(/\r\n?/g, '\n')      // Windows / old-Mac line breaks -> \n
    .replace(CONTROL_CHARS, '')
    .replace(/\n{3,}/g, '\n\n')   // at most one blank line in a row
    .trim();

  // [...text] counts real characters: an emoji is 1 (text.length would say 2).
  // MySQL's CHAR_LENGTH counts the same way, so the app and the database agree.
  const length = [...text].length;
  if (length < min || length > max) throw AppError.badRequest(message, code);

  return text;
};

const normalizeReviewText = (value) =>
  cleanText(value, {
    min: REVIEW_MIN,
    max: REVIEW_MAX,
    message: `Review must be between ${REVIEW_MIN} and ${REVIEW_MAX} characters`,
    code: 'INVALID_REVIEW_TEXT',
  });

const normalizeReplyText = (value) =>
  cleanText(value, {
    min: REPLY_MIN,
    max: REPLY_MAX,
    message: `Reply must be between ${REPLY_MIN} and ${REPLY_MAX} characters`,
    code: 'INVALID_REPLY_TEXT',
  });

module.exports = {
  normalizeReviewText,
  normalizeReplyText,
  REVIEW_MIN,
  REVIEW_MAX,
  REPLY_MIN,
  REPLY_MAX,
};