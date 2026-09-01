#!/usr/bin/env python3
from __future__ import annotations
import json, math, os, urllib.request
from itertools import product
import numpy as np, pandas as pd

OUT='tripod_results'; os.makedirs(OUT, exist_ok=True)
URLS={
 'ndx':'https://raw.githubusercontent.com/Zankooo/Leverage-Etfs/main/backend/podatki/nasdaq100.csv',
 'vix':'https://raw.githubusercontent.com/chaltik/market_data/main/VIXCLS.csv',
 'qld':'https://raw.githubusercontent.com/ravelab/l-etf/main/data/etf-qld.csv',
 'tqqq':'https://raw.githubusercontent.com/ravelab/l-etf/main/data/etf-tqqq.csv',
}

def dl(k):
 p=f'{OUT}/{k}.csv'; urllib.request.urlretrieve(URLS[k],p); return p

def load():
 ndx=pd.read_csv(dl('ndx'),header=None,names=['date','ndx']); ndx['date']=pd.to_datetime(ndx.date); ndx.ndx=pd.to_numeric(ndx.ndx,errors='coerce'); ndx=ndx.dropna().drop_duplicates('date').set_index('date').sort_index()
 vix=pd.read_csv(dl('vix')); vix.columns=['date','vix']; vix['date']=pd.to_datetime(vix.date); vix.vix=pd.to_numeric(vix.vix,errors='coerce'); vix=vix.dropna().drop_duplicates('date').set_index('date').sort_index()
 df=ndx.join(vix,how='inner').dropna(); df=df.loc['1989-01-01':'2025-12-31']
 return df

def indicators(df,ma_days=250,high_days=252):
 return (df.ndx.rolling(ma_days,min_periods=ma_days).mean(), df.ndx/df.ndx.rolling(high_days,min_periods=high_days).max()-1, df.vix.rolling(10,min_periods=10).mean())

def gears_for(df, ma_days=250, up=.01, down=-.05, vu=28., ddu=-.09, vd=18.):
 ma,dd,v10=indicators(df,ma_days)
 rel=(df.ndx/ma-1).to_numpy(); dd=dd.to_numpy(); v10=v10.to_numpy(); n=len(df)
 state=np.full(n,np.nan); prev=np.nan
 for i in range(n):
  if not np.isfinite(rel[i]): continue
  if rel[i]>up: prev=1.
  elif rel[i]<down: prev=0.
  elif not np.isfinite(prev): prev=1. if rel[i]>=0 else 0.
  state[i]=prev
 g=np.full(n,np.nan)
 ok=np.isfinite(state)&np.isfinite(dd)&np.isfinite(v10)
 for i in np.where(ok)[0]:
  if state[i]==1.: g[i]=3. if (v10[i]<vu and dd[i]>=ddu) else 1.5
  else: g[i]=1.5 if v10[i]<vd else 0.
 return pd.Series(g,index=df.index,name='gear')

def synthetic_returns(ndx, funding=.03, qfee=.002, lfee=.0095):
 r=ndx.pct_change().fillna(0).to_numpy(); td=252.
 return pd.DataFrame({'qqq':r-qfee/td,'qld':2*r-funding/td-lfee/td,'tqqq':3*r-2*funding/td-lfee/td},index=ndx.index).clip(lower=-.999999)

def simulate(gears, rets, lag=1):
 d=gears.shift(lag); idx=rets.index.intersection(d.dropna().index); r=rets.loc[idx].to_numpy(); gg=d.loc[idx].to_numpy();
 h=np.array([1.,0.,0.,0.]); prev=np.nan; wealth=np.empty(len(idx)); trades=0; gearout=np.empty(len(idx))
 for i,g in enumerate(gg):
  if i: h[1:]*=(1+r[i])
  w=h.sum()
  if not np.isfinite(prev) or g!=prev:
   if g==3: h=np.array([0.,0.,0.,w])
   elif g==1.5: h=np.array([0.,.5*w,.5*w,0.])
   elif g==0: h=np.array([w,0.,0.,0.])
   else: raise RuntimeError(g)
   if np.isfinite(prev): trades+=1
   prev=g
  wealth[i]=h.sum(); gearout[i]=g
 return pd.DataFrame({'wealth':wealth,'gear':gearout},index=idx), trades

def perf(s):
 s=s.dropna(); y=(s.index[-1]-s.index[0]).days/365.2425; x=s/s.iloc[0]; dd=x/x.cummax()-1
 return {'start':str(s.index[0].date()),'end':str(s.index[-1].date()),'years':y,'final_multiple':float(x.iloc[-1]),'CAGR':float(x.iloc[-1]**(1/y)-1),'MDD':float(dd.min())}

def subperf(s,a,b):
 z=s.loc[a:b]; return perf(z) if len(z)>10 else None

