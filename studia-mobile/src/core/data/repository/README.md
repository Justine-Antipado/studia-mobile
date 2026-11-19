# core data repository

Generic hooks every feature repository is read/written through: `use-query.ts` (`useQuery` —
cache-backed data/loading/error/refetch/mutate) and `use-mutation.ts` (`useMutation` — optimistic
update with rollback, cache invalidation on success). Feature code never calls `QueryCache`
directly outside these two hooks.
