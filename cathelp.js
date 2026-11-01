/* cathelp.js — CATALOG HELP: the arguments each command takes (press + on a highlighted catalog or menu item).
   [ ] marks optional arguments, like the CE's help screens. */
(function () {
'use strict';
const H = {
  // math
  'abs(': 'value', 'round(': 'value[,#decimals]', 'iPart(': 'value', 'fPart(': 'value', 'int(': 'value', 'min(': 'valueA,valueB  or  list', 'max(': 'valueA,valueB  or  list',
  'lcm(': 'valueA,valueB', 'gcd(': 'valueA,valueB', 'remainder(': 'dividend,divisor', 'nPr': 'n nPr r', 'nCr': 'n nCr r', '!': 'value!', 'randInt(': 'lower,upper[,#trials]',
  'randNorm(': 'μ,σ[,#trials]', 'randBin(': 'n,p[,#trials]', 'randIntNoRep(': 'lower,upper[,#numbers]', 'rand': 'rand[(#trials)]', 'log(': 'value', 'ln(': 'value', 'e^(': 'power', '10^(': 'power',
  'logBASE(': 'value,base', '√(': 'value', '³√(': 'value', 'ˣ√': 'xroot ˣ√ value', 'sin(': 'value', 'cos(': 'value', 'tan(': 'value', 'sin⁻¹(': 'value', 'cos⁻¹(': 'value', 'tan⁻¹(': 'value',
  'sinh(': 'value', 'cosh(': 'value', 'tanh(': 'value', 'sinh⁻¹(': 'value', 'cosh⁻¹(': 'value', 'tanh⁻¹(': 'value', 'conj(': 'value', 'real(': 'value', 'imag(': 'value', 'angle(': 'value',
  'nDeriv(': 'expression,variable,value[,H]', 'fnInt(': 'expression,variable,lower,upper[,tolerance]', 'Σ(': 'expression,variable,start,end', 'fMin(': 'expression,variable,lower,upper[,tolerance]',
  'fMax(': 'expression,variable,lower,upper[,tolerance]', 'solve(': 'expression,variable,guess[,{lower,upper}]', 'piecewise(': 'expression1,condition1[,expression2,condition2,…]',
  'toFrac(': 'value', 'not(': 'value',
  // lists
  'dim(': 'list  or  [matrix]', 'Fill(': 'value,list  or  value,[matrix]', 'seq(': 'expression,variable,begin,end[,increment]', 'cumSum(': 'list  or  [matrix]', 'ΔList(': 'list',
  'Select(': 'Xlistname,Ylistname', 'augment(': 'listA,listB  or  [A],[B]', 'List▶matr(': 'list1,…,list n,[matrix]', 'Matr▶list(': '[matrix],list1,…,list n', 'SortA(': 'list[,list2,…]',
  'SortD(': 'list[,list2,…]', 'mean(': 'list[,freqlist]', 'median(': 'list[,freqlist]', 'sum(': 'list[,start,end]', 'prod(': 'list[,start,end]', 'stdDev(': 'list[,freqlist]',
  'variance(': 'list[,freqlist]', 'ClrList ': 'list1[,list2,…]', 'SetUpEditor': '[list1,list2,…]', 'ʟ': 'ʟNAME (up to 5 letters or digits)',
  // matrices
  'det(': '[matrix]', 'identity(': 'dimension', 'randM(': '#rows,#columns', 'rref(': '[matrix]', 'ref(': '[matrix]', 'rowSwap(': '[matrix],rowA,rowB', 'row+(': '[matrix],rowA,rowB',
  '*row(': 'value,[matrix],row', '*row+(': 'value,[matrix],rowA,rowB',
  // distributions
  'normalpdf(': 'x[,μ,σ]', 'normalcdf(': 'lower,upper[,μ,σ]', 'invNorm(': 'area[,μ,σ,TAIL]', 'invT(': 'area,df', 'tpdf(': 'x,df', 'tcdf(': 'lower,upper,df', 'χ²pdf(': 'x,df',
  'χ²cdf(': 'lower,upper,df', 'Fpdf(': 'x,numerator df,denominator df', 'Fcdf(': 'lower,upper,numerator df,denominator df', 'binompdf(': 'trials,p[,x]', 'binomcdf(': 'trials,p[,x]',
  'poissonpdf(': 'μ,x', 'poissoncdf(': 'μ,x', 'geometpdf(': 'p,x', 'geometcdf(': 'p,x', 'ShadeNorm(': 'lower,upper[,μ,σ]', 'Shade_t(': 'lower,upper,df', 'Shadeχ²(': 'lower,upper,df',
  'ShadeF(': 'lower,upper,numerator df,denominator df',
  // stats
  '1-Var Stats ': '[Xlist,freqlist]', '2-Var Stats ': '[Xlist,Ylist,freqlist]', 'LinReg(ax+b) ': '[Xlist,Ylist,freqlist,Yvar]', 'LinReg(a+bx) ': '[Xlist,Ylist,freqlist,Yvar]',
  'QuadReg ': '[Xlist,Ylist,freqlist,Yvar]', 'CubicReg ': '[Xlist,Ylist,freqlist,Yvar]', 'QuartReg ': '[Xlist,Ylist,freqlist,Yvar]', 'LnReg ': '[Xlist,Ylist,freqlist,Yvar]',
  'ExpReg ': '[Xlist,Ylist,freqlist,Yvar]', 'PwrReg ': '[Xlist,Ylist,freqlist,Yvar]', 'Logistic ': '[Xlist,Ylist,freqlist,Yvar]', 'SinReg ': '[iterations,Xlist,Ylist,period,Yvar]',
  'Med-Med ': '[Xlist,Ylist,freqlist,Yvar]', 'Manual-Fit ': '[Yvar]', 'ANOVA(': 'list1,list2[,…,list20]', 'Plot1(': 'type,Xlist,Ylist[,mark,color]', 'Plot2(': 'type,Xlist,Ylist[,mark,color]',
  'Plot3(': 'type,Xlist,Ylist[,mark,color]', 'PlotsOn ': '[1,2,3]', 'PlotsOff ': '[1,2,3]',
  // finance
  'tvm_Pmt': '[N,I%,PV,FV,P/Y,C/Y]', 'tvm_I%': '[N,PV,PMT,FV,P/Y,C/Y]', 'tvm_PV': '[N,I%,PMT,FV,P/Y,C/Y]', 'tvm_N': '[I%,PV,PMT,FV,P/Y,C/Y]', 'tvm_FV': '[N,I%,PV,PMT,P/Y,C/Y]',
  'npv(': 'interest rate,CF0,CFList[,CFFreq]', 'irr(': 'CF0,CFList[,CFFreq]', 'bal(': 'npmt[,roundvalue]', 'ΣPrn(': 'pmt1,pmt2[,roundvalue]', 'ΣInt(': 'pmt1,pmt2[,roundvalue]',
  '▶Nom(': 'effective rate,compounding periods', '▶Eff(': 'nominal rate,compounding periods', 'dbd(': 'date1,date2',
  // draw / graph
  'Line(': 'X1,Y1,X2,Y2[,0 erase,color#]', 'Horizontal ': 'y[,color#]', 'Vertical ': 'x[,color#]', 'Tangent(': 'expression,value[,color#]', 'DrawF ': 'expression[,color#]',
  'Shade(': 'lowerfunc,upperfunc[,Xleft,Xright,pattern,patres,color#]', 'DrawInv ': 'expression[,color#]', 'Circle(': 'X,Y,radius[,color#]', 'Text(': 'row,column,"text"',
  'Pt-On(': 'X,Y[,mark,color#]', 'Pt-Off(': 'X,Y[,mark]', 'Pt-Change(': 'X,Y[,color#]', 'Pxl-On(': 'row,column[,color#]', 'Pxl-Off(': 'row,column', 'Pxl-Change(': 'row,column[,color#]',
  'pxl-Test(': 'row,column', 'StorePic ': 'number', 'RecallPic ': 'number', 'StoreGDB ': 'number', 'RecallGDB ': 'number', 'GraphStyle(': 'function#,style#', 'GraphColor(': 'function#,color#',
  'FnOn ': '[function#,function#,…]', 'FnOff ': '[function#,function#,…]', 'BorderColor ': '1–4', 'TextColor(': 'color#', 'Background ': 'image#  or  color#',
  // strings
  'length(': 'string', 'sub(': 'string,begin,length', 'inString(': 'string,substring[,start]', 'expr(': 'string', 'toString(': 'value[,format]', 'eval(': 'expression',
  'Equ▶String(': 'Y=var,Strn', 'String▶Equ(': 'string,Y=var',
  // programs
  'If ': 'condition', 'For(': 'variable,begin,end[,increment]', 'While ': 'condition', 'Repeat ': 'condition', 'Lbl ': 'label', 'Goto ': 'label', 'IS>(': 'variable,value', 'DS<(': 'variable,value',
  'Menu(': '"title","text1",label1[,…,"text7",label7]', 'Input ': '["text",variable]', 'Prompt ': 'variableA[,variableB,…]', 'Disp ': '[valueA,valueB,…]', 'Output(': 'row,column,"text"',
  'Pause ': '[value,time]', 'Wait ': 'time in seconds', 'DelVar ': 'variable', 'getKey': '(no arguments)', 'Fix ': '#decimals', 'checkTmr(': 'start time', 'startTmr': '(no arguments)',
  'setDate(': 'year,month,day', 'setTime(': 'hour,minute,second', 'timeCnv(': 'seconds', 'dayOfWk(': 'year,month,day'
};
window.CatalogHelp = { syntax: t => H[t] };
})();
