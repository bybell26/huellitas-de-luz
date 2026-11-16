const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
function load(file,dependencies,extra={}) {
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const ctx={exports:{},URL,console,...extra,require:name=>{if(!(name in dependencies))throw Error('Unexpected import '+name);return dependencies[name]}};
 vm.runInNewContext(code,ctx);return ctx.exports;
}
test('API usa Metro en desarrollo y dirección explícita en builds',()=>{
 const api=load('lib/config.ts',{'expo-constants':{expoConfig:{hostUri:'192.168.1.20:8081'}}},{__DEV__:true,process:{env:{}}});
 assert.equal(api.getApiBase(),'http://192.168.1.20:4000');
 const prod=load('lib/config.ts',{'expo-constants':{}},{__DEV__:false,process:{env:{EXPO_PUBLIC_API_URL:'https://api.example/'}}});
 assert.equal(prod.getApiBase(),'https://api.example');
 const missing=load('lib/config.ts',{'expo-constants':{}},{__DEV__:false,process:{env:{}}});
 assert.throws(()=>missing.getApiBase(),/EXPO_PUBLIC_API_URL/);
});
test('sin sala no se puede anunciar guardado exitoso',async()=>{
 let saves=0;
 const hooks=load('hooks/useRoom.ts',{react:{useState:x=>[x,()=>{}],useRef:x=>({current:x}),useEffect:()=>{}},'../lib/api':{apiSavePet:async()=>{saves++}},'../lib/ws':{}});
 await assert.rejects(hooks.useRoom(null).addPet({id:'pey-one'}),/sala/);
 assert.equal(saves,0);
});
test('la sala guardada de otra cuenta nunca se reutiliza',async()=>{
 let stored='ajena-1234';
 const api=load('lib/active-room.ts',{'expo-secure-store':{getItemAsync:async()=>stored,setItemAsync:async(k,v)=>{stored=v}},'./api':{apiGetRooms:async()=>[{code:'nova-1234'}],apiCreateRoom:async()=>{throw Error('No crear')}}});
 assert.equal(await api.ensureOwnRoom(),'nova-1234');
 assert.equal(stored,'nova-1234');
});
