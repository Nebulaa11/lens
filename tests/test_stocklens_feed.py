import importlib.util, copy, unittest
spec=importlib.util.spec_from_file_location('stocklens','server.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
key='NSE_EQ|TEST';stamp=int(m.dt.datetime(2026,10,15,9,15,tzinfo=m.IST).timestamp()*1000)
packet={'fullFeed':{'marketFF':{'ltpc':{'ltp':110,'cp':100,'ltt':stamp},'marketOHLC':{'ohlc':[{'interval':'1d','open':105,'high':112,'low':103},{'interval':'I1','open':109,'high':111,'low':108,'close':110,'ts':stamp,'vol':1200}]},'vtt':50000}}}
class FeedTests(unittest.TestCase):
 def test_genuine_quote_and_timestamp(self):
  q=m.normalize_feed(key,packet,'TEST');self.assertAlmostEqual(q['dayChange'],10);self.assertAlmostEqual(q['moveFromOpen'],100*(110/105-1));self.assertEqual(q['timestamp'],m.dt.datetime.fromtimestamp(stamp/1000,m.dt.timezone.utc).isoformat())
 def test_incomplete_and_nonfinite_rejected(self):
  for value in [0,None,float('nan'),float('inf')]:
   p=copy.deepcopy(packet);p['fullFeed']['marketFF']['ltpc']['ltp']=value;self.assertIsNone(m.normalize_feed(key,p,'TEST'))
  p=copy.deepcopy(packet);p['fullFeed']['marketFF']['marketOHLC']['ohlc']=[];self.assertIsNone(m.normalize_feed(key,p,'TEST'))
 def test_old_quote_does_not_replace_new(self):
  f=m.Feed('');f.keys={key:'TEST'};f.message({'feeds':{key:packet}})
  old=copy.deepcopy(packet);old['fullFeed']['marketFF']['ltpc'].update(ltp=99,ltt=stamp-60000);f.message({'feeds':{key:old}})
  q=f.snapshot()['quotes'][0];self.assertEqual(q['price'],110);self.assertEqual(q['candles'][0]['close'],110)
 def test_unconfigured_has_no_quotes(self):
  f=m.Feed('');f.start();s=f.snapshot();self.assertFalse(s['status']['configured']);self.assertEqual(s['quotes'],[]);self.assertIsNone(f.streamer)
 def test_snapshot_is_detached(self):
  f=m.Feed('');f.keys={key:'TEST'};f.message({'feeds':{key:packet}});s=f.snapshot();s['quotes'][0]['price']=0;self.assertEqual(f.snapshot()['quotes'][0]['price'],110)
class HistoryTests(unittest.TestCase):
 def test_intraday_error_falls_back_to_history(self):
  from unittest.mock import patch
  import json,urllib.error
  f=m.Feed('');f.keys={key:'TEST'};calls=[]
  def get(url):
   calls.append(url)
   if '/intraday/' in url: raise urllib.error.HTTPError(url,400,'not available',{},None)
   return json.dumps({'data':{'candles':[['2026-10-15T09:16:00+05:30',105,110,104,109,100],['2026-10-15T09:15:00+05:30',104,106,103,105,90]]}}).encode()
  f.get=get
  with patch.object(m.time,'sleep'): f.backfill()
  self.assertEqual(len(calls),2);self.assertEqual(len(f.history[key]),2);self.assertEqual(f.history_status[key],'ready')
 def test_auth_failure_is_reported_without_fake_history(self):
  from unittest.mock import patch
  import urllib.error
  f=m.Feed('');f.keys={key:'TEST'}
  def get(url): raise urllib.error.HTTPError(url,403,'forbidden',{},None)
  f.get=get
  with patch.object(m.time,'sleep'): f.backfill()
  self.assertEqual(f.history_status[key],'authorization_required');self.assertFalse(f.history.get(key))
class SessionHistoryTests(unittest.TestCase):
 def test_stream_excludes_previous_day_and_outside_session(self):
  f=m.Feed('');f.keys={key:'TEST'};p=copy.deepcopy(packet)
  rows=p['fullFeed']['marketFF']['marketOHLC']['ohlc']
  yesterday=copy.deepcopy(rows[-1]);yesterday['ts']=stamp-86400000;rows.append(yesterday)
  early=copy.deepcopy(rows[-1]);early['ts']=stamp-3600000;rows.append(early)
  f.message({'feeds':{key:p}})
  self.assertEqual([x['time'] for x in f.history[key]],[stamp])
 def test_error_code_does_not_expose_response(self):
  import io,urllib.error
  e=urllib.error.HTTPError('https://api.upstox.com',403,'forbidden',{},io.BytesIO(b'{"errors":[{"errorCode":"UDAPI100050","message":"sensitive response"}]}'))
  self.assertEqual(m.history_error_code(e),'UDAPI100050')
  e=urllib.error.HTTPError('https://api.upstox.com',403,'forbidden',{},io.BytesIO(b'{"errors":[{"errorCode":"secret"}]}'))
  self.assertIsNone(m.history_error_code(e))
unittest.main()
