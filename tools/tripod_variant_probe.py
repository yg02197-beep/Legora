#!/usr/bin/env python3
from __future__ import annotations
import json, os
from itertools import product
import numpy as np
import pandas as pd
import tripod_remote_validation as trv
from run_tripod_validation import load_fixed

OUT='tripod_variant_results'; os.makedirs(OUT,exist_ok=True)

def gears(df,high_days=252):
    ma=df.ndx.rolling(250,min_periods=250).mean()
    high=df.ndx.rolling(high_days,min_periods=high_days).max()
    dd=df.ndx/high-1
    v10=df.vix.rolling(10,min_periods=10).mean()
    rel=(df.ndx/ma-1).to_numpy(); dd=dd.to_numpy(); v10=v10.to_numpy()
    state=np.full(len(df),np.nan); prev=np.nan
    for i in range(len(df)):
        if not np.isfinite(rel[i]): continue
        if rel[i]>.01: prev=1.
        elif rel[i]<-.05: prev=0.
        elif not np.isfinite(prev): prev=1. if rel[i]>=0 else 0.
        state[i]=prev
    g=np.full(len(df),np.nan)
    for i in range(len(df)):
        if not (np.isfinite(state[i]) and np.isfinite(dd[i]) and np.isfinite(v10[i])): continue
        if state[i]==1: g[i]=3. if (v10[i]<28 and dd[i]>=-.09) else 1.5
        else: g[i]=1.5 if v10[i]<18 else 0.
    return pd.Series(g,index=df.index)

def simulate(g,rets,lag=1,daily15=False,cash_yield=.0):
    d=g.shift(lag); idx=rets.index.intersection(d.dropna().index)
    h=np.array([1.,0.,0.,0.]); prev=np.nan; rows=[]
    cash_daily=cash_yield/252
    for j,dt in enumerate(idx):
        if j:
            h[0]*=(1+cash_daily)
            rr=rets.loc[dt,['qqq','qld','tqqq']].to_numpy(float)
            h[1:]*=(1+rr)
        gg=float(d.loc[dt]); w=h.sum()
        do=(not np.isfinite(prev)) or gg!=prev or (daily15 and gg==1.5)
        if do:
            if gg==3: h=np.array([0.,0.,0.,w])
            elif gg==1.5: h=np.array([0.,.5*w,.5*w,0.])
            else: h=np.array([w,0.,0.,0.])
            prev=gg
        rows.append((dt,h.sum(),gg))
    return pd.DataFrame(rows,columns=['date','wealth','gear']).set_index('date')

def mult_between(s,a,b):
    z=s.loc[a:b]
    return float(z.iloc[-1]/z.iloc[0]) if len(z)>1 else None

def main():
    df=load_fixed(); rows=[]
    targets=[('mar10','2000-03-10','2003-03-10'),('mar24','2000-03-24','2003-03-24'),('mar27','2000-03-27','2003-03-27')]
    for high_days,funding,cash,lag,daily15 in product([252,260],[0.,.03,.05],[0.,.03,.05],[0,1],[False,True]):
        g=gears(df,high_days); r=trv.synthetic_returns(df.ndx,funding); bt=simulate(g,r,lag,daily15,cash)
        p=trv.perf(bt.wealth)
        row={'high_days':high_days,'funding':funding,'cash_yield':cash,'lag':lag,'daily15':daily15,'CAGR':p['CAGR'],'MDD':p['MDD']}
        for label,a,b in targets: row[f'dotcom_{label}']=mult_between(bt.wealth,a,b)
        rows.append(row)
    out=pd.DataFrame(rows)
    out['distance_6437']=(out.dotcom_mar24-.6437).abs()
    out=out.sort_values('distance_6437')
    out.to_csv(f'{OUT}/variants.csv',index=False)
    print(out.head(20).to_string(index=False))
    with open(f'{OUT}/top20.json','w') as f: json.dump(out.head(20).to_dict(orient='records'),f,indent=2)

if __name__=='__main__': main()
