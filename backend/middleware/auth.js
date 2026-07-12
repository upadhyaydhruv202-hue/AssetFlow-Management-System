import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { ApiError } from '../utils/apiResponse.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Access token required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, deletedAt: null, status: 'ACTIVE' },
      include: {
        employee: {
          include: { department: true },
        },
      },
    });

    if (!user) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    req.user = user;
    req.employee = user.employee;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }
    await authenticate(req, res, next);
  } catch {
    next();
  }
};
