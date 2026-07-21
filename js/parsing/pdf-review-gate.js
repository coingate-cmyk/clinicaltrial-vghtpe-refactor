(function(root,factory){
 const parsing=typeof module==='object'&&module.exports?require('./import-pipeline.js'):(root.ClinicalTrialApp&&root.ClinicalTrialApp.parsing)||{};
 const api=factory(parsing);if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.ClinicalTrialApp=root.ClinicalTrialApp||{};root.ClinicalTrialApp.parsing=Object.assign(root.ClinicalTrialApp.parsing||{},api);}
})(typeof globalThis!=='undefined'?globalThis:this,function(parsing){'use strict';
 function recalc(actions){return(actions||[]).reduce((c,a)=>{c[a.type]=(c[a.type]||0)+1;return c;},{total:(actions||[]).length,add:0,update:0,unchanged:0,review:0,invalid:0,duplicate_in_file:0});}
 const originalPlan=parsing.planImport;
 function planImport(rawRecords,existingTrials,options){const plan=originalPlan(rawRecords,existingTrials,options);plan.actions.forEach(action=>{const raw=action.candidate&&action.candidate.raw;if(!raw||!raw._requiresReview||['invalid','duplicate_in_file'].includes(action.type))return;action.type='review';action.proposed=action.proposed||(action.candidate&&action.candidate.trial);action.reasons=(action.reasons||[]).concat((raw._parseIssues||[]).map(issue=>({code:issue.code||'PDF_REVIEW',field:issue.field||'',message:`PDF 欄位需人工確認：${issue.field||issue.code||'unknown'}`})));});plan.summary=recalc(plan.actions);return plan;}
 const originalApply=parsing.applyImportPlan;
 function applyImportPlan(existingTrials,plan,selections){const selected=selections||{},adapted=Object.assign({},plan,{actions:(plan&&plan.actions||[]).map((action,index)=>{const choice=selected[index],decision=typeof choice==='string'?choice:choice&&choice.decision;if(action.type==='review'&&!action.existing&&action.proposed&&decision==='accept')return Object.assign({},action,{type:'add'});return action;})});return originalApply(existingTrials,adapted,selections);}
 parsing.planImport=planImport;parsing.applyImportPlan=applyImportPlan;
 return{planImport,applyImportPlan};
});