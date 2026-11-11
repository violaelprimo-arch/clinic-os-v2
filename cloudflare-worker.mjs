import openNextWorker, {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge
} from "./.open-next/worker.js";
import { handleScheduledEvent } from "./src/lib/server/scheduled-worker-handler.ts";
import { QueueRoomDO } from "./src/lib/server/queue-room-do.ts";
import { maybeHandleQueueWebSocketRequest } from "./src/lib/server/queue-ws-gateway.ts";
import { syncWorkerEnv } from "./src/lib/server/worker-env.ts";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge, QueueRoomDO };

export default {
  async fetch(request, env, ctx) {
    syncWorkerEnv(env);
    const wsResponse = await maybeHandleQueueWebSocketRequest(request, env);
    if (wsResponse) return wsResponse;
    return openNextWorker.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const taskPromise = handleScheduledEvent(event, env, ctx);
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(taskPromise);
    }
    return await taskPromise;
  }
};
