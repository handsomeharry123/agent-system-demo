import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  charset: 'utf8mb4',
  connectionLimit: 10,
  enableKeepAlive: true,
  timezone: '+08:00',
  dateStrings: true,
});

export const checkDatabase = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
};
