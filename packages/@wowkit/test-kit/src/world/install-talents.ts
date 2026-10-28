// The talents: Forever keeps the three classic trees side by side in one tree of the trait system. The fake game has one
// talent in each third of it, with the points the test spent in that tree.
import type { ClientState } from "./client-state";
import { defineNamespace } from "./define";

const CONFIG_ID = 1;
const TREE_ID = 1;
/** A talent of each tree, where it sits across the tree (the real one runs from about 1000 to 11000). */
const TALENT_POSITIONS = [1000, 5000, 9000];

export function installTalents(state: ClientState): void {
    defineNamespace<typeof C_ClassTalents>("C_ClassTalents", {
        GetActiveConfigID: () => CONFIG_ID,
    });
    defineNamespace<typeof C_Traits>("C_Traits", {
        GetConfigInfo: () => ({ ID: CONFIG_ID, treeIDs: [TREE_ID] }) as TraitConfigInfo,
        GetTreeNodes: () => [1, 2, 3],
        GetNodeInfo: (_configId, nodeId) =>
            ({ ID: nodeId, posX: TALENT_POSITIONS[nodeId - 1]!, currentRank: state.talentPoints[nodeId - 1] ?? 0 }) as TraitNodeInfo,
    });
}