def episode_table(gear, strat, tqqq):
 ix=gear.index.intersection(strat.index).intersection(tqqq.index); g=gear.loc[ix]; s=strat.loc[ix]; t=tqqq.loc[ix]
 rows=[]; start=None
 for i in range(1,len(ix)):
  if start is None and g.iloc[i-1]==3 and g.iloc[i]<3: start=ix[i]
  elif start is not None and g.iloc[i]==3:
   end=ix[i]; sr=float(s.loc[end]/s.loc[start]-1); tr=float(t.loc[end]/t.loc[start]-1); rows.append((start,end,sr,tr,sr-tr)); start=None
 return pd.DataFrame(rows,columns=['start','end','strategy_return','tqqq_return','insurance_alpha'])

def actual_hybrid(df, gears):
 q=pd.read_csv(dl('qld')); t=pd.read_csv(dl('tqqq'))
 for x in (q,t): x['date']=pd.to_datetime(x.date)
 q=q.set_index('date').adj_close.astype(float); t=t.set_index('date').adj_close.astype(float)
 idx=df.index.intersection(q.index).intersection(t.index); idx=idx[idx<='2025-02-11']
 qret=q.loc[idx].pct_change().fillna(0); tret=t.loc[idx].pct_change().fillna(0); qqq=df.ndx.loc[idx].pct_change().fillna(0)-.002/252
 rets=pd.DataFrame({'qqq':qqq,'qld':qret,'tqqq':tret},index=idx)
 bt,tr=simulate(gears.loc[idx],rets,1)
 sr=synthetic_returns(df.ndx.loc[idx],.03)
 def compare(actual, syn):
  a=actual.loc[idx].pct_change().dropna(); b=syn.loc[idx].dropna(); z=pd.concat([a,b],axis=1).dropna(); z.columns=['a','s']; diff=z.a-z.s
  return {'n':len(z),'corr':float(z.corr().iloc[0,1]),'mean_daily_diff':float(diff.mean()),'mae_daily_diff':float(diff.abs().mean()),'annualized_diff':float((1+z.a).prod()**(252/len(z))/(1+z.s).prod()**(252/len(z))-1)}
 return perf(bt.wealth), tr, compare(q, sr.qld), compare(t, sr.tqqq)

def grid_run(df, rets):
 grid=product([200,225,250,275,300],[0,.01,.02],[-.03,-.04,-.05,-.06,-.07],[24.,26.,28.,30.,32.],[-.07,-.08,-.09,-.10,-.11],[16.,18.,20.])
 rows=[]
 for k,(ma,u,d,vu,ddu,vd) in enumerate(grid):
  g=gears_for(df,ma,u,d,vu,ddu,vd); bt,tr=simulate(g,rets,1); w=bt.wealth
  full=perf(w); isp=subperf(w,'1991-01-01','2004-12-31'); val=subperf(w,'2005-01-01','2014-12-31'); oos=subperf(w,'2015-01-01','2025-12-31')
  rows.append({'ma':ma,'up_buffer':u,'down_buffer':d,'vix_up':vu,'dd_up':ddu,'vix_down':vd,'trades':tr,'CAGR':full['CAGR'],'MDD':full['MDD'],'IS_CAGR':isp['CAGR'] if isp else np.nan,'IS_MDD':isp['MDD'] if isp else np.nan,'VAL_CAGR':val['CAGR'] if val else np.nan,'VAL_MDD':val['MDD'] if val else np.nan,'OOS_CAGR':oos['CAGR'] if oos else np.nan,'OOS_MDD':oos['MDD'] if oos else np.nan})
 return pd.DataFrame(rows)

