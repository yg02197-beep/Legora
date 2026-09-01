#!/usr/bin/env python3
from __future__ import annotations
import json, os
import numpy as np
import pandas as pd
import tripod_remote_validation as trv
from run_tripod_validation import load_fixed

OUT='tripod_baseline_results'; os.makedirs(OUT, exist_ok=True)


def rolling_windows(s: pd.Series, years: int) -> pd.DataFrame:
    s=s.dropna().sort_index()
    starts=s.resample('MS').first().dropna().index
    rows=[]
    for st in starts:
        target=st+pd.DateOffset(years=years)
        # first observation at/after month start; last observation at/before target
        a=s.loc[s.index>=st]
        if a.empty: continue
        start_dt=a.index[0]
        b=s.loc[(s.index>=start_dt)&(s.index<=target)]
        if b.empty or b.index[-1] < target-pd.Timedelta(days=10):
            continue
        mult=float(b.iloc[-1]/b.iloc[0])
        rows.append((start_dt,b.index[-1],mult,mult**(1/years)-1))
    return pd.DataFrame(rows,columns=['start','end','multiple','cagr'])


def transition_stats(gear: pd.Series):
    g=gear.dropna()
    changed=g.ne(g.shift()).fillna(False)
    change_dates=g.index[changed]
    # first portfolio establishment isn't a strategy transition
    transitions=max(0,len(change_dates)-1)
    years=(g.index[-1]-g.index[0]).days/365.2425
    counts=pd.Series(0,index=range(g.index[0].year,g.index[-1].year+1),dtype=int)
    if len(change_dates)>1:
        vc=pd.Series(1,index=change_dates[1:]).groupby(change_dates[1:].year).sum()
        for y,v in vc.items(): counts.loc[y]=int(v)
    gaps=pd.Series(change_dates[1:]).diff().dropna() if len(change_dates)>1 else pd.Series(dtype='timedelta64[ns]')
    return {
        'transitions':int(transitions),
        'avg_per_year':float(transitions/years) if years else None,
        'zero_transition_years':[int(y) for y in counts.index[counts.eq(0)]],
        'zero_transition_year_count':int(counts.eq(0).sum()),
        'max_days_between_changes':int(gaps.max().days) if len(gaps) else None,
        'max_years_between_changes':float(gaps.max().days/365.2425) if len(gaps) else None,
    }


def summarize_roll(w: pd.DataFrame):
    if w.empty: return None
    return {
        'n':int(len(w)),
        'min_multiple':float(w.multiple.min()),
        'p25_multiple':float(w.multiple.quantile(.25)),
        'median_multiple':float(w.multiple.median()),
        'mean_multiple':float(w.multiple.mean()),
        'max_multiple':float(w.multiple.max()),
        'loss_frequency':float((w.multiple<1).mean()),
        'median_cagr':float(w.cagr.median()),
        'mean_cagr':float(w.cagr.mean()),
    }


def main():
    trv.load=load_fixed
    df=load_fixed()
    g=trv.gears_for(df)
    rets=trv.synthetic_returns(df.ndx,.03)
    bt,tr=trv.simulate(g,rets,1)
    bt0,tr0=trv.simulate(g,rets,0)
    navs={k:(1+rets[k]).cumprod().loc[bt.index] for k in ['qqq','qld','tqqq']}
    out={
        'data':{'rows':int(len(df)),'start':str(df.index[0].date()),'end':str(df.index[-1].date())},
        'tripod':{'trades_simulate':int(tr),**trv.perf(bt.wealth)},
        'same_close':{'trades':int(tr0),**trv.perf(bt0.wealth)},
        'transition_stats':transition_stats(bt.gear),
        'gear_occupancy':{str(k):float(v) for k,v in bt.gear.value_counts(normalize=True).sort_index().items()},
    }
    for k,v in navs.items(): out[k]=trv.perf(v)
    for yrs in [7,10]:
        out[f'rolling_{yrs}y']={}
        for k,s in [('tripod',bt.wealth),*navs.items()]:
            rw=rolling_windows(s,yrs); rw.to_csv(f'{OUT}/{k}_{yrs}y_windows.csv',index=False)
            out[f'rolling_{yrs}y'][k]=summarize_roll(rw)
    out['stress']={}
    for label,a,b in [('dotcom','2000-03-24','2003-03-24'),('gfc','2007-10-31','2009-03-09'),('covid','2020-02-19','2020-03-23')]:
        out['stress'][label]={'tripod':trv.subperf(bt.wealth,a,b)}
        for k,s in navs.items(): out['stress'][label][k]=trv.subperf(s,a,b)
    eps=trv.episode_table(bt.gear,bt.wealth,navs['tqqq']); eps.to_csv(f'{OUT}/insurance_episodes.csv',index=False)
    out['insurance']={'episodes':int(len(eps)),'positive_alpha':int((eps.insurance_alpha>0).sum()),'negative_or_zero_alpha':int((eps.insurance_alpha<=0).sum()),'positive_fraction':float((eps.insurance_alpha>0).mean()) if len(eps) else None,'median_alpha':float(eps.insurance_alpha.median()) if len(eps) else None,'sum_alpha':float(eps.insurance_alpha.sum()) if len(eps) else None}
    try:
        ah,trh,qcmp,tcmp=trv.actual_hybrid(df,g)
        out['actual_hybrid']={'performance':ah,'trades':int(trh),'qld_tracking':qcmp,'tqqq_tracking':tcmp}
    except Exception as e:
        out['actual_hybrid_error']=repr(e)
    with open(f'{OUT}/summary.json','w') as f: json.dump(out,f,indent=2)
    print(json.dumps(out,indent=2))

if __name__=='__main__': main()
