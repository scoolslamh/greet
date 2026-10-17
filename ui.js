/* Presentation only: no requests, storage or changes to workflow data. */
(function(){
  function init(){
    const journey=document.querySelector('.journey');
    const schoolDetails=document.getElementById('schoolDetails');
    if(schoolDetails){const narrow=window.matchMedia('(max-width:760px)');const adapt=()=>{schoolDetails.open=!narrow.matches;};adapt();narrow.addEventListener('change',adapt);}
    function refreshJourney(){
      if(!journey)return;
      const phases=['school','countStep','guardStep','censusStep','reviewStep'];
      const section=document.getElementById('guardsSection');
      let current=0;
      if(section && !section.hidden)current=phases.findIndex((id,i)=>i>0 && document.getElementById(id) && !document.getElementById(id).hidden);
      if(current<0)current=0;
      const approved=document.querySelector('.status')?.textContent.trim()==='مكتملة';
      if(approved)current=4;
      journey.querySelectorAll('.flow-step').forEach((step,index)=>{step.classList.toggle('is-active',index===current);step.classList.toggle('is-done',index<current || approved);if(index===current)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
      const name=document.getElementById('schoolName')?.textContent;
      if(name && name!=='—' && document.getElementById('schoolSummary').textContent!==name)document.getElementById('schoolSummary').textContent=name;
    }
    refreshJourney();
    if(journey)new MutationObserver(refreshJourney).observe(document.getElementById('mainContent'),{subtree:true,attributes:true,attributeFilter:['hidden'],childList:true,characterData:true});
    document.querySelectorAll('.scroll').forEach(container=>{container.tabIndex=0;container.setAttribute('aria-label','جدول التقرير، يمكن تمريره أفقيًا لعرض جميع الأعمدة');const hint=document.createElement('p');hint.className='table-hint';hint.textContent='مرّر الجدول أفقيًا لعرض جميع الحقول.';container.before(hint);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

