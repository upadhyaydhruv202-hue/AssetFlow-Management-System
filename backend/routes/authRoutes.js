import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import * as securityController from '../controllers/securityController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../utils/validators.js';

const router = Router();

router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  validate,
], authController.signup);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
], authController.login);

router.get('/google/config', authController.googleConfig);
router.post('/google', [body('credential').notEmpty(), validate], authController.googleLogin);

router.post('/mfa/verify', [
  body('userId').notEmpty(),
  body('code').notEmpty(),
  validate,
], securityController.verifyMfa);

router.post('/magic-link/request', [body('email').isEmail(), validate], securityController.requestMagicLink);
router.post('/magic-link/verify', [body('token').notEmpty(), validate], securityController.magicLinkLogin);
router.post('/passkey/authenticate/options', [body('email').isEmail().normalizeEmail(), validate], securityController.getPasskeyAuthenticationOptions);
router.post('/passkey/authenticate/verify', securityController.verifyPasskeyAuthentication);

router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', [body('email').isEmail(), validate], authController.forgotPassword);
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),
  validate,
], authController.resetPassword);

router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

router.get('/devices', authenticate, securityController.getTrustedDevices);
router.delete('/devices/:id', authenticate, securityController.revokeTrustedDevice);
router.get('/security-events', authenticate, securityController.getSecurityEvents);
router.get('/passkeys', authenticate, securityController.getPasskeys);
router.post('/passkey/register/options', authenticate, securityController.getPasskeyRegistrationOptions);
router.post('/passkey/register/verify', authenticate, securityController.verifyPasskeyRegistration);
router.delete('/passkey/:id', authenticate, securityController.deletePasskeyHandler);

export default router;
