// The client's options (CVars), the talents, the stable, and the curves the client evaluates over hidden values.
import type { ClientState } from "./client-state";
import { defineNamespace, fake } from "./define";

/** A linear curve through its points, like the client's LuaCurveObject (its methods are called with the object: method syntax). */
function createCurve(): LuaCurveObject {
    const points: [x: number, y: number][] = [];
    return fake<LuaCurveObject>({
        SetType() {
            return undefined;
        },
        AddPoint(x: number, y: number) {
            points.push([x, y]);
            points.sort((a, b) => a[0] - b[0]);
        },
        Evaluate(x: number) {
            if (points.length === 0) return 0;
            if (x <= points[0]![0]) return points[0]![1];
            for (let i = 1; i < points.length; i++) {
                const [x1, y1] = points[i]!;
                const [x0, y0] = points[i - 1]!;
                if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
            }
            return points[points.length - 1]![1];
        },
    });
}

export function installCurves(state: ClientState): void {
    defineNamespace<typeof C_CurveUtil>("C_CurveUtil", { CreateCurve: createCurve });
    defineNamespace<typeof C_CVar>("C_CVar", { GetCVarBool: () => false });
    // No talents spent (a low level character): the role stays as picked
    defineNamespace<typeof C_SpecializationInfo>("C_SpecializationInfo", {
        GetSpecializationInfo: () => $multi(0, undefined, undefined, undefined, undefined, undefined, 0, undefined, 0, false),
    });
    // A hunter has a pet in stable slot 1 when the test gave one
    defineNamespace<typeof C_StableInfo>("C_StableInfo", {
        GetStablePetInfo: () => (state.pet !== undefined ? fake<PetInfo>({}) : undefined),
    });
}
