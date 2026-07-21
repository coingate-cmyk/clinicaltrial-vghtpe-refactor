(function(root,factory){
 const parsing=typeof module==='object'&&module.exports?require('./pdf-field-integrity.js'):(root.ClinicalTrialApp&&root.ClinicalTrialApp.parsing)||{};
 const api=factory(parsing);if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.ClinicalTrialApp=root.ClinicalTrialApp||{};root.ClinicalTrialApp.parsing=Object.assign(root.ClinicalTrialApp.parsing||{},api);}
})(typeof globalThis!=='undefined'?globalThis:this,function(parsing){'use strict';
 if(parsing.CRITICAL_FIELDS&&parsing.CRITICAL_FIELDS.add)parsing.CRITICAL_FIELDS.add('contactRaw');
 function isKnownStudyStatusPage(page){const h=(page&&page.lines||[]).slice(0,10).map(x=>x.text||'').join(' ');return /study\s*title/i.test(h)&&/代號/.test(h)&&/主要收案條件/.test(h)&&/study\s*nurse/i.test(h);}
 function buildStudyStatusColumns(pageWidth){const width=Number(pageWidth||842);const b=[27.358,197.17,253.088,416.259,447.402,478.909,501.955,537.525,585.098,625.766,649.658,692.237,723.962,752.369,779.099,803.074,832.538].map(v=>v/842*width);const f=['title','code','inclusion','phase','sponsor','targetCount','enrolledCount','monthlySignedCount','monthlyEnrolledCount','pi','contactRaw','notes','__contractNo','__presenter','__conferencePlanned','__followUp'];return f.map((field,i)=>({field,original:field,x:(b[i]+b[i+1])/2,end:b[i+1],left:b[i],right:b[i+1]}));}
 function typicalLineGap(lines,start){const gaps=[];(lines||[]).slice(start||0).forEach((line,i,a)=>{if(!i)return;const g=Math.abs(Number(line.y||0)-Number(a[i-1].y||0));if(g>=2&&g<=20)gaps.push(g);});if(!gaps.length)return 7;gaps.sort((a,b)=>a-b);const m=Math.floor(gaps.length/2);return gaps.length%2?gaps[m]:(gaps[m-1]+gaps[m])/2;}
 return{isKnownStudyStatusPage,buildStudyStatusColumns,typicalLineGap};
});