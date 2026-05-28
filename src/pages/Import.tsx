import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { parseSEBCSV, parseSEBXLSX, parseAvanzaCSV, parseAvanzaXLSX, parseKlarnaCSV, parseCSNCSV } from '../utils/parsers';
import { Card, CardHeader } from '../components/ui/Card';
import { Upload, CheckCircle, AlertCircle, Trash2, Copy, Plus, FileSpreadsheet } from 'lucide-react';
import { getMonthlyData, formatSEK, formatMonth } from '../utils/calculations';
import { motion } from 'framer-motion';

type SimpleFileType = 'seb_csv' | 'seb_xlsx' | 'klarna' | 'csn';
interface SimpleConfig { type: SimpleFileType; label: string; description: string; accept: string; format: string; color: string; }

const SIMPLE_TYPES: SimpleConfig[] = [
  { type: 'seb_csv', label: 'SEB Konto (CSV)', description: 'Kontoutdrag från SEB — transaktionskonto / privatkonto', accept: '.csv', format: 'Bokföringsdatum;Valutadatum;...;Text;Belopp;Saldo', color: 'text-green-600 bg-green-50' },
  { type: 'seb_xlsx', label: 'SEB Lönekonto (Excel)', description: 'Excel-fil från SEB — lönekonto eller annat SEB-konto', accept: '.xlsx,.xls', format: 'Samma kolumner som CSV men i Excel-format', color: 'text-blue-600 bg-blue-50' },
  { type: 'klarna', label: 'Klarna (CSV)', description: 'GDPR-export: Klarna-appen → Inställningar → Integritet', accept: '.csv', format: 'date,merchant,amount (variabla kolumnnamn)', color: 'text-pink-600 bg-pink-50' },
  { type: 'csn', label: 'CSN (CSV)', description: 'Export av CSN-utbetalningar — bidrag och lån separeras automatiskt', accept: '.csv', format: 'datum;typ;belopp', color: 'text-orange-600 bg-orange-50' },
];

