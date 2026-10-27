import sys,tempfile,unittest,threading,json,http.client,os
from pathlib import Path
sys.path.insert(0,str(Path('.').resolve()))
from accounts import Accounts
from server import Handler,ThreadingHTTPServer
class SiteTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();Handler.accounts=Accounts(Path(cls.tmp.name)/'accounts.sqlite3')
  cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.port=cls.server.server_port
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
 def request(self,path,body=None,cookie='',origin=None):
  c=http.client.HTTPConnection('127.0.0.1',self.port);h={'Cookie':cookie}
  if body is not None:h.update({'Content-Type':'application/json','Origin':origin or f'http://127.0.0.1:{self.port}'})
  c.request('POST' if body is not None else 'GET',path,json.dumps(body) if body is not None else None,h);r=c.getresponse();status=r.status;headers=dict(r.getheaders());raw=r.read();c.close();return status,headers,raw
 def test_auth_lifecycle(self):
  data={'name':'QA Test','email':'qa@example.test','password':'local-test-password-2026'}
  status,h,b=self.request('/api/auth/signup',data);self.assertEqual(status,201);cookie=h['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Lax',cookie)
  self.assertEqual(json.loads(self.request('/api/auth/me',cookie=cookie)[2])['user']['name'],'QA Test')
  self.assertEqual(self.request('/api/auth/signup',dict(data,email='QA@EXAMPLE.TEST'))[0],400)
  self.assertEqual(self.request('/api/auth/login',dict(data,password='wrong-password'))[0],401)
  self.assertEqual(self.request('/api/auth/logout',{},cookie)[0],200)
  self.assertIsNone(json.loads(self.request('/api/auth/me',cookie=cookie)[2])['user'])
  self.assertEqual(self.request('/api/auth/login',data)[0],200)
  with Handler.accounts.db() as db:
   row=db.execute('SELECT password_hash FROM users').fetchone();self.assertNotEqual(row[0],data['password']);db.execute('UPDATE sessions SET expires=0')
  self.assertIsNone(Handler.accounts.user(cookie.split('=',1)[1].split(';')[0]))
 def test_origin_and_validation(self):
  self.assertEqual(self.request('/api/auth/signup',{},origin='https://other.example')[0],403)
  self.assertEqual(self.request('/api/auth/signup',{'name':'A','email':'bad','password':'short'})[0],400)
 def test_routes_and_private_files(self):
  for p in ['/','/dashboard','/login','/signup','/community','/about','/help','/contact','/blog','/updates','/account','/privacy','/blog/reading-the-flow','/blog/understanding-day-change','/blog/a-focused-watchlist','/site.js','/site.css','/terminal-preview.png']:
   self.assertEqual(self.request(p)[0],200,p)
  for p in ['/accounts.py','/.private/accounts.sqlite3','/.env','/../server.py']:self.assertEqual(self.request(p)[0],404,p)
 def test_community_gate(self):
  os.environ['STOCKLENS_COMMUNITY_URL']='https://example.test/community'
  try:
   self.assertEqual(json.loads(self.request('/api/site')[2])['communityUrl'],'')
   token,user=Handler.accounts.register({'name':'Community Test','email':'community@example.test','password':'local-test-password'})
   self.assertEqual(json.loads(self.request('/api/site',cookie='stocklens_session='+token)[2])['communityUrl'],'https://example.test/community')
  finally:os.environ.pop('STOCKLENS_COMMUNITY_URL',None)
if __name__=='__main__':unittest.main()
