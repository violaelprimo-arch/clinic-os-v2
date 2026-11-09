// Framework server-only marker for the standalone scheduled Worker bundle.
if (typeof window !== 'undefined') throw new Error('SERVER_ONLY_MODULE')
export {}
