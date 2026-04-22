import Joi from 'joi';
import { UserRole } from '../../shared/types';

export const loginSchema = Joi.object({
  email: Joi.string().email().required().trim(),
  password: Joi.string().min(6).required().trim(),
  rememberMe: Joi.boolean().optional().default(false),
  forceDisconnectOthers: Joi.boolean().optional().default(false)
});

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'attendant', 'admin').default('user')
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  email: Joi.string().email().optional(),
  currentPassword: Joi.string().optional(),
  newPassword: Joi.string().min(6).optional()
}).or('name', 'email', 'newPassword');

const gridLayoutItem = Joi.object({
  i: Joi.string().max(64).required(),
  x: Joi.number().integer().min(0).max(48).required(),
  y: Joi.number().integer().min(0).max(800).required(),
  w: Joi.number().integer().min(1).max(24).required(),
  h: Joi.number().integer().min(1).max(48).required(),
  minW: Joi.number().integer().min(1).optional(),
  minH: Joi.number().integer().min(1).optional(),
  static: Joi.boolean().optional(),
}).unknown(true);

export const updateUiPreferencesSchema = Joi.object({
  version: Joi.number().valid(1).optional(),
  sidebar: Joi.object({
    hiddenIds: Joi.array().items(Joi.string().max(128)).max(200).optional(),
    favorites: Joi.array().items(Joi.string().max(128)).max(80).optional(),
    sectionOrder: Joi.array().items(Joi.string().max(64)).max(24).optional(),
  }).optional(),
  dashboard: Joi.object({
    version: Joi.number().valid(1).optional(),
    layouts: Joi.object()
      .pattern(
        Joi.string().valid('lg', 'md', 'sm', 'xs', 'xxs'),
        Joi.array().items(gridLayoutItem).max(48)
      )
      .optional(),
  }).optional(),
})
  .min(1)
  .messages({ 'object.min': 'Corpo vazio: envie pelo menos um campo para atualizar.' });
