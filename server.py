"""Read-only Stocklens Upstox feed. Tokens never leave the backend.
Run: UPSTOX_ACCESS_TOKEN=... python3 server.py --port 8765
No quote simulation, order calls, or portfolio calls exist in this server.
"""
import argparse
import copy
import datetime as dt
import gzip
from http.cookies import SimpleCookie
import json
import math
import os
import re
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
IST = ZoneInfo('Asia/Kolkata')
SYMBOLS = ["EICHERMOT","TVSMOTOR","INOXWIND","INFY","TATASTEEL","HDFCBANK","SBIN","LT","BHARTIARTL","TCS","ANANDRATHI","MPHASIS","COFORGE","BSE","DIXON","TRENT","DMART","MRF","VOLTAS","POLYCAB","ADANIPORTS","ULTRACEMCO","ITC","BAJFINANCE","LICI","NTPC","SUNPHARMA","PAYTM","SRF","DLF","HAL","MARUTI","TITAN","RELIANCE","ADANIENT","CONCOR","SHREECEM","HINDUNILVR","BAJAJFINSRV","SBILIFE","JSWSTEEL","POWERGRID","BANKBARODA","ICICIBANK","DRREDDY","NAUKRI","PIDILITIND","INDUSTOWER","GODREJPROP","BEL","M&M","SIEMENS","CDSL","ONGC","ADANIENSOL","HCLTECH","DELHIVERY","AMBUJACEM","NESTLEIND","SHRIRAMFIN","HDFCLIFE","JINDALSTEL","TATAPOWER","CANBK","AXISBANK","CIPLA","POLICYBZR","DEEPAKNTR","IDEA","OBEROIRLTY","BDL","BAJAJ-AUTO","ABB","MCX","OIL","GRASIM","WIPRO","BLUEDART","ACC","BRITANNIA","CHOLAFIN","ICICIPRULI","SAIL","ADANIPOWER","PNB","KOTAKBANK","DIVISLAB","NYKAA","AARTIIND","TATACOMM","PRESTIGE","MAZDOCK","HEROMOTOCO","BHEL","RELAXO","ANGELONE","IOC","IRB","TECHM","GMRINFRA","DALBHARAT","DABUR","MUTHOOTFIN","ICICIGI","HINDALCO","ADANIGREEN","UNIONBANK","INDUSINDBK","LUPIN","ZOMATO","UPL","HFCL","PHOENIXLTD","COCHINSHIP","TATAMOTORS","CUMMINSIND","BATAINDIA","KFINTECH","BPCL","NCC","LTIM","RAMCOCEM","MARICO","MANAPPURAM","GICRE","VEDL","NHPC","BANKINDIA","FEDERALBNK","AUROPHARMA","SWIGGY","PIIND","BRIGADE","GRSE","ASHOKLEY","CGPOWER","PAGEIND","CAMS","HINDPETRO","HINDCOPPER","PERSISTENT","JKCEMENT","GODREJCP","LTF","NMDC","SJVN","INDIANB","IDFCFIRSTB","ZYDUSLIFE","IEX","ATUL","LODHA","BEML","BHARATFORG","HAVELLS","KALYANKJIL","NUVAMA","GAIL","SUPREMEIND","OFSS","COLPAL","PFC","NATIONALUM","JSWENERGY","IOB","AUBANK","BIOCON","IRCTC","TATACHEM","NBCC","MOTHERSON","JUBLFOOD","MOTILALOFS","PETRONET","ASTRAL","TATAELXSI","TATACONSUM","RECLTD","HINDZINC","TORNTPOWER","MAHABANK","BANDHANBNK","ALKEM","NAVINFLUOR","BOSCHLTD","KEI","INDIANHOTEL","360ONE","IGL","AMBER","KPITTECH","VBL","IREDA","APLAPOLLO","CESC","CENTRALBK","RBLBANK","TORNTPHARM","FLUOROCHEM","TIINDIA","SCHAEFFLER","EIHOTEL","MGL","LALPATHLAB","CYIENT","PATANJALI","IRFC","JSL","NLCINDIA","YESBANK","ABBOTINDIA","CHAMBLFERT","EXIDEIND","AIAENG","SAREGAMA","ATGL"]

def trusted_context():
    import certifi
    return ssl.create_default_context(cafile=certifi.where())

