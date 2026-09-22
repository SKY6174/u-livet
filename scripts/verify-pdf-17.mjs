// No database writes; generated files contain only synthetic test data.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { PDFDocument, PDFName } from 'pdf-lib';
const require = createRequire(import.meta.url);
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} }; modules.set(file, module);
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const { requirePdf17 } = load('src/lib/pdf/version.ts');
const { createPdf17, toPdf17DataUri } = load('src/lib/pdf/browser.ts');
const { getPdfPageSlices } = load('src/lib/pdf/report-export.ts');
const { renderCertificate } = load('src/lib/certificates/pdf.ts');
const { GET: getPdfAsset } = load('src/app/api/pdf-assets/[...path]/route.ts');
const output = 'tmp/pdfs/pdf17'; mkdirSync(output, {recursive:true});
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }
await test('jsPDF writes real 1.7 pages with portrait and landscape dimensions', async () => {
  const pdf = await createPdf17({format:'a4',unit:'mm'});
  pdf.text('Synthetic PDF 1.7 test',20,20); pdf.addPage('a4','landscape'); pdf.text('Second page',20,20);
  const bytes = requirePdf17(pdf.output('arraybuffer'));
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(),2);
  assert(Math.abs(parsed.getPage(0).getWidth()-595.28)<0.1);
  assert(Math.abs(parsed.getPage(1).getWidth()-841.89)<0.1);
  assert((await toPdf17DataUri(bytes)).startsWith('data:application/pdf;base64,JVBERi0xLjc'));
  writeFileSync(`${output}/generated.pdf`,bytes);
});
await test('other versions and truncated headers cannot be relabelled as PDF 1.7', async () => {
  for(const header of ['%PDF-1.4\n','%PDF-2.0\n','%PDF-1.7','%PDF-1.70','not a pdf']) {
    const bytes = new TextEncoder().encode(header);
    const before = bytes.slice();
    assert.throws(()=>requirePdf17(bytes)); assert.deepEqual(bytes,before);
  }
});
await test('Edge PDF parser accepts generated output and rejects malformed or incompatible catalogs', async () => {
  const source=readFileSync('supabase/functions/instructor-documents/index.ts','utf8');
  const decoder=source.slice(source.indexOf('async function decodeExpertGeneratedPdf('),source.indexOf('async function advisoryIntakeContext('));
  const code=ts.transpileModule(decoder,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const decode=new Function('PDFDocument','PDFName','VoteFunctionError','base64ToBytes','MAX_EXPERT_GENERATED_PDF_BYTES',code+';return decodeExpertGeneratedPdf;')(
    PDFDocument,PDFName,Error,value=>new Uint8Array(Buffer.from(value,'base64')),10*1024*1024);
  const uri=bytes=>'data:application/pdf;base64,'+Buffer.from(bytes).toString('base64');
  const valid=readFileSync(`${output}/generated.pdf`);
  assert.deepEqual(Buffer.from(await decode(uri(valid))),valid);
  for(const header of ['%PDF-1.4','%PDF-2.0']) {
    const bad=Buffer.from(valid);bad.write(header);await assert.rejects(decode(uri(bad)));
  }
  await assert.rejects(decode(uri(Buffer.from('%PDF-1.7\ninvalid'))));
  const override=await PDFDocument.load(valid);override.catalog.set(PDFName.of('Version'),PDFName.of('2.0'));
  await assert.rejects(decode(uri(await override.save())));
});
await test('completion and teaching certificates keep Korean content and explicit 1.7 catalog', async () => {
  for(const kind of ['COMPLETION','TEACHING']) {
    const bytes = await renderCertificate({id:'synthetic',nonce:'test',number:`TEST-${kind}-001`,issue_date:'2026-09-22',token:'synthetic-verification-token',seal:null,
      snapshot:{kind,person_name:'가상 강사',person_id:'synthetic',offering_id:'synthetic',course_name:'PDF 1.7 검증용 과정',starts_on:'2026-09-01',ends_on:'2026-09-22',
        evidence:{minutes:120,logs:[{title:'가상 강의',starts_at:'2026-09-21T01:00:00Z',minutes:120}]},
        issuer:{organization_name:'가상 검증 기관',title:'기관장',holder_name:'테스트',seal_omission_basis:'검증 자료',test_only:true},
        template:{title:kind==='COMPLETION'?'이수증':'강의경력증명서',body:'PDF 버전 확인을 위한 가상 자료입니다.',version:'test',layout:'v1'}}},'https://uc-life.org');
    requirePdf17(bytes);
    const parsed=await PDFDocument.load(bytes);
    assert.equal(parsed.catalog.get(PDFName.of('Version')).toString(),'/1.7');
    assert(parsed.getPageCount()>=1);
    writeFileSync(`${output}/${kind.toLowerCase()}.pdf`,bytes);
  }
});
await test('pagination keeps rows together and neither drops nor duplicates pixels', () => {
  const slices=getPdfPageSlices(2600,1000,[{top:950,bottom:1050},{top:1800,bottom:2100}]);
  assert.deepEqual(slices,[{top:0,height:950},{top:950,height:850},{top:1800,height:800}]);
  assert.equal(slices.reduce((sum,s)=>sum+s.height,0),2600);
  assert.deepEqual(getPdfPageSlices(2200,1000,[{top:0,bottom:2200}]),[{top:0,height:1000},{top:1000,height:1000},{top:2000,height:200}]);
  const aligned=getPdfPageSlices(2200,1000,[],(_top,end)=>end-20);
  assert.deepEqual(aligned,[{top:0,height:980},{top:980,height:980},{top:1960,height:240}]);
  assert.equal(aligned.reduce((sum,s)=>sum+s.height,0),2200);
  assert.throws(()=>getPdfPageSlices(10,0,[]));
});
await test('pinned PDF CMaps, fonts and codecs are served without exposing arbitrary files', async () => {
  const version=JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json','utf8')).version;
  for(const [kind,name] of [['cmaps','Adobe-Korea1-UCS2.bcmap'],['standard_fonts','FoxitSerif.pfb'],['wasm','openjpeg.wasm']]) {
    const response=await getPdfAsset(null,{params:Promise.resolve({path:[version,kind,name]})});
    assert.equal(response.status,200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync(`node_modules/pdfjs-dist/${kind}/${name}`));
    assert.match(response.headers.get('cache-control'),/immutable/);
  }
  for(const parts of [['bad','cmaps','Adobe-Korea1-UCS2.bcmap'],[version,'..','.env.local'],[version,'cmaps','../package.json'],[version,'__proto__','x.js'],[version,'wasm','missing.wasm'],[version,'wasm','openjpeg.wasm','extra']]) {
    const response=await getPdfAsset(null,{params:Promise.resolve({path:parts})});
    assert.equal(response.status,404);
  }
});
console.log(`${checks} PDF 1.7 checks passed. Synthetic outputs: ${output}`);
