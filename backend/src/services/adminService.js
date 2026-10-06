const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { cleanString } = require('../utils/sql');
const { BCRYPT_ROUNDS } = require('../constants/security');
const ROLES = require('../constants/roles');
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
  const id = await userRepository.create({ name, email, address, passwordHash, role });

  return { id, name, email, address, role };
};

// ---------- Add store ----------
const addStore = async ({ name, email, address, ownerId }) => {
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

  const id = await storeRepository.create({ name, email, address, ownerId: ownerUserId });
  return { id, name, email, address, ownerId: ownerUserId };
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

const listStores = (query) =>
  storeRepository.listForAdmin({
    name: cleanString(query.name),
    email: cleanString(query.email),
    address: cleanString(query.address),
    sortBy: query.sortBy,
    order: query.order,
  });

// ---------- User details (owners also get their store's rating) ----------
const getUserDetails = async (id) => {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) {
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
  listUsers,
  listStores,
  getUserDetails,
};