jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/storeRepository');

const userRepository = require('../src/repositories/userRepository');
const storeRepository = require('../src/repositories/storeRepository');
const adminService = require('../src/services/adminService');

beforeEach(() => jest.resetAllMocks());

const newUser = {
  name: 'Priya Patel Store Owner One',
  email: 'priya@example.com',
  address: '45 FC Road, Pune',
  password: 'Priya@1234',
  role: 'OWNER',
};

describe('adminService.addUser', () => {
  test('duplicate email gives 409 and saves nothing', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 1 });
    await expect(adminService.addUser(newUser)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_EXISTS',
    });
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  test('saves the requested role with a hashed password, and returns no password', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(3);

    const user = await adminService.addUser(newUser);

    const saved = userRepository.create.mock.calls[0][0];
    expect(saved.role).toBe('OWNER');
    expect(saved.passwordHash).not.toBe('Priya@1234');
    expect(saved.passwordHash.startsWith('$2')).toBe(true);
    expect(user).toEqual({
      id: 3,
      name: newUser.name,
      email: newUser.email,
      address: newUser.address,
      role: 'OWNER',
    });
  });
});

describe('adminService.addStore', () => {
  const input = {
    name: 'Fresh Mart Supermarket',
    email: 'freshmart@example.com',
    address: '78 Station Road, Pune',
    ownerId: '3',
  };

  test('owner that does not exist gives 404', async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(adminService.addStore(input)).rejects.toMatchObject({
      statusCode: 404,
      code: 'OWNER_NOT_FOUND',
    });
  });

  test('a normal user cannot be a store owner (400)', async () => {
    userRepository.findById.mockResolvedValue({ id: 3, role: 'USER' });
    await expect(adminService.addStore(input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'NOT_AN_OWNER',
    });
  });

  test('an owner who already has a store gives 409 OWNER_HAS_STORE', async () => {
    userRepository.findById.mockResolvedValue({ id: 3, role: 'OWNER' });
    storeRepository.countByOwner.mockResolvedValue(1);
    await expect(adminService.addStore(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'OWNER_HAS_STORE',
    });
    expect(storeRepository.create).not.toHaveBeenCalled();
  });

  test('success creates the store for the owner', async () => {
    userRepository.findById.mockResolvedValue({ id: 3, role: 'OWNER' });
    storeRepository.countByOwner.mockResolvedValue(0);
    storeRepository.create.mockResolvedValue(9);

    const store = await adminService.addStore(input);

    expect(storeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: input.name,
        email: input.email,
        address: input.address,
        ownerId: 3,
        category: 'OTHER', // the default
        description: null,
      })
    );
    expect(store).toMatchObject({ id: 9, ownerId: 3 });
  });
});

describe('adminService.listUsers', () => {
  test('invalid role filter gives 400', () => {
    expect(() => adminService.listUsers({ role: 'SUPERMAN' })).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'INVALID_ROLE_FILTER' })
    );
  });

  test('cleans the filters before they reach the database', async () => {
    userRepository.list.mockResolvedValue([]);

    await adminService.listUsers({
      name: '  Priya ',
      email: ['a', 'b'], // an array must be ignored
      role: 'OWNER',
      sortBy: 'email',
      order: 'desc',
    });

    expect(userRepository.list).toHaveBeenCalledWith({
      name: 'Priya',
      email: '',
      address: '',
      role: 'OWNER',
      sortBy: 'email',
      order: 'desc',
    });
  });
});

describe('adminService.getUserDetails', () => {
  test('an owner also gets the rating of their store', async () => {
    userRepository.findPublicById.mockResolvedValue({ id: 3, name: 'Priya', role: 'OWNER' });
    storeRepository.getAverageRatingForOwner.mockResolvedValue('4.5');

    const user = await adminService.getUserDetails('3');
    expect(user.rating).toBe('4.5');
  });

  test('an owner with no ratings has rating null', async () => {
    userRepository.findPublicById.mockResolvedValue({ id: 3, role: 'OWNER' });
    storeRepository.getAverageRatingForOwner.mockResolvedValue(null);

    expect((await adminService.getUserDetails(3)).rating).toBeNull();
  });

  test('a normal user has no rating field at all', async () => {
    userRepository.findPublicById.mockResolvedValue({ id: 2, role: 'USER' });

    const user = await adminService.getUserDetails(2);
    expect(user).not.toHaveProperty('rating');
    expect(storeRepository.getAverageRatingForOwner).not.toHaveBeenCalled();
  });

  test('missing user, or a non-numeric id, gives 404', async () => {
    userRepository.findPublicById.mockResolvedValue(null);
    await expect(adminService.getUserDetails(999)).rejects.toMatchObject({ statusCode: 404 });

    await expect(adminService.getUserDetails('abc')).rejects.toMatchObject({ statusCode: 404 });
    expect(userRepository.findPublicById).toHaveBeenCalledTimes(1); // 'abc' never reached the DB
  });
});