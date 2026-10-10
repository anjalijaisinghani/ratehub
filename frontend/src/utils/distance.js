// 0.4 km -> "400 m", 1.234 -> "1.2 km", 12.5 -> "12.5 km", 120 -> "120 km"
export const formatDistance = (km) => {
  if (km === null || km === undefined) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

// About 100 m precision: plenty for "near me", and we send less exact data than we could
export const roundCoord = (n) => Math.round(n * 1000) / 1000;