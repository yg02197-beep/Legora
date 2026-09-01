#!/usr/bin/env python3
from __future__ import annotations
import json, os, urllib.request
import numpy as np
import pandas as pd

OUT='tripod_strict_results'; os.makedirs(OUT,exist_ok=True)
URL={
 'index':'https://raw.githubusercontent.com/ravelab/l-etf/main/data/index-nq.csv',
 'rates':'https://raw.githubusercontent.com/ravelab/l-etf/main/data/rate-borrow.csv',
 'qld':'https://raw.githubusercontent.com/ravelab/l-etf/main/data/etf-qld.csv',
 'tqqq':'https://raw.githubusercontent.com/ravelab/l-etf/main/data/etf-tqqq.csv',
 'vix':'https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS',
}

def dl(k):
 p=f'{OUT}/{k}.csv'; urllib.request.urlretrieve(URL[k],p); return p

def load():
 x=pd.read_csv(dl('index')); x['date']=pd.to_datetime(x.date); x=x.set_index('date').sort_index()
 for c in ['close','adj_close','open','adj_open']:
  if c in x: x[c]=pd.to_numeric(x[c],errors='coerce')
 if 'adj_open' not in x or x.adj_open.isna().all():
  x['adj_open']=x['open']*(x['adj_close']/x['close'])
 v=pd.read_csv(dl('vix')); v.columns=['date','vix']; v['date']=pd.to_datetime(v.date); v['vix']=pd.to_numeric(v.vix,errors='coerce'); v=v.dropna().set_index('date').sort_index()
 r=pd.read_csv(dl('rates')); r['date']=pd.to_datetime(r.date); r['value']=pd.to_numeric(r.value,errors='coerce'); r=r.dropna().drop_duplicates('date').set_index('date').sort_index()
 df=x[['close','adj_close','adj_open']].join(v,how='left').join(r[['value']].rename(columns={'value':'borrow_annual'}),how='left')
 df['borrow_annual']=df.borrow_annual.ffill()
 df=df.loc['1986-01-01':]
 return df

def gears(df,high_days=252):
 ma=df.close.rolling(250,min_periods=250).mean(); high=df.close.rolling(high_days,min_periods=high_days).max(); dd=df.close/high-1; v10=df.vix.rolling(10,min_periods=10).mean(); rel=df.close/ma-1
 st=[]; prev=np.nan
 for x in rel:
  if not np.isfinite(x): st.append(np.nan); continue
  if x>.01: prev=1.
  elif x<-.05: prev=0.
  elif not np.isfinite(prev): prev=1. if x>=0 else 0.
  st.append(prev)
 g=[]
 for s,d,v in zip(st,dd,v10):
  if not (np.isfinite(s) and np.isfinite(d) and np.isfinite(v)): g.append(np.nan)
  elif s==1: g.append(3. if (v<28 and d>=-.09) else 1.5)
  else: g.append(1.5 if v<18 else 0.)
 return pd.Series(g,index=df.index,dtype=float)

def spread_daily(rate_annual,L):
 if L==2: sens,base=.705492,.000781
 elif L==3: sens,base=.825570,.000543
 else: return np.zeros_like(rate_annual,dtype=float)
 fitted=np.minimum(rate_annual,.06); extra=np.maximum(0,rate_annual-.06); passthrough=360/252-1
 annual=np.maximum(sens*fitted+base+passthrough*extra,0)
 return annual/360

def strict_returns(df):
 ri=df.adj_close.pct_change().fillna(0).to_numpy(); rate=df.borrow_annual.fillna(method='ffill').to_numpy(float); bd=rate/360
 q=ri-.002/252
 q2=2*ri-.0095/252-(bd+spread_daily(rate,2))
 q3=3*ri-.0088/252-2*(bd+spread_daily(rate,3))
 return pd.DataFrame({'qqq':q,'qld':q2,'tqqq':q3},index=df.index).clip(lower=-.999999)

def actual_series(path):
 a=pd.read_csv(path); a['date']=pd.to_datetime(a.date); a=a.set_index('date').sort_index()
 a['adj_close']=pd.to_numeric(a.adj_close,errors='coerce'); return a.adj_close

def hybrid_returns(df,syn):
 out=syn.copy(); q=actual_series(dl('qld')); t=actual_series(dl('tqqq'))
 for name,s in [('qld',q),('tqqq',t)]:
  rr=s.pct_change(); ix=out.index.intersection(rr.dropna().index); out.loc[ix,name]=rr.loc[ix]
 return out

