const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { cleanString } = require('../utils/sql');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { parseId } = require('../utils/ids');
const { normalizeStoreInput } = require('../utils/storeInput');
const { toAdminStoreRow, toAdminStoreDetails } = require('../utils/storeMapper');
const { BCRYPT_ROUNDS } = require('../constants/security');
const ROLES = require('../constants/roles');
const { STORE_CATEGORIES, STORE_STATUS } = require('../constants/storeCategories');
const userRepository = require('../repositories/userRepository');
const storeRepository = require('../repositories/storeRepository');
const analyticsRepository = require('../repositories/analyticsRepository');

const getDashboardTotals = () => analyticsRepository.getTotals();

// ---------- Add user (admin, normal user or store owner) ----------
const addUser = async ({ name, email, address, password, role }) => {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw AppError.conflict('Email is already registered', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // The admin vouches for these accounts, so they are active and verified immediately
  const id = await userRepository.create({
    name,
    email,
    address,
    passwordHash,
    role,
    emailVerifiedAt: new Date(),
  });

  return { id, name, email, address, role };
};

// ---------- Add store ----------
const addStore = async ({ name, email, address, ownerId, ...rest }) => {
  const profile = normalizeStoreInput(rest);
  const ownerUserId = Number(ownerId);

  const owner = await userRepository.findById(ownerUserId);
  if (!owner) {
    throw AppError.notFound('Owner user not found', 'OWNER_NOT_FOUND');
  }
  if (owner.role !== ROLES.OWNER) {
    throw AppError.badRequest('Selected user is not a Store Owner', 'NOT_AN_OWNER');
  }

  // Business rule: one owner, one store
  if ((await storeRepository.countByOwner(ownerUserId)) > 0) {
    throw AppError.conflict('This owner already has a store', 'OWNER_HAS_STORE');
  }

  const id = await storeRepository.create({ name, email, address, ownerId: ownerUserId, ...profile });
  return { id, name, email, address, ownerId: ownerUserId, status: STORE_STATUS.ACTIVE, ...profile };
};

// ---------- Edit store ----------
const updateStore = async (id, input) => {
  const storeId = parseId(id);
  if (!storeId) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  const existing = await storeRepository.findById(storeId);
  if (!existing) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }

  const profile = normalizeStoreInput(input);
  const status = input.status ? String(input.status).toUpperCase() : existing.status;
  if (!Object.values(STORE_STATUS).includes(status)) {
    throw AppError.badRequest('Invalid status', 'INVALID_STATUS');
  }

  await storeRepository.update(storeId, {
    name: input.name,
    email: input.email,
    address: input.address,
    ...profile,
    status,
  });

  return toAdminStoreDetails(await storeRepository.findDetailsById(storeId));
};

const getStoreDetails = async (id) => {
  const storeId = parseId(id);
  const row = storeId ? await storeRepository.findDetailsById(storeId) : null;
  if (!row) {
    throw AppError.notFound('Store not found', 'STORE_NOT_FOUND');
  }
  return toAdminStoreDetails(row);
};

// ---------- Lists (filter + sort) ----------
const listUsers = (query) => {
  const role = cleanString(query.role);
  if (role && !Object.values(ROLES).includes(role)) {
    throw AppError.badRequest('Invalid role filter', 'INVALID_ROLE_FILTER');
  }

  return userRepository.list({
    name: cleanString(query.name),
    email: cleanString(query.email),
    address: cleanString(query.address),
    role,
    sortBy: query.sortBy,
    order: query.order,
  });
};

const listStores = async (query) => {
  const { page, limit, offset } = parsePagination(query, { defaultLimit: 10 });

  const category = cleanString(query.category).toUpperCase();
  if (category && !STORE_CATEGORIES.includes(category)) {
    throw AppError.badRequest('Invalid category', 'INVALID_CATEGORY');
  }
  const status = cleanString(query.status).toUpperCase();
  if (status && !Object.values(STORE_STATUS).includes(status)) {
    throw AppError.badRequest('Invalid status', 'INVALID_STATUS');
  }

  const { rows, total } = await storeRepository.listForAdmin(
    {
      name: cleanString(query.name),
      email: cleanString(query.email),
      address: cleanString(query.address),
      city: cleanString(query.city),
      category,
      status,
    },
    { sortBy: query.sortBy, order: query.order, limit, offset }
  );

  return { items: rows.map(toAdminStoreRow), pagination: buildPagination(page, limit, total) };
};

// ---------- User details (owners also get their store's rating) ----------
const getUserDetails = async (id) => {
  const userId = parseId(id);
  if (!userId) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  const user = await userRepository.findPublicById(userId);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  if (user.role === ROLES.OWNER) {
    return { ...user, rating: await storeRepository.getAverageRatingForOwner(userId) };
  }
  return user;
};

module.exports = {
  getDashboardTotals,
  addUser,
  addStore,
  updateStore,
  getStoreDetails,
  listUsers,
  listStores,
  getUserDetails,
};