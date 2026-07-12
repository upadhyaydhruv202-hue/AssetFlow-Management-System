import { ApiError } from '../utils/apiResponse.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    next();
  };
};

export const ROLES = {
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
};

export const isAdmin = authorize(ROLES.ADMIN);

/** @deprecated Use isAdmin — former Asset Manager permissions now belong to Admin */
export const isAdminOrManager = isAdmin;

/** @deprecated Use isAdmin — former Department Head / Asset Manager permissions now belong to Admin */
export const isManagerOrHead = isAdmin;
