"""Local account/session storage. Database and secrets are never static assets."""
from contextlib import contextmanager
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
import time
from pathlib import Path

EMAIL = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
TTL = 7 * 86400
class Accounts:
    def __init__(self, path=None):
        self.path=Path(path or os.getenv('STOCKLENS_ACCOUNT_DB',Path(__file__).parent/'.private/accounts.sqlite3'))
        self.path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.lock=threading.Lock()
        self.attempts={}
        with self.db() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires INTEGER NOT NULL);''')
        self.path.chmod(0o600)
        self.dummy_salt=secrets.token_hex(16)
    @contextmanager
    def db(self):
        db=sqlite3.connect(self.path,timeout=10)
        db.row_factory=sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()
    def rate_limit(self, address):
        now=time.time()
        with self.lock:
            self.attempts={k:[t for t in v if now-t<600] for k,v in self.attempts.items() if any(now-t<600 for t in v)}
            attempts=self.attempts.setdefault(address,[])
            if len(attempts)>=20: return False
            attempts.append(now)
        return True
    @staticmethod
    def password_hash(password,salt):
        return hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
    def register(self,data):
        name=str(data.get('name','')).strip();email=str(data.get('email','')).strip().lower();password=data.get('password','')
        if not 1<=len(name)<=80: raise ValueError('Enter your name (up to 80 characters).')
        if len(email)>254 or not EMAIL.fullmatch(email): raise ValueError('Enter a valid email address.')
        if not isinstance(password,str) or not 10<=len(password)<=128: raise ValueError('Use a password between 10 and 128 characters.')
        salt=secrets.token_hex(16);encoded=self.password_hash(password,salt)
        try:
            with self.db() as db:
                cur=db.execute('INSERT INTO users(name,email,salt,password_hash,created) VALUES (?,?,?,?,?)',(name,email,salt,encoded,int(time.time())))
                uid=cur.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError('Unable to create this account. Try signing in instead.')
        return self.new_session(uid)
    def login(self,data):
        email=str(data.get('email','')).strip().lower();password=data.get('password','')
        if not isinstance(password,str) or not 1<=len(password)<=128: raise ValueError('Email or password is incorrect.')
        with self.db() as db: row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
        encoded=self.password_hash(password,row['salt'] if row else self.dummy_salt)
        if not row or not hmac.compare_digest(encoded,row['password_hash']): raise ValueError('Email or password is incorrect.')
        return self.new_session(row['id'])
    def new_session(self,uid):
        token=secrets.token_urlsafe(32)
        with self.db() as db:
            db.execute('DELETE FROM sessions WHERE expires<=?',(int(time.time()),))
            db.execute('INSERT INTO sessions VALUES (?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),uid,int(time.time())+TTL))
        return token,self.user(token)
    def user(self,token):
        if not token or len(token)>200: return None
        with self.db() as db:
            row=db.execute('SELECT users.id,name,email,created FROM users JOIN sessions ON users.id=sessions.user_id WHERE token_hash=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),int(time.time()))).fetchone()
        return dict(row) if row else None
    def logout(self,token):
        with self.db() as db: db.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
