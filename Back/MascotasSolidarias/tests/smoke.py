"""Run after dotnet build -c Release. Python 3 standard library only. No external payment calls."""
import base64, hashlib, hmac, json, os, pathlib, shutil, socket, sqlite3, subprocess, sys, tempfile, time, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
DLL=ROOT/'src/Mascotas.Api/bin/Release/net10.0/Mascotas.Api.dll'
DOTNET=os.environ.get('DOTNET','dotnet')
PHOTO='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JZQAAAAASUVORK5CYII='
PHOTO_BYTES=base64.b64decode(PHOTO)
def run(mode):
    with socket.socket() as s: s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
    data=tempfile.mkdtemp(prefix='mascotas-test-'); secret=base64.b64encode(b'0'*32).decode()
    env=dict(os.environ, ASPNETCORE_ENVIRONMENT='Development', ASPNETCORE_URLS=f'http://127.0.0.1:{port}', App__DataDirectory=data, App__Mode=mode, App__ImageProvider='Demo' if mode=='Demo' else 'Http', App__ImageServiceUrl='https://example.invalid/generate', App__ImageServiceKey='test', App__ApiKey='test-not-real',App__ApiKeyId='api-test',App__WebhookSecret='whsec_'+secret)
    p=subprocess.Popen([DOTNET,str(DLL)],env=env,cwd=ROOT/'src/Mascotas.Api',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def req(method,path,body=None,token=None,headers=None):
        h={'Content-Type':'application/json',**(headers or {})}
        if token: h['Authorization']='Bearer '+token
        raw=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
        r=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=raw,headers=h,method=method)
        try:
            with urllib.request.urlopen(r) as res: return res.status,res.read()
        except urllib.error.HTTPError as e:return e.code,e.read()
    try:
        for _ in range(100):
            try:
                if req('GET','/health')[0]==200:break
            except Exception:pass
            time.sleep(.1)
        else:raise AssertionError('Server did not start')
        c,b=req('POST','/api/orders/',{'amountMxn':0.001});assert c==400
        c,b=req('POST','/api/orders/',{'amountMxn':10});assert c==201,(c,b)
        result=json.loads(b); oid=result['id'];token=result['orderToken'];path='/api/orders/'+oid
        assert req('GET',path)[0]==404
        assert req('POST',path+'/photo',PHOTO_BYTES,token=token,headers={'Content-Type':'image/png'})[0]==409
        if mode=='Demo':
            c,b=req('POST',path+'/qr',token=token);assert c==200,(c,b)
            first=json.loads(b)
            assert json.loads(req('POST',path+'/qr',token=token)[1])['qrId']==first['qrId']
            assert req('POST',path+'/simulate-payment',token=token)[0]==200
            assert req('POST',path+'/photo',PHOTO_BYTES,token=token,headers={'Content-Type':'image/png'})[0]==202
            for _ in range(50):
                state=json.loads(req('GET',path,token=token)[1])['status']
                if state=='READY':break
                time.sleep(.1)
            assert state=='READY'
            c,b=req('GET',path+'/download',token=token);assert c==200 and b'DEMO' in b
            assert req('POST',path+'/photo',PHOTO_BYTES,token=token,headers={'Content-Type':'image/png'})[0]==200
        else:
            assert req('POST',path+'/simulate-payment',token=token)[0]==404
            # Seed a provider QR without calling pey. Test only verified inbound events.
            with sqlite3.connect(pathlib.Path(data)/'mascotas.db') as db:
                db.execute('UPDATE Orders SET Status=?, QrId=?, QrExpiresAt=? WHERE Id=?',('PENDING_PAYMENT','qr-test',int(time.time())+900,oid))
            payload={'type':'codi.qr.payment_received','amount':10,'apiKeyId':'api-test','codiQrId':'qr-test','transactionId':'tx-test','datePaid':int(time.time())}
            def event(obj,wid='event-1',bad=False,offset=0):
                raw=json.dumps(obj,separators=(',',':')).encode();ts=str(int(time.time())+offset)
                sig=base64.b64encode(hmac.new(b'0'*32,f'{wid}.{ts}.'.encode()+raw,hashlib.sha256).digest()).decode()
                return req('POST','/api/webhooks/pey',raw,headers={'webhook-id':wid,'webhook-timestamp':ts,'webhook-signature':'v1,'+('bad' if bad else sig)})
            assert event(payload,bad=True)[0]==401
            assert event(payload,offset=-400)[0]==401
            assert event({**payload,'amount':9})[0]==400
            assert event({**payload,'apiKeyId':'other'})[0]==400
            assert event(payload)[0]==200
            assert event(payload)[0]==200
            assert event(payload,'event-2')[0]==200
            assert json.loads(req('GET',path,token=token)[1])['status']=='PAID'
        print(mode,': PASS')
    finally:p.terminate();p.wait(timeout=10);shutil.rmtree(data,ignore_errors=True)
run('Demo');run('Pey');print('All tests passed. No pey or image service requests were made.')
