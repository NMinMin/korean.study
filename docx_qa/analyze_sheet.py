import openpyxl, collections
p=r'C:\Users\NHACPH~1\AppData\Local\Temp\browser-use\exports\Kiểm thử cuối kỳ-d8af43fa-9d91-496c-9e3d-32b3b977d54e.xlsx'
w=openpyxl.load_workbook(p,data_only=True)
for s in w:
 print('\nSHEET',s.title,s.max_row,s.max_column)
 if s.title=='Tổng quan':
  for row in s.iter_rows(values_only=True):
   v=[str(x) for x in row if x is not None]
   if v: print(' | '.join(v)[:700])
 if s.title=='TR':
  rows=[r for r in s.iter_rows(min_row=6,values_only=True) if r[0] and str(r[0]).startswith('TR-')]; print('TR',len(rows)); print('modules',collections.Counter(r[1] for r in rows)); print('design run sums',sum((r[7] or 0) for r in rows),sum((r[8] or 0) for r in rows));
 if s.title=='TC':
  rows=[r for r in s.iter_rows(min_row=6,values_only=True) if r[0] and str(r[0]).startswith('TC-')]; print('TC',len(rows));
  for i in [2,3,5,6,14,15]: print('COLUMN',i,collections.Counter(str(r[i]) for r in rows))
  print('results nonempty',sum(bool(r[11]) for r in rows),'evidence',sum(bool(r[12] or r[13]) for r in rows))
  print('FAIL/BLOCKED',[(r[0],r[2],r[4],r[11],r[14]) for r in rows if str(r[14]).lower() not in ('pass','none','not run','chưa chạy','')]);
  print('SAMPLES');
  for r in rows:
   if r[14] and str(r[14]).lower()!='pass': print(r[0],r[1],r[2],r[4],r[11],r[14])
