# reagents/

The reagents of the group buffs: which spell needs one (read from its tooltip, so a client that dropped the cost never
nags), whether the bags hold it, and which are running low. `party-buffs.service.ts` asks it before suggesting a group
version; `town-visit.service.ts` asks it on arriving in a town.
