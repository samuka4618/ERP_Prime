import { Router } from 'express';
import { AuthController } from './AuthController';
import { validate } from '../../shared/middleware/validation';
import { loginSchema, registerSchema, changePasswordSchema, resetPasswordSchema, updateProfileSchema } from './schemas';
import { authenticate } from './middleware';

const router = Router();

// Rotas públicas
router.get('/registration-open', AuthController.registrationOpen);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);

// Rotas que precisam de autenticação
router.use(authenticate);

router.get('/profile', AuthController.getProfile);
router.get('/me/preferences', AuthController.getMyPreferences);
router.put('/me/preferences', AuthController.updateMyPreferences);
router.put('/profile', validate(updateProfileSchema), AuthController.updateProfile);
router.put('/change-password', validate(changePasswordSchema), AuthController.changePassword);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);
router.get('/sessions', AuthController.listSessions);
router.delete('/sessions/:sessionId', AuthController.revokeSession);
router.delete('/sessions', AuthController.revokeOtherSessions);

export default router;