def market_streamer(api_client, keys):
    """Use the SDK's parser/subscriptions with verified TLS on the socket."""
    import certifi
    import websocket
    from upstox_client import MarketDataStreamerV3
    from upstox_client.feeder.market_data_feeder_v3 import MarketDataFeederV3

    class VerifiedFeeder(MarketDataFeederV3):
        def connect(self):
            if self.ws and self.ws.sock:
                return
            headers={'Authorization':self.api_client.configuration.auth_settings()['OAUTH2']['value']}
            self.ws=websocket.WebSocketApp(
                'wss://api.upstox.com/v3/feed/market-data-feed',header=headers,
                on_open=self.on_open,on_message=self.on_message,
                on_error=self.on_error,on_close=self.on_close)
            threading.Thread(target=self.ws.run_forever,daemon=True,kwargs={
                'sslopt':{'cert_reqs':ssl.CERT_REQUIRED,'check_hostname':True,'ca_certs':certifi.where()}
            }).start()

    class VerifiedStreamer(MarketDataStreamerV3):
        def connect(self):
            self.feeder=VerifiedFeeder(
                api_client=self.api_client,instrumentKeys=self.instrumentKeys,mode=self.mode,
                on_open=self.handle_open,on_message=self.handle_message,
                on_error=self.handle_error,on_close=self.handle_close)
            self.feeder.connect()

    return VerifiedStreamer(api_client,keys,'full')

def number(value):
    try:
        v=float(value)
        return v if math.isfinite(v) else None
    except (TypeError,ValueError):
        return None

def normalize_feed(key, feed, symbol):
    """Reject incomplete quote packets; preserve provider last-trade timestamps."""
    market=feed.get('fullFeed',{}).get('marketFF',{})
    ltpc=market.get('ltpc',feed.get('ltpc',{}))
    price,previous=number(ltpc.get('ltp')),number(ltpc.get('cp'))
    rows=market.get('marketOHLC',{}).get('ohlc',[])
    day=next((r for r in rows if r.get('interval')=='1d'),{})
    opening=number(day.get('open'))
    stamp=number(ltpc.get('ltt'))
    if price is None or price<=0 or previous is None or previous<=0 or opening is None or opening<=0 or stamp is None or stamp<=0 or stamp>253402300799000:
        return None
    return {'symbol':symbol,'instrumentKey':key,'price':price,'open':opening,'previousClose':previous,
            'dayChange':100*(price/previous-1) if previous and previous>0 else 0,
            'moveFromOpen':100*(price/opening-1),'high':number(day.get('high')),'low':number(day.get('low')),
            'volume':number(market.get('vtt')),'atp':number(market.get('atp')),
            'timestamp':dt.datetime.fromtimestamp(stamp/1000,dt.timezone.utc).isoformat(),
            'candles':[]}

def session_history(candles, session):
    """Only genuine, positive OHLC candles from the requested regular session."""
    valid={}
    for candle in candles:
        stamp=number(candle.get('time'))
        if stamp is None or not 0<stamp<=253402300799000:
            continue
        date=dt.datetime.fromtimestamp(stamp/1000,IST)
        if date.date()!=session or not 555<=date.hour*60+date.minute<=930:
            continue
        if any(number(candle.get(k)) is None or number(candle.get(k))<=0 for k in ('open','high','low','close')):
            continue
        valid[int(stamp)]=candle
    return sorted(valid.values(),key=lambda c:c['time'])[-400:]

def history_error_code(error):
    """Retain only documented error identifiers, never response bodies or credentials."""
    try:
        body=json.loads(error.read(16384))
        for item in body.get('errors',[]):
            code=item.get('errorCode') or item.get('error_code')
            if isinstance(code,str) and re.fullmatch(r'UDAPI[0-9]{3,10}',code):
                return code
    except (ValueError,TypeError,AttributeError):
        pass
    return None

