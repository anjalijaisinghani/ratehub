const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../src/repositories/userRepository'); // replace the real DB code with fakes

const userRepository = require('../src/repositories/userRepository');
const authService = require('../src/services/authService');

const signupInput = {
  name: 'Rahul Sharma Test User One',
  email: 'rahul@example.com',
  address: '12 MG Road, Pune',
  password: 'Rahul@1234',
};

beforeEach(() => jest.resetAllMocks());

describe('authService.signup', () => {
  test('creates a USER and stores a hashed password', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(7);

    const user = await authService.signup(signupInput);

    expect(user).toEqual({
      id: 7,
      name: signupInput.name,
      email: signupInput.email,
      address: signupInput.address,
      role: 'USER',
    });
    const saved = userRepository.create.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe(signupInput.password);
    expect(saved.passwordHash.startsWith('$2')).toBe(true); // a bcrypt hash
  });

  test('ignores a role sent by the client (no privilege escalation)', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(8);

    await authService.signup({ ...signupInput, role: 'ADMIN' });

    expect(userRepository.create.mock.calls[0][0].role).toBe('USER');
  });

  test('rejects a duplicate email with 409 EMAIL_EXISTS', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 1 });

    await expect(authService.signup(signupInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_EXISTS',
    });
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});

describe('authService.login', () => {
  const makeUser = async () => ({
    id: 2,
    name: signupInput.name,
    email: signupInput.email,
    address: signupInput.address,
    role: 'USER',
    password_hash: await bcrypt.hash('Rahul@1234', 4), // low cost = faster tests
  });

  test('returns a valid token and a user WITHOUT the password hash', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser());

    const result = await authService.login({ email: 'rahul@example.com', password: 'Rahul@1234' });

    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ id: 2, role: 'USER' });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user.email).toBe('rahul@example.com');
  });

  test('unknown email gives 401 INVALID_CREDENTIALS', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@example.com', password: 'Whatever@1' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  test('wrong password gives the SAME error as an unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(await makeUser());

    await expect(
      authService.login({ email: 'rahul@example.com', password: 'Wrong@1234' })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });
});

describe('authService.changePassword', () => {
  test('wrong current password is rejected and nothing is saved', async () => {
    userRepository.findById.mockResolvedValue({
      id: 2,
      password_hash: await bcrypt.hash('Rahul@1234', 4),
    });

    await expect(
      authService.changePassword(2, { currentPassword: 'Wrong@1234', newPassword: 'Rahul@5678' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'WRONG_CURRENT_PASSWORD' });
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  test('correct current password saves a NEW hash', async () => {
    userRepository.findById.mockResolvedValue({
      id: 2,
      password_hash: await bcrypt.hash('Rahul@1234', 4),
    });

    await authService.changePassword(2, { currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' });

    const [id, newHash] = userRepository.updatePassword.mock.calls[0];
    expect(id).toBe(2);
    expect(await bcrypt.compare('Rahul@5678', newHash)).toBe(true);
  });

  test('missing user gives 404 USER_NOT_FOUND', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      authService.changePassword(99, { currentPassword: 'Rahul@1234', newPassword: 'Rahul@5678' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });
});