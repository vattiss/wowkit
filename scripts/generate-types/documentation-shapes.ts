// The shapes of Blizzard's API documentation tables (only the keys the generator uses).

export interface DocField {
    Name: string;
    Type: string;
    Nilable?: boolean;
    InnerType?: string;
    KeyType?: string;
    Mixin?: string;
    Default?: unknown;
    StrideIndex?: number;
    EnumValue?: number;
    Value?: unknown;
    Documentation?: string[];
}

export interface DocFunction {
    Name: string;
    Arguments?: DocField[];
    Returns?: DocField[];
    Documentation?: string[];
    HasRestrictions?: boolean;
    IsProtectedFunction?: boolean;
    MayReturnNothing?: boolean;
}

export interface DocEvent {
    Name: string;
    LiteralName: string;
    Payload?: DocField[];
    Documentation?: string[];
    SynchronousEvent?: boolean;
    UniqueEvent?: boolean;
}

export interface DocTable {
    Name: string;
    Type: string;
    Fields?: DocField[];
    Values?: DocField[];
    Arguments?: DocField[];
    Documentation?: string[];
}

export interface DocSystem {
    Name: string;
    Type: "System" | "ScriptObject";
    Namespace?: string;
    Environment?: string;
    Functions?: DocFunction[];
    Events?: DocEvent[];
    Tables?: DocTable[];
    Documentation?: string[];
}
