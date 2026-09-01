#!/usr/bin/env python3
from __future__ import annotations
import json, os, urllib.request
import numpy as np, pandas as pd
import tripod_remote_validation as trv

OUT='tripod_repro_results'; os.makedirs(OUT,exist_ok=True)
NDX='https://fred.stlouisfed.org/graph/fredgraph.csv?id=NASDAQ100'
VIX='https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS'

def get(url,name,col):
 p=f'{OUT}/{name}.csv'; urllib.request.urlretrieve(url,p); x=pd.read_csv(p); x.columns=['date',col]; x.date=pd.to_datetime(x.date); x[col]=pd.to_numeric(x[col],errors='coerce'); return x.dropna().set_index('date').sort_index()

def gear(df):
 ma=df.ndx.rolling(250,min_periods=250).mean(); high=df.ndx.rolling(252,min_periods=252).max(); dd=df.ndx/high-1; v=df.vix.rolling(10,min_periods=10).mean(); rel=df.ndx/ma-1; out=[]; prev=np.nan
 st=[]
 for x in rel:
  if not np.isfinite(x): st.append(np.nan); continue
  if x>.01: prev=1.
  elif x<-.05: prev=0.
  elif not np.isfinite(prev): prev=1. if x>=0 else 0.
  st.append(prev)
 for s,d,z in zip(st,dd,v):
  if not (np.isfinite(s) and np.isfinite(d) and np.isfinite(z)): out.append(np.nan)
  elif s==1: out.append(3. if z<28 and d>=-.09 else 1.5)
  else: out.append(1.5 if z<18 else 0.)
 return pd.Series(out,index=df.index)

def sim(g,r):
 d=g.shift(1); idx=r.index.intersection(d.dropna().index); h=np.array([1.,0.,0.,0.]); prev=np.nan; w=[]; transitions=0
 for i,dt in enumerate(idx):
  if i: h[1:]*=(1+r.loc[dt,['qqq','qld','tqqq']].to_numpy(float))
  gg=float(d.loc[dt]); tot=h.sum()
  if not np.isfinite(prev) or gg!=prev:
   if gg==3: h=np.array([0.,0.,0.,tot])
   elif gg==1.5: h=np.array([0.,.5*tot,.5*tot,0.])
   else: h=np.array([tot,0.,0.,0.])
   if np.isfinite(prev): transitions+=1
   prev=gg
  w.append(h.sum())
 return pd.Series(w,index=idx), transitions

def perf(s):
 x=s/s.iloc[0]; y=(s.index[-1]-s.index[0]).days/365.2425; dd=x/x.cummax()-1; return x.iloc[-1]**(1/y)-1,dd.min()

def roll(s,years=10):
 starts=s.resample('MS').first().dropna().index; vals=[]
 for st in starts:
  target=st+pd.DateOffset(years=years); z=s.loc[(s.index>=st)&(s.index<=target)]
  if z.empty or z.index[-1]<target-pd.Timedelta(days=10): continue
  vals.append(float(z.iloc[-1]/z.iloc[0]))
 a=pd.Series(vals,dtype=float)
 return {'n':len(a),'min':a.min(),'p25':a.quantile(.25),'median':a.median(),'max':a.max(),'loss':(a<1).mean()}

def main():
 n=get(NDX,'ndx','ndx'); v=get(VIX,'vix','vix'); rows=[]
 modes={
  'proper':n.join(v,how='left'),
  'vix_inner_warmup_bug':n.join(v,how='inner').dropna(),
 }
 claim=np.array([.329,-.62,8.1,307,1.56,4.73,12.5,141,.401,.212],float)
 for mode,full in modes.items():
  full=full.loc[:'2026-08-31']; g=gear(full); r=trv.synthetic_returns(full.ndx,.03)
  for end in pd.date_range('2025-01-31','2026-08-31',freq='ME'):
   sub=full.loc[:end]; gs=g.loc[sub.index]; rs=r.loc[sub.index]; w,tr=sim(gs,rs)
   if len(w)<1000: continue
   c,m=perf(w); rw=roll(w); tq=(1+rs.tqqq).cumprod().loc[w.index]; ql=(1+rs.qld).cumprod().loc[w.index]; rt=roll(tq); rq=roll(ql); yrs=(w.index[-1]-w.index[0]).days/365.2425; avg=tr/yrs
   vals=np.array([c,m,avg,rw['n'],rw['min'],rw['p25'],rw['median'],rw['max'],rt['loss'],rq['loss']],float)
   scales=np.array([.03,.03,1,5,.5,2,5,50,.03,.03])
   score=float(np.sqrt(np.mean(((vals-claim)/scales)**2)))
   rows.append({'mode':mode,'end':str(w.index[-1].date()),'CAGR':c,'MDD':m,'avg_transitions':avg,'n10':rw['n'],'min10':rw['min'],'p25_10':rw['p25'],'median10':rw['median'],'max10':rw['max'],'tqqq_loss10':rt['loss'],'qld_loss10':rq['loss'],'score':score})
 out=pd.DataFrame(rows).sort_values('score'); out.to_csv(f'{OUT}/all.csv',index=False)
 n307=out[out.n10==307].sort_values('score')
 with open(f'{OUT}/best.json','w') as f: json.dump({'best':out.head(10).to_dict(orient='records'),'n307':n307.head(20).to_dict(orient='records')},f,indent=2)
 print('BEST\n',out.head(10).to_string(index=False)); print('\nN=307\n',n307.head(20).to_string(index=False))

if __name__=='__main__': main()