def main():
 df=load(); print('DATA',len(df),df.index[0],df.index[-1])
 baseg=gears_for(df); summary={'data':{'rows':len(df),'start':str(df.index[0].date()),'end':str(df.index[-1].date())}}
 funding=[]
 for f in [0,.03,.05,.08]:
  rets=synthetic_returns(df.ndx,f); bt,tr=simulate(baseg,rets,1); x={'funding':f,'trades':tr,**perf(bt.wealth)}; funding.append(x)
  if f==.03:
   basebt=bt; baserets=rets
   for name in ['qqq','qld','tqqq']:
    nav=(1+rets[name]).cumprod(); summary[name]=perf(nav.loc[bt.index])
 summary['funding_sensitivity']=funding; summary['tripod']=funding[1]
 b0,t0=simulate(baseg,synthetic_returns(df.ndx,.03),0); summary['same_close']= {'trades':t0,**perf(b0.wealth)}
 for label,a,b in [('dotcom','2000-03-24','2003-03-24'),('gfc','2007-10-31','2009-03-09'),('covid','2020-02-19','2020-03-23')]:
  summary[label]={'tripod':subperf(basebt.wealth,a,b)}
  for name in ['qqq','qld','tqqq']:
   nav=(1+baserets[name]).cumprod(); summary[label][name]=subperf(nav,a,b)
 tnav=(1+baserets.tqqq).cumprod(); eps=episode_table(basebt.gear,basebt.wealth,tnav); eps.to_csv(f'{OUT}/insurance_episodes.csv',index=False)
 summary['insurance']={'episodes':len(eps),'positive_alpha':int((eps.insurance_alpha>0).sum()) if len(eps) else 0,'negative_alpha':int((eps.insurance_alpha<=0).sum()) if len(eps) else 0,'median_alpha':float(eps.insurance_alpha.median()) if len(eps) else None}
 ah,tr,qcmp,tcmp=actual_hybrid(df,baseg); summary['actual_hybrid']={'performance':ah,'trades':tr,'qld_tracking':qcmp,'tqqq_tracking':tcmp}
 grid=grid_run(df,baserets); grid.to_csv(f'{OUT}/grid.csv',index=False)
 default=(grid[(grid.ma==250)&(grid.up_buffer==.01)&(grid.down_buffer==-.05)&(grid.vix_up==28)&(grid.dd_up==-.09)&(grid.vix_down==18)].iloc[0])
 summary['grid']={'n':len(grid),'default_CAGR':float(default.CAGR),'default_MDD':float(default.MDD),'default_CAGR_percentile':float((grid.CAGR<=default.CAGR).mean()),'default_MDD_percentile_less_drawdown':float((grid.MDD<=default.MDD).mean()),'median_CAGR':float(grid.CAGR.median()),'p10_CAGR':float(grid.CAGR.quantile(.1)),'p90_CAGR':float(grid.CAGR.quantile(.9)),'median_MDD':float(grid.MDD.median())}
 neigh=grid[(grid.ma.isin([225,250,275]))&(grid.up_buffer.isin([0,.01,.02]))&(grid.down_buffer.isin([-.04,-.05,-.06]))&(grid.vix_up.isin([26,28,30]))&(grid.dd_up.isin([-.08,-.09,-.10]))&(grid.vix_down.isin([16,18,20]))]
 summary['grid']['neighborhood_n']=len(neigh); summary['grid']['neighborhood_CAGR_median']=float(neigh.CAGR.median()); summary['grid']['neighborhood_CAGR_min']=float(neigh.CAGR.min()); summary['grid']['neighborhood_MDD_median']=float(neigh.MDD.median())
 isbest=grid.sort_values('IS_CAGR',ascending=False).iloc[0]; summary['oos']={'is_best_params':{k:(float(isbest[k]) if k!='ma' else int(isbest[k])) for k in ['ma','up_buffer','down_buffer','vix_up','dd_up','vix_down']},'is_best_IS_CAGR':float(isbest.IS_CAGR),'is_best_OOS_CAGR':float(isbest.OOS_CAGR),'is_best_OOS_MDD':float(isbest.OOS_MDD),'default_IS_CAGR':float(default.IS_CAGR),'default_OOS_CAGR':float(default.OOS_CAGR),'default_OOS_MDD':float(default.OOS_MDD)}
 with open(f'{OUT}/summary.json','w') as f: json.dump(summary,f,indent=2)
 def pct(x): return 'n/a' if x is None else f'{100*x:.2f}%'
 lines=['# Tripod independent validation','',f"Data: {summary['data']['start']} to {summary['data']['end']} ({summary['data']['rows']} common NDX/VIX rows)",'', '## Headline',f"- Tripod CAGR: {pct(summary['tripod']['CAGR'])}; MDD: {pct(summary['tripod']['MDD'])}; trades: {summary['tripod']['trades']}",f"- Dotcom Tripod: {summary['dotcom']['tripod']['final_multiple']:.4f}x; MDD {pct(summary['dotcom']['tripod']['MDD'])}",f"- Dotcom QQQ: {summary['dotcom']['qqq']['final_multiple']:.4f}x; TQQQ synthetic: {summary['dotcom']['tqqq']['final_multiple']:.6f}x",f"- Actual-hybrid 2010+: CAGR {pct(summary['actual_hybrid']['performance']['CAGR'])}; MDD {pct(summary['actual_hybrid']['performance']['MDD'])}",f"- Grid default CAGR percentile: {pct(summary['grid']['default_CAGR_percentile'])}; neighborhood median CAGR {pct(summary['grid']['neighborhood_CAGR_median'])}",f"- IS-best OOS CAGR: {pct(summary['oos']['is_best_OOS_CAGR'])}; default OOS CAGR: {pct(summary['oos']['default_OOS_CAGR'])}",f"- Insurance episodes (our explicit definition): {summary['insurance']['episodes']}, positive alpha {summary['insurance']['positive_alpha']}"]
 open(f'{OUT}/report.md','w').write('\n'.join(lines)+'\n')
 print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
