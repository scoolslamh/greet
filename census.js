/** Census fields A:Q from the supplied workbook. Keep Census.js synchronized via tools/sync-census.cjs. */
var SchoolCensus = (function () {
  const fields = [
    {key:'educationRegion',label:'منطقة التعليم',type:'text',schoolField:'educationRegion',fixedValue:'عسير'},
    {key:'city',label:'المدينة',type:'text',schoolField:'governorate'},
    {key:'schoolName',label:'اسم المدرسة',type:'text',schoolField:'schoolName'},
    {key:'affiliation',label:'تبعية المدرسة',type:'select',options:['الوزارة','جهات أخرى']},
    {key:'classification',label:'تصنيف المدرسة',type:'select',options:['ابتدائية','متوسطة','ثانوية','أخرى']},
    {key:'population',label:'الكثافة البشرية للمدرسة',type:'number'},
    {key:'totalGates',label:'عدد البوابات الإجمالي',type:'number'},
    {key:'usedGates',label:'البوابات المستخدمة للدخول والخروج',type:'number'},
    {key:'coverageType',label:'نوع التغطية',type:'select',options:['بوابين تطوير','حراس الوزارة','كليهما']},
    {key:'coverageExtent',label:'مدى التغطية',type:'select',options:['على مدار اليوم','جزئية 8 ساعات']},
    {key:'currentPersonnel',label:'عدد أفراد التغطية الحالي',type:'number',countField:'total'},
    {key:'requiredPersonnel',label:'إجمالي أفراد التغطية اللازم لمدى التغطية',type:'number'},
    {key:'hasSurplus',label:'هل يوجد فائض أفراد؟',type:'computed'},
    {key:'deficit',label:'العجز',type:'computed'},
    {key:'risk',label:'خطورة المدرسة',type:'select',options:['منخفضة','متوسطة','مرتفع']},
    {key:'companyGatekeepers',label:'عدد البوابين الحاليين (تطوير)',type:'number',countField:'company'},
    {key:'ministryGuards',label:'عدد الحراس (الوزارة)',type:'number',countField:'ministry'}
  ];
  const blank = value => value === null || value === undefined || String(value).trim() === '';
  function number(value) {
    if(blank(value))return null;
    if(!['string','number'].includes(typeof value) || !/^\d+$/.test(String(value).trim()))return NaN;
    const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:NaN;
  }
  function calculate(census) {
    const current=number(census.currentPersonnel),required=number(census.requiredPersonnel);
    if(current===null || required===null || !Number.isFinite(current) || !Number.isFinite(required))return {hasSurplus:'',deficit:null,surplusCount:null};
    return {hasSurplus:current>required?'نعم':'لا',deficit:Math.max(required-current,0),surplusCount:Math.max(current-required,0)};
  }
  function countValue(field,counts){
    if(!field.countField || !counts)return undefined;
    if(field.countField==='total'){
      const ministry=number(counts.ministry),company=number(counts.company);
      return ministry!==null && company!==null && Number.isFinite(ministry) && Number.isFinite(company)?ministry+company:undefined;
    }
    return counts[field.countField];
  }
  function normalize(input,options) {
    input=input||{};options=options||{};const census={},errors=[];
    fields.filter(f=>f.type!=='computed').forEach(field=>{
      const schoolValue=field.fixedValue || (field.schoolField && options.school && options.school[field.schoolField]);
      const derivedCount=countValue(field,options.counts);
      const known=!blank(derivedCount)?derivedCount:schoolValue;
      const raw=!blank(known)?known:input[field.key];
      if(field.type==='number') {
        const value=number(raw);census[field.key]=Number.isFinite(value)?value:null;
        if(Number.isNaN(value))errors.push(field.label+': أدخل عددًا صحيحًا غير سالب.');
        else if(value===null && options.complete)errors.push(field.label+': مطلوب.');
      }else{
        const value=blank(raw)?'':String(raw).trim();census[field.key]=value;
        if(value.length>200)errors.push(field.label+': النص طويل.');
        if(field.options && value && !field.options.includes(value))errors.push(field.label+': اختر قيمة من القائمة.');
        if(!value && options.complete)errors.push(field.label+': مطلوب.');
      }
    });
    if(census.totalGates!==null && census.usedGates!==null && census.usedGates>census.totalGates)errors.push('عدد البوابات المستخدمة لا يتجاوز عدد البوابات الإجمالي.');
    const result=calculate(census);census.hasSurplus=result.hasSurplus;census.deficit=result.deficit;
    const ordered={};fields.forEach(field=>{ordered[field.key]=census[field.key];});
    return {census:ordered,errors};
  }
  function prefill(input,school,counts) {
    const result={...(input||{})};
    fields.forEach(field=>{
      const schoolValue=field.fixedValue || (field.schoolField && school && school[field.schoolField]);
      if(!blank(schoolValue))result[field.key]=schoolValue;
      const count=countValue(field,counts);if(!blank(count))result[field.key]=count;
    });
    return result;
  }
  return {fields,blank,number,calculate,normalize,prefill};
})();
if(typeof module!=='undefined' && module.exports)module.exports=SchoolCensus;
