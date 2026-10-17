/* School credentials remain in memory; the local sandbox supplies number-only school access. */
let workflowToken = '';
let workflowSchoolId = '';
let workflowRevision = 0;
let workflowStatus = 'تجربة محلية';
let workflowCensus = {};
let workflowSchoolData = {};
let workflowBusy = false;
const censusStep = document.createElement('div');censusStep.id='censusStep';censusStep.hidden=true;
censusStep.innerHTML='<h3>حصر بيانات البوابات والتغطية الأمنية</h3><p class="notice">استكمل بيانات الحصر. يحسب الفائض والعجز بعد إدخال عدد أفراد التغطية الحالي والعدد اللازم.</p><form id="censusForm" novalidate><div id="censusFields" class="grid"></div><div class="actions"><button id="censusBackBtn" type="button" class="secondary">السابق: الحراس</button><button type="submit">التالي: مراجعة البيانات كاملة</button></div></form>';
$('guardsSection').appendChild(censusStep);
const censusReview=document.createElement('div');censusReview.id='censusReview';$('reviewList').after(censusReview);
const confirmation=document.createElement('label');confirmation.innerHTML='<input id="reviewConfirmed" type="checkbox"> أقر بمراجعة بيانات المدرسة والحراس وحصر البوابات والتغطية الأمنية.';$('reviewStep').appendChild(confirmation);
function prepareCensus(){
  const school=Object.keys(workflowSchoolData).length?workflowSchoolData:(typeof publicSchool!=='undefined'?publicSchool:{});
  const counts={ministry:Number($('ministryCount').value),company:Number($('companyCount').value)};
  workflowCensus=SchoolCensus.prefill(workflowCensus,school,counts);
  return workflowCensus;
}
function readCensus(){
  if(!$('censusStep').hidden)SchoolCensus.fields.filter(f=>f.type!=='computed').forEach(f=>{workflowCensus[f.key]=$('census_'+f.key).value;});
  return prepareCensus();
}
function validateCensus(){return SchoolCensus.normalize(readCensus(),{complete:true,school:workflowSchoolData}).errors[0]||'';}
function updateCensusCalculations(){
  prepareCensus();
  SchoolCensus.fields.filter(field=>field.countField).forEach(field=>{$('census_'+field.key).value=SchoolCensus.blank(workflowCensus[field.key])?'':String(workflowCensus[field.key]);});
  const calculation=SchoolCensus.calculate(workflowCensus);
  $('census_hasSurplus').value=calculation.hasSurplus;
  $('census_deficit').value=calculation.deficit===null?'':String(calculation.deficit);
}
function renderCensus(){
  prepareCensus();showStep('censusStep');const list=$('censusFields');list.replaceChildren();
  SchoolCensus.fields.forEach(field=>{
    const entry=document.createElement('div');entry.className='entry';
    const label=document.createElement('label');label.htmlFor='census_'+field.key;label.textContent=field.label;
    const input=document.createElement(field.type==='select'?'select':'input');input.id='census_'+field.key;input.name=field.key;
    if(field.type==='select'){
      const empty=document.createElement('option');empty.value='';empty.textContent='اختر';input.appendChild(empty);
      field.options.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;input.appendChild(option);});
    }else if(field.type==='number'){input.type='number';input.min='0';input.step='1';input.inputMode='numeric';}
    else{input.type='text';input.maxLength=200;}
    input.value=SchoolCensus.blank(workflowCensus[field.key])?'':String(workflowCensus[field.key]);
    if(field.type==='computed'){input.readOnly=true;input.setAttribute('aria-live','polite');input.tabIndex=-1;}
    else{
      input.required=true;
      if(field.schoolField || field.countField)input.readOnly=true;
      input.addEventListener('input',()=>{workflowCensus[field.key]=input.value;updateCensusCalculations();});
      input.addEventListener('change',()=>{workflowCensus[field.key]=input.value;if(field.countField)censusCountOverrides.add(field.key);updateCensusCalculations();});
    }
    entry.append(label,input);list.appendChild(entry);
  });
  updateCensusCalculations();
}
$('censusBackBtn').addEventListener('click',()=>{readCensus();if(steps.length){currentIndex=steps.length-1;renderGuard();}else showStep('countStep');});
$('censusForm').addEventListener('submit',event=>{event.preventDefault();const error=validateCensus();if(error){showMessage(error,true);return;}workflowCensus=SchoolCensus.normalize(workflowCensus,{school:workflowSchoolData}).census;renderReview();});
const originalReview=renderReview;
renderReview=function(){
  originalReview();const view=$('censusReview');view.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='مراجعة حصر البوابات والتغطية الأمنية';view.appendChild(heading);
  const normalized=SchoolCensus.normalize(prepareCensus(),{school:workflowSchoolData}).census;
  SchoolCensus.fields.forEach(field=>appendReviewText(view,field.label,SchoolCensus.blank(normalized[field.key])?'لم يُدخل':String(normalized[field.key])));
  const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='تعديل بيانات الحصر';edit.addEventListener('click',renderCensus);view.appendChild(edit);
  $('reviewConfirmed').checked=false;updateWorkflowButtons();
};
const originalRenderGuard=renderGuard;
renderGuard=function(){originalRenderGuard();if(!guardLookupReady())$('lookupStatus').textContent='أدخل السجل المدني ثم اضغط جلب البيانات.';};
function updateWorkflowButtons(){
  const complete=steps.every(s=>missingGuardFields(s).length===0) && !validateCensus();
  $('saveDraftBtn').disabled=!workflowToken||workflowBusy||workflowStatus==='مكتملة'||!complete;
  $('approveBtn').disabled=$('saveDraftBtn').disabled||!$('reviewConfirmed').checked;
}
$('reviewConfirmed').addEventListener('change',updateWorkflowButtons);
async function workflowApi(action,extra={}) {
  const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:workflowToken,schoolId:workflowSchoolId,revision:workflowRevision,...extra}),redirect:'follow'});
  if(!response.ok)throw new Error('تعذر الاتصال بالخدمة.');
  const result=await response.json();if(!result.success)throw new Error(result.message||'تعذر تنفيذ الطلب.');return result;
}
function loadWorkflowState(result){
  workflowRevision=result.state.revision;workflowStatus=result.state.status;workflowSchoolData=result.school||workflowSchoolData;workflowCensus=result.state.census||{};
  steps=['ministry','company'].flatMap(employer=>Array.from({length:result.state.counts[employer]},(_,i)=>({employer,data:result.state.guards.filter(g=>g.employer===employer)[i]||{},reference:null})));
  steps.forEach(s=>{if(s.data.source==='reference')s.reference={...s.data,...s.data.originals};});
  $('ministryCount').value=result.state.counts.ministry;$('companyCount').value=result.state.counts.company;updateTotal();
  document.querySelector('.status').textContent=workflowStatus;
  document.querySelector('.status').nextElementSibling.textContent='حالة البيانات المسجلة في سير العمل المعتمد.';
  const notice=$('guardsSection').querySelector('.notice');notice.textContent='جلسة مفوضة خاصة بالمدرسة. البيانات الشخصية متاحة ضمن صلاحية المدرسة فقط.';
  $('lookupBtn').textContent='جلب البيانات';
  $('guardsSection').querySelectorAll('.hint').forEach(el=>{if(el.id!=='changeStatus')el.hidden=true;});
  $('guardsSection').hidden=workflowStatus==='مكتملة';
  if(workflowStatus==='مكتملة')showMessage('تم اعتماد المدرسة وإغلاقها أمام التعديل. إعادة الفتح بصلاحية مدير النظام فقط.');
  else if(result.state.revision===0 && !steps.length)showStep('countStep');
  else if(steps.some(s=>missingGuardFields(s).length)){currentIndex=steps.findIndex(s=>missingGuardFields(s).length);renderGuard();}else if(validateCensus())renderCensus();else renderReview();
}
$('authorizationForm').addEventListener('submit',async event=>{
  event.preventDefault();if(workflowBusy)return;workflowBusy=true;
  try {
    workflowToken=$('accessCode').value.trim();$('accessCode').value='';
    const number=new URLSearchParams(window.location.search).get('schoolNumber');
    const url=new URL(API_URL);url.searchParams.set('action','schoolLookup');url.searchParams.set('schoolNumber',number);
    const response=await fetch(url);const school=await response.json();if(!school.success)throw new Error('تعذر التحقق من المدرسة.');
    workflowSchoolId=school.school.schoolId;
    const result=await workflowApi('load');loadWorkflowState(result);
    if(workflowStatus!=='مكتملة')showMessage('تم فتح جلسة المدرسة المفوضة.');
  } catch(error){workflowToken='';showMessage(error.message,true);}
  finally{workflowBusy=false;updateWorkflowButtons();}
});
$('logoutBtn').addEventListener('click',()=>{workflowToken='';window.location.reload();});
// Replace the existing listener through a dispatcher without exposing the reference registry.
$('lookupBtn').removeEventListener('click',lookupDemoGuard);
$('lookupBtn').addEventListener('click',async()=>{
  if(!workflowToken){lookupDemoGuard();return;}
  if(workflowBusy)return;
  const step=steps[currentIndex],index=currentIndex,id=$('nationalId').value.trim();
  if(!/^[12]\d{9}$/.test(id)){showMessage('رقم الهوية غير صالح.',true);return;}
  workflowBusy=true;step.reference=null;step.lookupId=null;setGuardDetails(false);setGuardBusy(true);
  try {
    const result=await workflowApi('guardLookup',{nationalId:id,employer:step.employer});
    if(index!==currentIndex||$('nationalId').value.trim()!==id)return;
    const guard=result.guard;step.reference=guard?{...guard}:null;
    editableFields.forEach(field=>{$(field).value=guard?guard[field]||'':'';});
    step.lookupId=id; $('active').value=guard?'نعم':'';setGuardDetails(true);
    $('lookupStatus').textContent=guard?'تم جلب البيانات. راجعها وأكمل المطلوب.':'لا توجد بيانات لهذا السجل المدني. أدخل بيانات الحارس يدويًا ثم احفظها.';updateChangeStatus();
  }catch(error){showMessage(error.message,true);}finally{workflowBusy=false;setGuardBusy(false);}
});
async function persistWorkflow(action){
  if(workflowBusy||!workflowToken)return;
  if(validateCensus()||steps.some(s=>missingGuardFields(s).length)){showMessage('أكمل بيانات الحراس ونموذج الحصر أولًا.',true);return;}
  workflowBusy=true;updateWorkflowButtons();
  try {
    const result=await workflowApi(action,{confirmed:$('reviewConfirmed').checked,draft:{counts:{ministry:steps.filter(s=>s.employer==='ministry').length,company:steps.filter(s=>s.employer==='company').length},guards:steps.map(s=>({...s.data,employer:s.employer})),census:readCensus()}});
    loadWorkflowState(result);showMessage(action==='approve'?'تم الاعتماد النهائي وإغلاق المدرسة.':'تم حفظ المسودة بنجاح.');
  }catch(error){showMessage(error.message,true);}finally{workflowBusy=false;updateWorkflowButtons();}
}
$('saveDraftBtn').addEventListener('click',()=>persistWorkflow('save'));
$('approveBtn').addEventListener('click',()=>persistWorkflow('approve'));
window.addEventListener('beforeunload',()=>{workflowToken='';});

