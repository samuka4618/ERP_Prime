import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { loginSchema, registerSchema, changePasswordSchema, updateProfileSchema } from '../schemas/auth';
import { config } from '../config/database';

const router = Router();

const microsoftCallbackLimiter = config.nodeEnv === 'production'
  ? rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Muitas tentativas. Tente novamente mais tarde.' })
  : (_req: any, _res: any, next: any) => next();

// Rotas públicas
router.get('/providers', AuthController.getProviders);
router.get('/microsoft', AuthController.redirectToMicrosoft);
router.get('/microsoft/callback', microsoftCallbackLimiter, AuthController.microsoftCallback);
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