class Feed:
    def __init__(self,token=None):
        self.token=token if token is not None else os.getenv('UPSTOX_ACCESS_TOKEN','')
        self.lock=threading.RLock()
        self.quotes={}
        self.history={}
        self.history_status={}
        self.history_errors={}
        self.keys={}
        self.streamer=None
        self.status={'configured':bool(self.token),'state':'unconfigured','provider':'Upstox',
                     'message':'Upstox Analytics Token is required. Preview mode is illustrative; Live mode shows no sample quotes.',
                     'last_trade_time':None,'market_status':None}
    def snapshot(self):
        with self.lock:
            quotes=[]
            for key,q in self.quotes.items():
                item=copy.deepcopy(q)
                item['candles']=copy.deepcopy(self.history.get(key,[]))
                item['historyStatus']=self.history_status.get(key,'pending')
                if key in self.history_errors:
                    item['historyError']=dict(self.history_errors[key])
                quotes.append(item)
            return {'status':dict(self.status),'quotes':quotes}
    def status_update(self,**values):
        with self.lock:
            self.status.update(values)
    def get(self,url,authorized=True):
        headers={'Accept':'application/json'}
        if authorized:
            headers['Authorization']='Bearer '+self.token
        req=urllib.request.Request(url,headers=headers,method='GET')
        with urllib.request.urlopen(req,timeout=25,context=trusted_context()) as response:
            return response.read()
    def start(self):
        if not self.token:
            return
        threading.Thread(target=self.run,daemon=True).start()
    def run(self):
        self.status_update(state='connecting',message='Resolving selected instruments and connecting to Upstox…')
        try:
            import upstox_client
            import certifi
            data=json.loads(gzip.decompress(self.get('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz',False)))
            for row in data:
                symbol=row.get('trading_symbol')
                key=row.get('instrument_key','')
                if symbol in SYMBOLS and key.startswith('NSE_EQ|'):
                    self.keys[key]=symbol
            if not self.keys:
                raise ValueError('No matching equities')
            missing=[s for s in SYMBOLS if s not in self.keys.values()]
            self.status_update(missing_symbols=missing, universe_count=len(self.keys), requested_universe_count=len(SYMBOLS))
            configuration=upstox_client.Configuration()
            configuration.access_token=self.token
            configuration.ssl_ca_cert=certifi.where()
            self.streamer=market_streamer(upstox_client.ApiClient(configuration),list(self.keys))
            self.streamer.on('message',self.message)
            self.streamer.on('open',lambda:self.status_update(state='connecting',message='Provider socket open; awaiting authenticated market snapshot…'))
            self.streamer.on('close',lambda *args:self.status_update(state='disconnected',message='Provider disconnected. Last genuine quotes are retained with their timestamps.'))
            self.streamer.on('error',lambda *args:self.status_update(state='error',message='Upstox connection failed. Check token validity and market-data permissions.'))
            self.streamer.on('reconnecting',lambda *args:self.status_update(state='reconnecting',message='Reconnecting to Upstox. No demo quotes are substituted.'))
            self.streamer.auto_reconnect(True,10,20)
            self.streamer.connect()
            threading.Thread(target=self.backfill,daemon=True).start()
        except ImportError:
            self.status_update(state='error',message='Install requirements.txt to enable the official Upstox streaming SDK.')
        except urllib.error.HTTPError as error:
            self.status_update(state='error',message=f'Upstox instrument download returned HTTP {error.code}. No quotes have been received.')
        except urllib.error.URLError as error:
            certificate=isinstance(error.reason,ssl.SSLCertVerificationError)
            self.status_update(state='error',message=(
                'Certificate verification failed while connecting to Upstox. Check the installed CA certificate bundle.'
                if certificate else 'Cannot reach the Upstox instrument service. Check the internet connection.'))
        except Exception:
            self.status_update(state='error',message='Unable to authenticate or resolve instruments. Check your token, network and provider permissions.')
    def message(self,payload):
        try:
            if isinstance(payload,(str,bytes)):
                payload=json.loads(payload)
            market=payload.get('marketInfo',{}).get('segmentStatus',{}).get('NSE_EQ')
            if market:
                self.status_update(market_status=market)
            with self.lock:
                for key,raw in payload.get('feeds',{}).items():
                    if key not in self.keys:
                        continue
                    q=normalize_feed(key,raw,self.keys[key])
                    if not q:
                        continue
                    existing=self.quotes.get(key)
                    if existing and q['timestamp']<existing['timestamp']:
                        continue
                    self.quotes[key]=q
                    # Upsert actual completed/provider 1-minute candles, never fabricate candles.
                    rows=raw.get('fullFeed',{}).get('marketFF',{}).get('marketOHLC',{}).get('ohlc',[])
                    candles={c['time']:c for c in self.history.get(key,[])}
                    for row in rows:
                        if row.get('interval')!='I1':
                            continue
                        values={k:number(row.get(k)) for k in ['open','high','low','close']}
                        stamp=number(row.get('ts'))
                        if stamp is None or any(v is None for v in values.values()):
                            continue
                        candles[int(stamp)]=dict(values,time=int(stamp),volume=number(row.get('vol')))
                    self.history[key]=session_history(candles.values(),dt.datetime.fromisoformat(q['timestamp']).astimezone(IST).date())
                if self.quotes:
                    last=max(q['timestamp'] for q in self.quotes.values())
                    state=self.status.get('market_status')
                    closed=bool(state and state!='NORMAL_OPEN')
                    age=(dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(last)).total_seconds()
                    suffix=' Market is closed.' if closed else (' Quotes are stale / from the last session.' if age>120 else '')
                    self.status.update(state='connected',last_trade_time=last,message='Connected to Upstox; prices and timestamps are from the provider.'+suffix)
        except (ValueError,TypeError,KeyError):
            self.status_update(state='error',message='An invalid provider packet was rejected. Existing genuine quotes were retained.')
    def backfill(self):
        today=dt.datetime.now(IST).date()
        for key in list(self.keys):
            try:
                encoded=urllib.parse.quote(key,safe='')
                try:
                    response=json.loads(self.get(f'https://api.upstox.com/v3/historical-candle/intraday/{encoded}/minutes/1'))
                    rows=response.get('data',{}).get('candles',[])
                except urllib.error.HTTPError as error:
                    if error.code in (401,403):
                        raise
                    rows=[]
                if len(rows)<2:
                    quote=self.quotes.get(key)
                    end=dt.datetime.fromisoformat(quote['timestamp']).astimezone(IST).date() if quote else today
                    start=end-dt.timedelta(days=7)
                    response=json.loads(self.get(f'https://api.upstox.com/v3/historical-candle/{encoded}/minutes/1/{end}/{start}'))
                    rows=response.get('data',{}).get('candles',[])
                candles=[]
                if rows:
                    session=max(str(r[0])[:10] for r in rows if len(r)>=6)
                    for row in rows:
                        if str(row[0])[:10]!=session or len(row)<6:
                            continue
                        stamp=int(dt.datetime.fromisoformat(row[0]).timestamp()*1000)
                        values=[number(v) for v in row[1:6]]
                        if any(v is None for v in values) or any(v<=0 for v in values[:4]):
                            continue
                        candles.append(dict(zip(['open','high','low','close','volume'],values),time=stamp))
                with self.lock:
                    merged={c['time']:c for c in candles}
                    merged.update({c['time']:c for c in self.history.get(key,[])})
                    latest=max((c['time'] for c in merged.values()),default=0)
                    quote=self.quotes.get(key)
                    session=dt.datetime.fromisoformat(quote['timestamp']).astimezone(IST).date() if quote else dt.datetime.fromtimestamp(latest/1000,IST).date() if latest else None
                    self.history[key]=session_history(merged.values(),session)
                    self.history_errors.pop(key,None)
                    self.history_status[key]='ready' if len(self.history[key])>1 else 'unavailable'
            except urllib.error.HTTPError as error:
                with self.lock:
                    self.history_status[key]='authorization_required' if error.code in (401,403) else 'request_failed'
                    self.history_errors[key]={'httpStatus':error.code,'code':history_error_code(error)}
            except Exception:
                with self.lock:
                    self.history_status[key]='request_failed'
            time.sleep(.5)

