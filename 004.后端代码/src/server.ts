import { app } from './app.js';
import { config } from './config.js';
import { checkDatabase } from './db.js';

await checkDatabase();
app.listen(config.port, () => {
  console.log(`后端服务已启动：http://localhost:${config.port}`);
});
