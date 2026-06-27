import serverlessExpress from '@codegenie/serverless-express';
import app from '../src/server/index.js';

import { initPromise } from '../src/server/db.js';

let serverlessExpressInstance;

async function setup(event, context) {
  await initPromise;
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

export const handler = (event, context) => {
  if (serverlessExpressInstance) {
    return serverlessExpressInstance(event, context);
  }
  return setup(event, context);
};
