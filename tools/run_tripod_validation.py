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
    df = ndx.join(vix, how='inner').dropna()
    df = df.loc['1989-01-01':'2025-12-31']
    if len(df) < 8000:
        raise RuntimeError(f'unexpectedly short common NDX/VIX history: {len(df)} rows')
    if df.index[0].year > 1990 or df.index[-1].year < 2025:
        raise RuntimeError(f'unexpected history range: {df.index[0]} to {df.index[-1]}')
    return df


if __name__ == '__main__':
    trv.load = load_fixed
    trv.main()
