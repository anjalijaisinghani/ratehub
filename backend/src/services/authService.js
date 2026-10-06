const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const ROLES = require('../constants/roles');

const { BCRYPT_ROUNDS } = require('../constants/security');

// Used when the email doesn't exist, so "unknown email" takes as long as
// "wrong password". This stops attackers from discovering which emails exist by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

// Never send password_hash to the outside world
const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  address: user.address,
  role: user.role,
});

const createToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

// ---------- Signup (normal users only) ----------
const signup = async ({ name, email, address, password }) => {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw AppError.conflict('Email is already registered', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // The role is ALWAYS USER here. Whatever the client sends is ignored.
  const id = await userRepository.create({
    name,
    email,
    address,
    passwordHash,
    role: ROLES.USER,
  });

  return toPublicUser({ id, name, email, address, role: ROLES.USER });
};

// ---------- Login (all roles) ----------
const login = async ({ email, password }) => {
  const user = await userRepository.findByEmail(email);

  const isMatch = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  // Same error for "no such email" and "wrong password"
  if (!user || !isMatch) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return { token: createToken(user), user: toPublicUser(user) };
};

// ---------- Change password (any logged-in user) ----------
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_CURRENT_PASSWORD');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePassword(userId, newHash);
};

module.exports = { signup, login, changePassword };