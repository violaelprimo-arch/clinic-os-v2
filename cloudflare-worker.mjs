import openNextWorker, {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge
} from "./.open-next/worker.js";
import { handleScheduledEvent } from "./src/lib/server/scheduled-worker-handler.ts";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

export default {
  async fetch(request, env, ctx) {
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
