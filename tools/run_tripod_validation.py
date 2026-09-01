#!/usr/bin/env python3
from __future__ import annotations
import pandas as pd
import tripod_remote_validation as trv


def parse_ndx(path):
    raw = pd.read_csv(path, header=None, names=['date', 'ndx'], dtype=str)
    raw['date'] = pd.to_datetime(raw.date, errors='coerce', format='mixed')
    raw['ndx'] = pd.to_numeric(raw.ndx, errors='coerce')
    return raw.dropna().drop_duplicates('date').set_index('date').sort_index()[['ndx']]


def parse_vix(path):
    raw = pd.read_csv(path)
    if len(raw.columns) < 2:
        raise ValueError('VIX CSV needs at least two columns')
    raw = raw.iloc[:, :2].copy()
    raw.columns = ['date', 'vix']
    raw['date'] = pd.to_datetime(raw.date, errors='coerce', format='%Y-%m-%d')
    raw['vix'] = pd.to_numeric(raw.vix, errors='coerce')
    return raw.dropna().drop_duplicates('date').set_index('date').sort_index()[['vix']]


def load_fixed():
    ndx = parse_ndx(trv.dl('ndx'))
    vix = parse_vix(trv.dl('vix'))
    # Keep pre-1990 NDX history so SMA250/52-week-high are fully warmed up
    # when VIX becomes available in January 1990. Joining first with VIX would
    # incorrectly discard 1986-1989 NDX and delay the first signal by ~1 year.
    df = ndx.join(vix, how='left')
    df = df.loc['1986-01-01':'2025-12-31']
    if len(df) < 9500:
        raise RuntimeError(f'unexpectedly short NDX history: {len(df)} rows')
    vix_valid = df.vix.dropna()
    if vix_valid.empty or vix_valid.index[0].year != 1990 or vix_valid.index[-1].year < 2025:
        raise RuntimeError(f'unexpected VIX range: {vix_valid.index[0] if len(vix_valid) else None} to {vix_valid.index[-1] if len(vix_valid) else None}')
    return df


if __name__ == '__main__':
    trv.load = load_fixed
    trv.main()