const progressButton=document.createElement('button');progressButton.type='button';progressButton.textContent='حفظ التقدم الحالي';progressButton.hidden=true;$('authorization').appendChild(progressButton);
progressButton.addEventListener('click',async()=>{
 if(!workflowToken||workflowBusy||workflowStatus==='مكتملة')return;
 if(!$('guardStep').hidden && steps[currentIndex])steps[currentIndex].data=readGuard();
 const valid=steps.filter(s=>missingGuardFields(s).length===0);

 workflowBusy=true;
 try{
  const result=await workflowApi('save',{draft:{counts:{ministry:Number($('ministryCount').value),company:Number($('companyCount').value)},guards:valid.map(s=>({...s.data,employer:s.employer})),census:readCensus()}});
  workflowRevision=result.state.revision;workflowStatus=result.state.status;document.querySelector('.status').textContent=workflowStatus;showMessage('تم حفظ التقدم الحالي والحراس المكتملين وبيانات الحصر المدخلة. استكمل البيانات قبل الاعتماد.');
 }catch(error){showMessage(error.message,true);}finally{workflowBusy=false;updateWorkflowButtons();}
});
const stateLoader=loadWorkflowState;
loadWorkflowState=function(result){stateLoader(result);progressButton.hidden=result.state.status==='مكتملة';};

