// One place for role names, so we never mistype 'OWNER' as 'OWNNER'
const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
  OWNER: 'OWNER',
});

module.exports = ROLES;