function SimpleDropZone({ config, onParsed }: { config: SimpleConfig; onParsed: (label: string, count: number) => void }) {
  const { addTransactions, transactions } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const existingCount = transactions.filter(t => t.source === config.type).length;

  const handleFile = async (file: File) => {
    setStatus('loading');
    try {
      let parsed;
      if (config.type === 'seb_csv') parsed = parseSEBCSV(await file.text());
      else if (config.type === 'seb_xlsx') parsed = parseSEBXLSX(await file.arrayBuffer());
      else if (config.type === 'klarna') parsed = parseKlarnaCSV(await file.text());
      else parsed = parseCSNCSV(await file.text());
      addTransactions(parsed);
      setStatus('success');
      setMessage(`${parsed.length} transaktioner`);
      onParsed(config.label, parsed.length);
    } catch (e) { setStatus('error'); setMessage('Parsningsfel: ' + String(e)); }
  };

  return (
    <div className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragging?'border-blue-400 bg-blue-50':status==='success'?'border-green-300 bg-green-50':status==='error'?'border-red-300 bg-red-50':'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
      onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
      <input ref={inputRef} type="file" accept={config.accept} className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
          {status==='success'?<CheckCircle size={15}/>:status==='error'?<AlertCircle size={15}/>:<Upload size={15}/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">{config.label}</p>
            {existingCount>0&&<span className="text-[11px] text-gray-400">{existingCount} importerade</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
          {message?<p className={`text-xs mt-1 font-medium ${status==='success'?'text-green-600':'text-red-500'}`}>{message}</p>:<p className="text-[10px] text-gray-400 mt-1 font-mono">{config.format}</p>}
        </div>
      </div>
    </div>
  );
}

interface AvanzaFile { id: string; name: string; count: number; error?: string; }

function AvanzaDropZone({ onParsed }: { onParsed: (label: string, count: number) => void }) {
  const { addTransactions, transactions } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<AvanzaFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const avanzaTotal = transactions.filter(t => t.source === 'avanza').length;
  const avanzaAccounts = [...new Set(transactions.filter(t=>t.source==='avanza').map(t=>t.account))];

  const handleFiles = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      const fid = `${file.name}-${Date.now()}`;
      try {
        const isXLSX = /\.(xlsx|xls)$/i.test(file.name);
        const parsed = isXLSX ? parseAvanzaXLSX(await file.arrayBuffer()) : parseAvanzaCSV(await file.text());
        addTransactions(parsed);
        setFiles(prev=>[...prev,{id:fid,name:file.name,count:parsed.length}]);
        onParsed(`Avanza (${file.name})`, parsed.length);
      } catch(e) { setFiles(prev=>[...prev,{id:fid,name:file.name,count:0,error:String(e)}]); }
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center"><FileSpreadsheet size={14}/></div>
          <div>
            <p className="text-sm font-medium text-gray-800">Avanza — flera konton</p>
            <p className="text-xs text-gray-500">CSV eller Excel, ett eller flera konton</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avanzaTotal>0&&<span className="text-[11px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">{avanzaTotal} rader · {avanzaAccounts.length} konton</span>}
          <button onClick={()=>inputRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-white border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50">
            <Plus size={12}/> Lägg till fil
          </button>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={e=>{if(e.target.files?.length)handleFiles(e.target.files);}} />
      <div className={`p-4 ${dragging?'bg-purple-50':'bg-white'}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}>
        {avanzaAccounts.length>0&&<div className="flex flex-wrap gap-1.5 mb-3">{avanzaAccounts.map(a=><span key={a} className="text-[11px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100">{a}</span>)}</div>}
        {files.length>0&&<div className="space-y-1 mb-3">{files.map(f=><div key={f.id} className="flex items-center gap-2 text-xs">{f.error?<AlertCircle size={12} className="text-red-400"/>:<CheckCircle size={12} className="text-green-500"/>}<span className="text-gray-600 truncate">{f.name}</span>{f.error?<span className="text-red-400 ml-auto">{f.error}</span>:<span className="text-gray-400 ml-auto">{f.count} rader</span>}</div>)}</div>}
        <div onClick={()=>inputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer ${dragging?'border-purple-400 bg-purple-50':'border-gray-200 hover:border-purple-300 hover:bg-gray-50'}`}>
          <Upload size={16} className="mx-auto mb-1 text-gray-300"/>
          <p className="text-xs text-gray-400">Dra och släpp filer, eller <span className="text-purple-500 font-medium">klicka för att välja</span></p>
          <p className="text-[10px] text-gray-300 mt-0.5 font-mono">Datum;Konto;Typ;Värdepapper;Antal;Kurs;Belopp · CSV eller XLSX</p>
        </div>
        <div className="mt-3 flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
          <CheckCircle size={12} className="text-blue-500 mt-0.5 flex-shrink-0"/>
          <p className="text-[11px] text-blue-700"><strong>Överföringar matchas automatiskt.</strong> Insättningar och uttag (SEB↔Avanza) räknas aldrig som utgifter.</p>
        </div>
      </div>
    </div>
  );
}

function CopyToClaudeButton() {
  const { transactions } = useStore();
  const [copied, setCopied] = useState(false);
  const generate = () => {
    const monthly = getMonthlyData(transactions);
    const last3 = monthly.slice(-3);
    const accounts = [...new Set(transactions.filter(t=>t.source==='avanza').map(t=>t.account))];
    const lines = [
      '# Min ekonomi — analys för Claude', '',
      accounts.length>0 ? `Avanza-konton: ${accounts.join(', ')}` : '',
      '', '## Månadsöversikt (senaste 3 månader)',
      ...last3.map(m => [
        `### ${formatMonth(m.month)}`,
        `- Inkomst: ${formatSEK(m.income)}`,
        `- Utgifter: ${formatSEK(m.expenses)}`,
        `- Kassaflöde: ${formatSEK(m.cashflow)}`,
        'Utgifter per kategori:',
        ...Object.entries(m.byCategory).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  - ${k}: ${formatSEK(v)}`),
        '',
      ].join('\n')),
      `Totalt (exkl. överföringar): ${transactions.filter(t=>!t.isTransfer).length} transaktioner`,
      '', '## Fråga', 'Analysera min ekonomi. Vad sticker ut? Var kan jag spara? Vilka trender ser du?',
    ].filter(l=>l!==null);
    return lines.join('\n');
  };
  const copy = async () => { await navigator.clipboard.writeText(generate()); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <button onClick={copy} className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
      {copied?<CheckCircle size={14} className="text-green-400"/>:<Copy size={14}/>}
      {copied?'Kopierat!':'Kopiera till Claude'}
    </button>
  );
}

export default function Import() {
  const { transactions, clearTransactions } = useStore();
  const [importLog, setImportLog] = useState<string[]>([]);
  const nonTransfer = transactions.filter(t=>!t.isTransfer);
  const transferCount = transactions.filter(t=>t.isTransfer).length;
  const logImport = (label: string, count: number) => setImportLog(l=>[`${label}: ${count} importerade`,,...l]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Importera data</h1>
          <p className="text-sm text-gray-400 mt-0.5">{nonTransfer.length>0?`${nonTransfer.length} transaktioner · ${transferCount} överföringar (exkluderade)`:'Ingen data importerad ännu'}</p>
        </div>
        <div className="flex items-center gap-3">
          {nonTransfer.length>0&&<CopyToClaudeButton/>}
          {transactions.length>0&&<button onClick={()=>{if(confirm('Rensa all data?'))clearTransactions();}} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 px-3 py-2.5 rounded-xl border border-red-200 hover:bg-red-50"><Trash2 size={14}/> Rensa</button>}
        </div>
      </div>
      <div className="p-6 space-y-4">
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>
          <Card>
            <CardHeader title="Ladda upp filer" subtitle="Alla filer processas lokalt — ingen data skickas"/>
            <div className="space-y-3">
              <AvanzaDropZone onParsed={logImport}/>
              {SIMPLE_TYPES.map(cfg=><SimpleDropZone key={cfg.type} config={cfg} onParsed={logImport}/>)}
            </div>
          </Card>
        </motion.div>
        {importLog.length>0&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}}>
            <Card><CardHeader title="Importlogg"/>
              <div className="space-y-1">{importLog.map((log,i)=><div key={i} className="flex items-center gap-2 text-xs text-gray-600"><CheckCircle size={12} className="text-green-500 flex-shrink-0"/>{log}</div>)}</div>
            </Card>
          </motion.div>
        )}
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
          <Card>
            <CardHeader title="Hur exporterar jag?" subtitle="Guide för varje källa"/>
            <div className="space-y-4">
              {[
                {title:'SEB',steps:['Logga in på seb.se','Konto → välj konto → Kontoutdrag','Välj datumintervall → Exportera CSV eller Excel','Upprepa för varje SEB-konto']},
                {title:'Avanza — ett konto i taget',steps:['Logga in på avanza.se','Min ekonomi → Transaktioner','Välj konto i dropdown (ISK, KF, etc.)','Välj datumintervall → Exportera CSV','Upprepa för varje konto och ladda upp alla filer']},
                {title:'Klarna',steps:['Öppna Klarna-appen','Inställningar → Integritet → Ladda ner min data','Välj transaktionsdata → ladda ner CSV']},
                {title:'CSN',steps:['Logga in på csn.se','Mina sidor → Mina lån och bidrag → Utbetalningar','Exportera som CSV']},
              ].map(({title,steps})=>(
                <div key={title}>
                  <p className="font-semibold text-gray-800 text-sm mb-1.5">{title}</p>
                  <ol className="list-decimal list-inside space-y-0.5">{steps.map((s,i)=><li key={i} className="text-xs text-gray-500">{s}</li>)}</ol>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
