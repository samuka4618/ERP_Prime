import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { loginSchema, registerSchema, changePasswordSchema, updateProfileSchema } from '../schemas/auth';

const router = Router();

// Rotas públicas
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/reset-password', AuthController.resetPassword);

// Rotas protegidas
router.use(authenticate);

router.post('/logout', AuthController.logout);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/change-password', validate(changePasswordSchema), AuthController.changePassword);
router.get('/profile', AuthController.getProfile);
router.put('/profile', validate(updateProfileSchema), AuthController.updateProfile);

export default router;
