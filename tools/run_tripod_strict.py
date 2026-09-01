#!/usr/bin/env python3
import numpy as np
import pandas as pd
import tripod_strict_model as m


def strict_returns_fixed(df):
    ri = df.adj_close.pct_change().fillna(0).to_numpy()
    rate = df.borrow_annual.ffill().to_numpy(float)
    bd = rate / 360
    q = ri - .002 / 252
    q2 = 2 * ri - .0095 / 252 - (bd + m.spread_daily(rate, 2))
    q3 = 3 * ri - .0088 / 252 - 2 * (bd + m.spread_daily(rate, 3))
    return pd.DataFrame({'qqq': q, 'qld': q2, 'tqqq': q3}, index=df.index).clip(lower=-.999999)


if __name__ == '__main__':
    m.strict_returns = strict_returns_fixed
    m.main()
