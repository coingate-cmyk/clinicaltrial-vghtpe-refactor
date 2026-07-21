'use strict';
const assert=require('assert');
const integrity=require('../js/parsing/pdf-field-integrity.js');
Object.assign(integrity,require('../js/parsing/pdf-study-status-support.js'));
require('../js/parsing/pdf-contact-block.js');
const parser=require('../js/parsing/pdf-study-status-parser.js');
function item(text,x,width){return{text,x,width:width||Math.max(8,text.length*5),height:10};}
function line(y,items){return{y,text:items.map(x=>x.text).join(' '),items};}
function header(){return line(790,[item('Study Title',30,70),item('Protocol Number',200,55),item('主要收案條件',260,80),item('Phase',420,30),item('Sponsor',450,35),item('Target',480,25),item('已收案人數',505,35),item('當月簽署人數',540,40),item('當月入案人數',588,38),item('PI',628,15),item('Study Nurse / Phone',652,85)]);}
const pages=[
 {pageNumber:1,width:842,lines:[header(),line(760,[item('First trial',30,70),item('A-080',200,35),item('PI A',628,22),item('Nurse A',652,42)]),line(650,[item('Cross-page trial title',30,120)])]},
 {pageNumber:2,width:842,lines:[header(),line(750,[item('WO42758',200,45),item('PI B',628,22),item('Amy Lin',652,40)]),line(742,[item('0912345678',652,55)]),line(734,[item('LINE ID amy080',652,75)]),line(680,[item('Wrapped code study',30,100),item('DESTINY-',200,45)]),line(674,[item('Biliary Tract',200,55)])]}
];
const result=parser.parseStudyStatusPages(pages);
assert.strictEqual(result.records.length,3);
assert.strictEqual(result.records[1].code,'WO42758');
assert.ok(result.records[1].title.includes('Cross-page trial title'));
assert.deepStrictEqual(result.records[1].source.pages,[1,2]);
assert.ok(result.records[1].nurse.includes('Amy Lin'));
assert.ok(result.records[1].phone.includes('0912345678'));
assert.ok(result.records[1].lineId.includes('amy080'));
assert.strictEqual(result.records[2].code,'DESTINY- Biliary Tract');
console.log('study-status-cross-page.test.js: all tests passed');