def simulate(g,rets,lag=1,cash_rate=None,daily15=False):
 d=g.shift(lag); idx=rets.index.intersection(d.dropna().index); h=np.array([1.,0.,0.,0.]); prev=np.nan; rows=[]; trades=0
 for j,dt in enumerate(idx):
  if j:
   if cash_rate is not None:
    annual=float(cash_rate.loc[dt]) if dt in cash_rate.index and np.isfinite(cash_rate.loc[dt]) else 0.; h[0]*=(1+annual/360)
   h[1:]*=(1+rets.loc[dt,['qqq','qld','tqqq']].to_numpy(float))
  gg=float(d.loc[dt]); w=h.sum(); reb=(not np.isfinite(prev)) or gg!=prev or (daily15 and gg==1.5)
  if reb:
   if gg==3: h=np.array([0.,0.,0.,w])
   elif gg==1.5: h=np.array([0.,.5*w,.5*w,0.])
   else: h=np.array([w,0.,0.,0.])
   if np.isfinite(prev) and gg!=prev: trades+=1
   prev=gg
  rows.append((dt,h.sum(),gg))
 return pd.DataFrame(rows,columns=['date','wealth','gear']).set_index('date'),trades

def perf(s):
 s=s.dropna(); x=s/s.iloc[0]; yrs=(s.index[-1]-s.index[0]).days/365.2425; dd=x/x.cummax()-1
 return {'start':str(s.index[0].date()),'end':str(s.index[-1].date()),'years':yrs,'multiple':float(x.iloc[-1]),'CAGR':float(x.iloc[-1]**(1/yrs)-1),'MDD':float(dd.min())}

def sub(s,a,b):
 z=s.loc[a:b]; return perf(z) if len(z)>5 else None

def rolling(s,yrs,end=None):
 if end: s=s.loc[:end]
 starts=s.dropna().resample('MS').first().dropna().index; rows=[]
 for st in starts:
  target=st+pd.DateOffset(years=yrs); z=s.loc[(s.index>=st)&(s.index<=target)].dropna()
  if len(z)<1 or z.index[-1]<target-pd.Timedelta(days=10): continue
  m=float(z.iloc[-1]/z.iloc[0]); rows.append(m)
 a=pd.Series(rows,dtype=float)
 return {'n':int(len(a)),'min':float(a.min()),'p25':float(a.quantile(.25)),'median':float(a.median()),'mean':float(a.mean()),'max':float(a.max()),'loss_frequency':float((a<1).mean()),'median_cagr':float(a.median()**(1/yrs)-1),'mean_of_window_cagr':None}

def main():
 df=load(); g=gears(df); syn=strict_returns(df); hyb=hybrid_returns(df,syn)
 out={'data':{'start':str(df.index[0].date()),'end':str(df.index[-1].date()),'vix_start':str(df.vix.dropna().index[0].date()),'rate_start':str(df.borrow_annual.dropna().index[0].date())}}
 for label,rets in [('strict_synthetic',syn),('strict_hybrid',hyb)]:
  bt,tr=simulate(g,rets,1); b0,tr0=simulate(g,rets,0); btc,trc=simulate(g,rets,1,cash_rate=df.borrow_annual); btd,trd=simulate(g,rets,1,daily15=True)
  x={'performance':{'trades':tr,**perf(bt.wealth)},'same_close':{'trades':tr0,**perf(b0.wealth)},'cash_yield':{'trades':trc,**perf(btc.wealth)},'daily_rebalance_15x':{'trades':trd,**perf(btd.wealth)},'dotcom':sub(bt.wealth,'2000-03-24','2003-03-24'),'rolling_7y':rolling(bt.wealth,7),'rolling_10y':rolling(bt.wealth,10)}
  x['benchmarks']={k:perf((1+rets[k]).cumprod().loc[bt.index]) for k in ['qqq','qld','tqqq']}
  x['dotcom_benchmarks']={k:sub((1+rets[k]).cumprod(),'2000-03-24','2003-03-24') for k in ['qqq','qld','tqqq']}
  # Find month-end cutoff(s) where the 10y rolling count equals the claimed 307.
  matches=[]
  for end in pd.date_range('2025-01-31',min(pd.Timestamp('2026-12-31'),bt.index[-1]),freq='ME'):
   rr=rolling(bt.wealth,10,str(end.date()))
   if rr['n']==307: matches.append({'end':str(end.date()),**rr})
  x['rolling_10y_n307_cutoffs']=matches[:12]
  out[label]=x
 with open(f'{OUT}/summary.json','w') as f: json.dump(out,f,indent=2)
 print(json.dumps(out,indent=2))

if __name__=='__main__': main()
