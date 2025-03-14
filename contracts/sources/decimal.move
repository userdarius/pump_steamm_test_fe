module pump_steamm::decimal;

public struct Decimal has copy, drop, store {
    value: u256,
}

public fun add(arg0: Decimal, arg1: Decimal) : Decimal {
    Decimal{value: arg0.value + arg1.value}
}

public fun ceil(arg0: Decimal) : u64 {
    ((arg0.value + 1000000000000000000 - 1) / 1000000000000000000) as u64
}

public fun div(arg0: Decimal, arg1: Decimal) : Decimal {
    Decimal{value: arg0.value * 1000000000000000000 / arg1.value}
}

public fun eq(arg0: Decimal, arg1: Decimal) : bool {
    arg0.value == arg1.value
}

public fun floor(arg0: Decimal) : u64 {
    (arg0.value / 1000000000000000000) as u64
}

public fun from(arg0: u64) : Decimal {
    Decimal{value: (arg0 as u256) * 1000000000000000000}
}

public fun from_bps(arg0: u64) : Decimal {
    Decimal{value: (arg0 as u256) * 1000000000000000000 / 10000}
}

public fun from_percent(arg0: u8) : Decimal {
    Decimal{value: (arg0 as u256) * 1000000000000000000 / 100}
}

public fun from_percent_u64(arg0: u64) : Decimal {
    Decimal{value: (arg0 as u256) * 1000000000000000000 / 100}
}

public fun from_scaled_val(arg0: u256) : Decimal {
    Decimal{value: arg0}
}

public fun ge(arg0: Decimal, arg1: Decimal) : bool {
    arg0.value >= arg1.value
}

public fun gt(arg0: Decimal, arg1: Decimal) : bool {
    arg0.value > arg1.value
}

public fun le(arg0: Decimal, arg1: Decimal) : bool {
    arg0.value <= arg1.value
}

public fun lt(arg0: Decimal, arg1: Decimal) : bool {
    arg0.value < arg1.value
}

public fun max(arg0: Decimal, arg1: Decimal) : Decimal {
    if (arg0.value > arg1.value) {
        arg0
    } else {
        arg1
    }
}

public fun min(arg0: Decimal, arg1: Decimal) : Decimal {
    if (arg0.value < arg1.value) {
        arg0
    } else {
        arg1
    }
}

public fun mul(arg0: Decimal, arg1: Decimal) : Decimal {
    Decimal{value: arg0.value * arg1.value / 1000000000000000000}
}

public fun pow(arg0: Decimal, mut arg1: u64) : Decimal {
    let mut v0 = arg0;
    let mut v1 = from(1);
    while (arg1 > 0) {
        if (arg1 % 2 == 1) {
            v1 = mul(v1, v0);
        };
        v0 = mul(v0, v0);
        arg1 = arg1 / 2;
    };
    v1
}

public fun saturating_floor(arg0: Decimal) : u64 {
    if (arg0.value > 18446744073709551615 * 1000000000000000000) {
        18446744073709551615 as u64
    } else {
        floor(arg0)
    }
}

public fun saturating_sub(arg0: Decimal, arg1: Decimal) : Decimal {
    if (arg0.value < arg1.value) {
        Decimal{value: 0}
    } else {
        Decimal{value: arg0.value - arg1.value}
    }
}

public fun sub(arg0: Decimal, arg1: Decimal) : Decimal {
    Decimal{value: arg0.value - arg1.value}
}

public fun to_scaled_val(arg0: Decimal) : u256 {
    arg0.value
}



