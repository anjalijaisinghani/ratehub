const AppError = require('./AppError');

const REVIEW_MIN = 10;
const REVIEW_MAX = 1000;

// Control characters (except tab and line feed) have no place in a review
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Cleans a review and checks its length. Returns the clean text, or throws a 400.
// HTML is NOT removed here: the text is stored as typed, and React escapes it when displaying.
const normalizeReviewText = (value) => {
  const invalid = () =>
    AppError.badRequest(
      `Review must be between ${REVIEW_MIN} and ${REVIEW_MAX} characters`,
      'INVALID_REVIEW_TEXT'
    );

  if (typeof value !== 'string') throw invalid();

  const text = value
    .replace(/\r\n?/g, '\n')      // Windows / old-Mac line breaks -> \n
    .replace(CONTROL_CHARS, '')
    .replace(/\n{3,}/g, '\n\n')   // at most one blank line in a row
    .trim();

  // [...text] counts real characters: an emoji is 1 (text.length would say 2).
  // MySQL's CHAR_LENGTH counts the same way, so the app and the database agree.
  const length = [...text].length;
  if (length < REVIEW_MIN || length > REVIEW_MAX) throw invalid();

  return text;
};

module.exports = { normalizeReviewText, REVIEW_MIN, REVIEW_MAX };