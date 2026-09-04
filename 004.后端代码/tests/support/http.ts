import request from 'supertest';
import { app } from '../../src/app.js';

export const api = request(app);

export const withBearer = (token: string) => ({ Authorization: `Bearer ${token}` });
