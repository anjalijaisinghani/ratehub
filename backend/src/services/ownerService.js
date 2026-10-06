const storeRepository = require('../repositories/storeRepository');
const ratingRepository = require('../repositories/ratingRepository');

// ownerId ALWAYS comes from the verified token, never from the URL or body.
// That is what stops one owner from viewing another owner's store.
const getDashboard = async (ownerId, query) => {
  const stores = await storeRepository.findWithStatsByOwner(ownerId);

  if (stores.length === 0) {
    return { stores: [], raters: [] };
  }

  const raters = await ratingRepository.findRatersByOwner(ownerId, query.sortBy, query.order);
  return { stores, raters };
};

module.exports = { getDashboard };