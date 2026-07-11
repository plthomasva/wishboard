import serverlessExpress from '@codegenie/serverless-express';
import app from '../src/server/index.js';
import { flushBroadcasts } from '../src/server/socket.js';

let serverlessExpressInstance;

async function setup(event, context) {
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

export const handler = async (event, context) => {
  const result = serverlessExpressInstance
    ? await serverlessExpressInstance(event, context)
    : await setup(event, context);

  // Express has sent the response, but real-time broadcasts (wish:created,
  // sys:log, …) are fired without await inside the route handlers. Await them
  // here so the Lambda doesn't freeze mid-broadcast and drop them. Each
  // PostToConnection is capped at 3s in socket.js, bounding the tail latency.
  await flushBroadcasts();

  return result;
};
