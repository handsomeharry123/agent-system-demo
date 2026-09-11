import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import permissionsRouter from './routes/permissions.js';
import agentAccessRouter from './routes/agent-access.js';
import auditOperationLogsRouter from './routes/audit-operation-logs.js';
import dictionariesRouter from './routes/dictionaries.js';
import modelsRouter from './routes/models.js';
import ledgerRouter from './routes/ledger.js';
import evaluationDatasetsRouter from './routes/evaluation-datasets.js';
import evaluationIndicatorsRouter from './routes/evaluation-indicators.js';
import { operationAuditMiddleware } from './operation-audit.js';

export const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: config.frontendOrigin, credentials: false }));
app.use(express.json({ limit: '32kb' }));
app.use(operationAuditMiddleware);

app.get('/api/health', (_req, res) => res.json({ code: 200, message: 'ok', data: { service: 'med-agent-platform-backend' } }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/agent-access', agentAccessRouter);
app.use('/api/audit/operation-logs', auditOperationLogsRouter);
app.use('/api/system-config/dictionaries', dictionariesRouter);
app.use('/api/system-config/models', modelsRouter);
app.use('/api/ledger', ledgerRouter);
app.use('/api/evaluation/datasets', evaluationDatasetsRouter);
app.use('/api/evaluation/indicators', evaluationIndicatorsRouter);
app.use((_req, res) => res.status(404).json({ code: 404, message: '接口不存在' }));

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  const uploadTooLarge = (error as { code?: string }).code === 'LIMIT_FILE_SIZE';
  const status = uploadTooLarge ? 400 : Number((error as { statusCode?: number }).statusCode) || 500;
  res.status(status).json({ code: status, message: uploadTooLarge ? '上传文件不能超过允许大小' : status === 500 ? '服务器内部错误' : error.message });
};
app.use(errorHandler);