class Handler(BaseHTTPRequestHandler):
    feed=None
    accounts=None
    accounts_lock=threading.Lock()
    def account_store(self):
        with Handler.accounts_lock:
            if Handler.accounts is None:
                from accounts import Accounts
                Handler.accounts=Accounts()
        return Handler.accounts
    def session_token(self):
        try:
            cookie=SimpleCookie(self.headers.get('Cookie',''))
            return cookie['stocklens_session'].value if 'stocklens_session' in cookie else ''
        except Exception:
            return ''
    def session_cookie(self,token,remove=False):
        secure='; Secure' if os.getenv('STOCKLENS_PUBLIC_ORIGIN','').startswith('https://') else ''
        return f'stocklens_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={0 if remove else 604800}'+secure
    def do_POST(self):
        path=urllib.parse.urlsplit(self.path).path
        if path not in ('/api/auth/signup','/api/auth/login','/api/auth/logout'):
            return self.send_json({'error':'Not found'},404)
        origins={f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'}
        public=os.getenv('STOCKLENS_PUBLIC_ORIGIN','').rstrip('/')
        if public: origins.add(public)
        if self.headers.get('Origin') not in origins:
            return self.send_json({'error':'Reload this page and try again.'},403)
        if self.headers.get_content_type()!='application/json':
            return self.send_json({'error':'Expected JSON'},415)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=16384: return self.send_json({'error':'Invalid request size'},413)
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict): raise ValueError()
        except (ValueError,TypeError): return self.send_json({'error':'Invalid request'},400)
        store=self.account_store()
        if path=='/api/auth/logout':
            store.logout(self.session_token())
            return self.send_json({'ok':True},cookie=self.session_cookie('',True))
        if not store.rate_limit(self.client_address[0]): return self.send_json({'error':'Too many attempts. Please try again in 10 minutes.'},429)
        try:
            token,user=store.register(data) if path.endswith('signup') else store.login(data)
            store.logout(self.session_token())
            return self.send_json({'user':user},201 if path.endswith('signup') else 200,cookie=self.session_cookie(token))
        except ValueError as error: return self.send_json({'error':str(error)},400 if path.endswith('signup') else 401)
    def log_message(self,*args):
        pass
    def do_GET(self):
        path=urllib.parse.urlsplit(self.path).path
        if path=='/api/auth/me':
            return self.send_json({'user':self.account_store().user(self.session_token())})
        if path=='/api/site':
            invite=os.getenv('STOCKLENS_COMMUNITY_URL','')
            parsed=urllib.parse.urlsplit(invite)
            if parsed.scheme!='https' or not parsed.netloc or parsed.username or parsed.password: invite=''
            support=os.getenv('STOCKLENS_SUPPORT_EMAIL','')
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',support): support=''
            return self.send_json({'communityAvailable':bool(invite),'communityUrl':invite if self.account_store().user(self.session_token()) else '', 'supportEmail':support,'localMode':not bool(os.getenv('STOCKLENS_PUBLIC_ORIGIN'))})
        if path=='/api/status':
            return self.send_json(self.feed.snapshot()['status'])
        if path=='/api/snapshot':
            return self.send_json(self.feed.snapshot())
        if path=='/api/stream':
            self.send_response(200)
            self.send_header('Content-Type','text/event-stream')
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Accel-Buffering','no')
            self.end_headers()
            try:
                previous=None
                while True:
                    data=json.dumps(self.feed.snapshot(),allow_nan=False,separators=(',',':'))
                    if data != previous:
                        self.wfile.write(('data: '+data+'\n\n').encode())
                        previous=data
                    else:
                        self.wfile.write(b': heartbeat\n\n')
                    self.wfile.flush()
                    time.sleep(1)
            except (BrokenPipeError,ConnectionResetError):
                return
        pages=('/', '/login', '/signup', '/community', '/about', '/help', '/contact', '/blog', '/updates', '/account', '/privacy', '/blog/reading-the-flow', '/blog/understanding-day-change', '/blog/a-focused-watchlist')
        files={route:'site.html' for route in pages}
        files.update({'/dashboard':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/site.css':'site.css','/site.js':'site.js','/terminal-preview.png':'terminal-preview.png'})
        filename=files.get(path)
        if not filename:
            self.send_error(404)
            return
        content=(ROOT/filename).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type',{'html':'text/html; charset=utf-8','js':'application/javascript','css':'text/css','png':'image/png'}[filename.rsplit('.',1)[1]])
        self.send_header('Content-Length',str(len(content)))
        self.send_header('Cache-Control','no-cache')
        self.end_headers()
        self.wfile.write(content)
    def send_json(self,value,status=200,cookie=None):
        content=json.dumps(value,allow_nan=False).encode()
        self.send_response(status)
        if cookie: self.send_header('Set-Cookie',cookie)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(content)))
        self.end_headers()
        self.wfile.write(content)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8765)
    args=parser.parse_args()
    Handler.feed=Feed()
    Handler.feed.start()
    print(f'Stocklens backend: http://127.0.0.1:{args.port} (provider token configured: {bool(Handler.feed.token)})',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
