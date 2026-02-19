import { Router } from 'express';
import { AuthController } from './AuthController';
import { validate } from '../../shared/middleware/validation';
import { loginSchema, registerSchema, changePasswordSchema, resetPasswordSchema, updateProfileSchema } from './schemas';
import { authenticate } from './middleware';

const router = Router();

// Rotas públicas
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/register', validate(registerSchema), AuthController.register);

// Rotas que precisam de autenticação
router.use(authenticate);

router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);
router.get('/profile', AuthController.getProfile);
router.put('/profile', validate(updateProfileSchema), AuthController.updateProfile);
router.put('/change-password', validate(changePasswordSchema), AuthController.changePassword);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);

export default router;
