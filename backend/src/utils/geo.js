const AppError = require('./AppError');
const { cleanString } = require('./sql');

const EARTH_RADIUS_KM = 6371;
const MAX_RADIUS_KM = 100;
const BOX_PADDING_DEG = 0.0001; // about 11 m of safety margin against rounding errors

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

const FULL_LONGITUDE = [[-180, 180]];

// A rectangle (in degrees) that is guaranteed to CONTAIN the whole circle of radiusKm around
// the point. It is only a cheap first filter. The exact distance check comes afterwards.
// lngRanges has 1 range normally, 2 when the circle crosses the date line (longitude +-180),
// and covers everything when the circle reaches a pole.
const boundingBox = (lat, lng, radiusKm) => {
  const angular = radiusKm / EARTH_RADIUS_KM; // radius as an angle, in radians
  const latRad = toRad(lat);

  const minLat = Math.max(-90, toDeg(latRad - angular) - BOX_PADDING_DEG);
  const maxLat = Math.min(90, toDeg(latRad + angular) + BOX_PADDING_DEG);

  // The circle reaches a pole: every longitude is possible
  if (latRad + angular >= Math.PI / 2 || latRad - angular <= -Math.PI / 2) {
    return { minLat, maxLat, lngRanges: FULL_LONGITUDE };
  }

  // The exact half-width in longitude. (The popular shortcut "d / cos(lat)" is slightly too small.)
  const lngDelta = toDeg(Math.asin(Math.sin(angular) / Math.cos(latRad))) + BOX_PADDING_DEG;
  if (lngDelta >= 180) return { minLat, maxLat, lngRanges: FULL_LONGITUDE };

  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  // Crossing the date line: split into two ranges
  if (minLng < -180) return { minLat, maxLat, lngRanges: [[minLng + 360, 180], [-180, maxLng]] };
  if (maxLng > 180) return { minLat, maxLat, lngRanges: [[minLng, 180], [-180, maxLng - 360]] };
  return { minLat, maxLat, lngRanges: [[minLng, maxLng]] };
};

// Plain decimal numbers only. Number() would also accept "1e2", "0x10" and similar surprises.
const COORD = /^-?\d{1,3}(\.\d+)?$/;
const RADIUS = /^\d+(\.\d+)?$/;

// Reads ?lat=&lng=&radius= from a request. Returns null when no location was sent.
//   required        : the endpoint needs a location (the /nearby endpoint)
//   defaultRadiusKm : used when no radius is sent (null = no radius limit)
const parseLocation = (query, { required = false, defaultRadiusKm = null } = {}) => {
  const latText = cleanString(query.lat);
  const lngText = cleanString(query.lng);
  const radiusText = cleanString(query.radius);

  if (!latText && !lngText) {
    if (required) throw AppError.badRequest('lat and lng are required', 'LOCATION_REQUIRED');
    return null; // a radius without a location is simply ignored
  }
  if (!latText || !lngText) {
    throw AppError.badRequest('Provide both lat and lng', 'INVALID_LOCATION');
  }
  if (!COORD.test(latText) || !COORD.test(lngText)) {
    throw AppError.badRequest('lat and lng must be plain numbers', 'INVALID_LOCATION');
  }

  const lat = Number(latText);
  const lng = Number(lngText);
  if (lat < -90 || lat > 90) {
    throw AppError.badRequest('lat must be between -90 and 90', 'INVALID_LOCATION');
  }
  if (lng < -180 || lng > 180) {
    throw AppError.badRequest('lng must be between -180 and 180', 'INVALID_LOCATION');
  }

  let radiusKm = defaultRadiusKm;
  if (radiusText) {
    const r = RADIUS.test(radiusText) ? Number(radiusText) : NaN;
    if (!(r > 0 && r <= MAX_RADIUS_KM)) {
      throw AppError.badRequest(
        `radius must be more than 0 and at most ${MAX_RADIUS_KM} (kilometres)`,
        'INVALID_RADIUS'
      );
    }
    radiusKm = r;
  }

  return { lat, lng, radiusKm };
};

module.exports = { boundingBox, parseLocation, MAX_RADIUS_KM };