$('resetBtn').addEventListener('click',()=>{workflowCensus={};});

function setGuardBusy(busy){$('lookupBtn').disabled=busy;$('lookupBtn').textContent=busy?'جارٍ جلب البيانات...':'جلب البيانات';$('nationalId').readOnly=busy;$('previousBtn').disabled=busy;$('nextBtn').disabled=busy||!guardLookupReady();$('guardDetails').disabled=busy||!guardLookupReady();}
async function saveGuardProgress(){
 if(!workflowToken){showMessage('تم تجهيز بيانات الحارس داخل الصفحة.');return;}
 if(workflowBusy)throw new Error('انتظر انتهاء العملية الحالية.');
 workflowBusy=true;setGuardBusy(true);$('lookupBtn').textContent='جلب البيانات';$('nextBtn').textContent='جارٍ الحفظ...';
 try{
  const valid=steps.filter(step=>missingGuardFields(step).length===0);
  const result=await workflowApi('save',{draft:{counts:{ministry:Number($('ministryCount').value),company:Number($('companyCount').value)},guards:valid.map(step=>({...step.data,employer:step.employer})),census:readCensus()}});
  workflowRevision=result.state.revision;workflowStatus=result.state.status;document.querySelector('.status').textContent=workflowStatus;showMessage('تم حفظ بيانات الحارس بنجاح.');
 }finally{workflowBusy=false;setGuardBusy(false);$('nextBtn').textContent=currentIndex===steps.length-1?'حفظ والانتقال إلى نموذج الحصر':'حفظ ومتابعة الحارس التالي';}
}
