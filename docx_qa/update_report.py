from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
import openpyxl,collections
source=r'C:\Drive D\korean.study\Bao_cao_kiem_thu_Korean_Study.docx'
out=r'C:\Drive D\korean.study\Bao_cao_kiem_thu_Korean_Study_cap_nhat.docx'
xlsx=r'C:\Users\NHACPH~1\AppData\Local\Temp\browser-use\exports\Kiểm thử cuối kỳ-d8af43fa-9d91-496c-9e3d-32b3b977d54e.xlsx'
w=openpyxl.load_workbook(xlsx,data_only=True)
trs=[r for r in w['TR'].iter_rows(min_row=6,values_only=True) if r[0] and str(r[0]).startswith('TR-')]
tcs=[r for r in w['TC'].iter_rows(min_row=6,values_only=True) if r[0] and str(r[0]).startswith('TC-')]
d=Document(source)
# Replace a span between named paragraph headings with newly appended source-derived elements.
def replace(start,end,build):
  ps=d.paragraphs
  a=next(p._p for p in reversed(ps) if p.text.strip()==start)
  b=next(p._p for p in reversed(ps) if p.text.strip()==end)
  e=a.getnext()
  while e is not None and e is not b:
    n=e.getnext(); e.getparent().remove(e); e=n
  before=set(d._element.body)
  build()
  new=[e for e in d._element.body if e not in before and e.tag!=qn('w:sectPr')]
  for e in new: b.addprevious(e)
def p(t):
 x=d.add_paragraph(t); x.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY; return x
def h(t): d.add_heading(t,2)
def table(head,rows):
 t=d.add_table(rows=1,cols=len(head)); t.autofit=True
 pr=t._tbl.tblPr; borders=OxmlElement('w:tblBorders')
 for side in ['top','left','bottom','right','insideH','insideV']:
  el=OxmlElement('w:'+side); el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'4'); el.set(qn('w:color'),'808080'); borders.append(el)
 pr.append(borders)
 for c,v in zip(t.rows[0].cells,head): c.text=str(v)
 for c in t.rows[0].cells:
  for run in c.paragraphs[0].runs:run.bold=True
 for row in rows:
  for c,v in zip(t.add_row().cells,row): c.text=str(v); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
 for row in t.rows:
  for c in row.cells:
   for pp in c.paragraphs:
    pp.paragraph_format.space_after=Pt(3); pp.paragraph_format.line_spacing=1.1
    for rr in pp.runs:rr.font.name='Times New Roman';rr.font.size=Pt(11)
 d.add_paragraph()
# Revise introductory scope and conclusion that referenced only local unit tests.
for par in d.paragraphs:
 s=par.text
 if s.startswith('Mục tiêu là xây dựng yêu cầu'):
  par.text='Mục tiêu là đánh giá các chức năng giao diện của Korean Study theo bộ TR và test case UI của nhóm, tổng hợp kết quả thực hiện, nêu các ca chưa thể kết luận và đề xuất kiểm thử bổ sung. Kết quả test tự động ở mức đơn vị được trình bày riêng để tránh cộng lẫn hai phạm vi.'
 elif s.startswith('Trong phạm vi: xác thực'):
  par.text='Trong phạm vi là kiểm thử thủ công giao diện trên trình duyệt cho luồng người học và quản trị, responsive, audio/mic và thử quyền bằng cách nhập URL. Ngoài phạm vi bộ test UI: gọi API thủ công hoặc chỉnh request/token, truy vấn/sửa database, kiểm thử tải và kiểm tra bảo mật backend.'
 elif s.startswith('Báo cáo đã chuyển phạm vi'):
  par.text='Bộ kiểm thử UI của nhóm gồm 43 yêu cầu và 151 test case. Bảng ghi 145 Pass, 4 Blocked và 2 N/A; 37 test tự động mức đơn vị cũng đạt trong một lần chạy riêng. Nhóm cần bổ sung minh chứng, làm rõ các ca chưa kết luận và hoàn thiện hồ sơ trước khi quyết định phát hành hoặc đánh giá mức đạt CLO.'
 elif s.startswith('Ưu tiên thực thi TC phân quyền'):
  par.text='Ưu tiên chuẩn bị giáo trình có ít nhất hai bài và dữ liệu quản trị phù hợp để chạy lại các ca Blocked; rà soát hai ca N/A, bổ sung kết quả thực tế, ngày chạy và ảnh minh chứng. Sau đó mở rộng kiểm thử tích hợp, phân quyền backend/RLS, giao diện tự động và hiệu năng theo tiêu chí đã thống nhất.'
 elif s.startswith('[4] MAU_BAI'):
  par.text='[4] Bảng Google Sheets “Kiểm thử cuối kỳ”, các trang Tổng quan, TR và TC; bản xuất được đối chiếu ngày 31/10/2026. https://docs.google.com/spreadsheets/d/1lsi2AqWI-MGRllOD35w2YcrHlUN3LteW4iFnNysEMEU/edit'
# replace contents while retaining chapter headings

def ch3():
 h('3.1. Phương pháp và kỹ thuật thiết kế')
 p('Nhóm thiết kế test case giao diện theo Use Case, phân vùng tương đương (EP), phân tích giá trị biên (BVA) và bảng quyết định. Trong 151 TC có 114 Use Case, 24 EP, 10 BVA và 3 Decision Table; 116 ca ưu tiên High và 35 ca Medium.')
 h('3.2. Yêu cầu kiểm thử và phân bổ theo phân hệ')
 p('Trang TR ghi 43 yêu cầu, đều đã duyệt và đều có ít nhất một test case thiết kế. Bảng sau tổng hợp theo phân hệ; “Đã chạy” chỉ tính Pass hoặc Fail theo quy ước của bảng nhóm.')
 groups=collections.OrderedDict()
 for r in trs:
  q=groups.setdefault(r[1],[0,0,0]);q[0]+=1;q[1]+=int(r[7] or 0);q[2]+=int(r[8] or 0)
 table(['Phân hệ','TR','TC','Đã chạy'],[(k,*v) for k,v in groups.items()]+[('Tổng',43,151,145)])
 h('3.3. Kịch bản kiểm thử UI tiêu biểu')
 ids=['TC-AUTH-01-01','TC-AUTH-01-04','TC-HOME-02-01','TC-PREF-02-02','TC-ADM-01-01','TC-ADM-01-02']
 for id in ids:
  r=next(r for r in tcs if r[0]==id)
  h(f'{r[0]} — {r[1]}')
  p('Kịch bản: '+str(r[4]));p('Điều kiện: '+str(r[7]));p('Dữ liệu: '+str(r[8]));p('Các bước: '+str(r[9]).replace('\\n',' '));p('Mong đợi: '+str(r[10]));p('Thực tế: '+str(r[11] or 'Chưa ghi'));p('Trạng thái theo bảng: '+str(r[14]))
 p('Danh sách đầy đủ 43 TR và 151 TC, bao gồm điều kiện, bước và dữ liệu, được lưu trong bảng Google Sheets của nhóm; các mục trên là ví dụ trích chọn.')

def ch4():
 h('4.1. Môi trường thực nghiệm')
 p('Bảng nhóm mô tả kiểm thử thủ công giao diện bằng Google Chrome trên Windows tại https://nminmin.github.io/korean.study/. Phiên bản Chrome, Windows, build triển khai, cấu hình xác nhận email, múi giờ profile và thời gian đầy đủ của đợt chạy chưa được xác nhận trong bảng. Không mặc định build triển khai trùng mã nguồn local.')
 h('4.2. Kết quả thực thi UI')
 p('Theo trạng thái trong trang TC: 145 Pass, 0 Fail, 4 Blocked và 2 N/A trên 151 ca. Trong số này, trang TC ghi kết quả thực tế bằng chữ cho 136 ca; 150 ca chưa có ngày chạy, hai cột bằng chứng chưa có giá trị. Vì vậy số liệu thể hiện trạng thái nhóm đã ghi, chưa phải kết quả được xác minh độc lập bằng ảnh hoặc nhật ký đầy đủ.')
 p('Ba ca TC-HOME-02-01 đến 03 bị Blocked do chưa chuẩn bị giáo trình có bài thứ hai. TC-ADM-01-02 bị Blocked với ghi chú không có chức năng xem chi tiết. Hai ca TC-PREF-02-02 và TC-ADM-01-01 ghi N/A nhưng mô tả sự khác biệt về phạm vi dịch và biểu đồ; cần đối chiếu yêu cầu, xác nhận có áp dụng hay không trước khi giữ N/A hoặc chuyển trạng thái.')
 h('4.3. Test tự động và bằng chứng')
 p('Ngoài bộ UI của nhóm, ngày 30/10/2026 đã chạy riêng các tệp test tự động trong tests và backend/tests tại workspace: 37/37 đạt với Node hỗ trợ registerHooks. Lần chạy bằng Node 20.20.1 có một tệp không khởi chạy do thiếu API này. Không cộng 37 test tự động vào 151 ca UI vì đây là hai tập và phạm vi khác nhau.')
 p('Bảng nhóm chưa chứa liên kết hoặc giá trị trong hai cột bằng chứng. Cần bổ sung ảnh phù hợp, kết quả quan sát và ngày chạy để truy vết từng ca; không coi hình ảnh giao diện có sẵn trong repository là bằng chứng đã thực thi test.')

def ch5():
 h('5.1. Quy trình quản lý lỗi')
 p('Mỗi lỗi đã xác nhận cần mã lỗi, TC liên quan, môi trường, bước tái hiện, kết quả mong đợi và thực tế, ảnh, mức độ, ưu tiên và trạng thái; sau sửa phải kiểm thử lại. Trang TC không phải nhật ký bug độc lập, vì vậy không tự gán mã hoặc mức độ lỗi cho các ca chưa được nhóm xác nhận.')
 h('5.2. Vấn đề cần xác minh')
 table(['TC','Trạng thái bảng','Nội dung cần xử lý'],[['TC-HOME-02-01–03','Blocked','Chuẩn bị giáo trình có ít nhất hai bài, chạy lại các ca tiếp tục học.'],['TC-ADM-01-02','Blocked','Xác nhận yêu cầu xem chi tiết tài khoản và trạng thái chức năng.'],['TC-PREF-02-02','N/A','Xác nhận phạm vi ngôn ngữ được hỗ trợ trước khi đánh giá.'],['TC-ADM-01-01','N/A','Xác nhận yêu cầu nhãn thời gian biểu đồ trước khi đánh giá.']])
 h('5.3. Phân tích và theo dõi')
 p('Chưa có đủ bằng chứng để kết luận nguyên nhân gốc hoặc lập bug report cho các khác biệt trên. Nhóm cần tái hiện, đối chiếu yêu cầu đã duyệt và bổ sung môi trường, bằng chứng, sau đó phân loại Fail hoặc N/A theo kết quả. Vấn đề chạy test tự động với Node 20 là hạn chế môi trường kiểm thử, không tự động là lỗi sản phẩm.')

def ch6():
 h('6.1. Chỉ số theo bảng của nhóm')
 table(['Chỉ số','Giá trị và cách tính'],[['Tổng TR / TC','43 TR / 151 TC'],['Trạng thái UI','145 Pass; 0 Fail; 4 Blocked; 2 N/A'],['Pass trên ca đã chạy','145 / (145 + 0) = 100%; không gồm Blocked và N/A.'],['Pass trên tổng TC','145 / 151 = 96,03%; mẫu số bao gồm mọi trạng thái.'],['Bao phủ thiết kế TR','43 / 43 = 100% TR có ít nhất một TC.'],['Bao phủ thực thi TR','42 / 43 = 97,67% TR có ít nhất một TC Pass hoặc Fail; không có nghĩa mọi TC đã chạy.'],['Mật độ lỗi','Chưa tính vì chưa có danh sách defect đã xác nhận.']])
 h('6.2. Phân tích hiệu quả')
 p('145 ca được ghi Pass là kết quả khả quan trong phạm vi UI đã nêu, song 100% chỉ tính trên 145 ca Pass/Fail và không chứng minh toàn bộ chức năng đạt. Bốn ca bị chặn, hai ca N/A cần rà soát; bằng chứng, ngày chạy và kết quả thực tế còn thiếu. Kiểm thử backend, bảo mật toàn diện và hiệu năng không nằm trong phạm vi bộ UI.')
 h('6.3. Quyết định phát hành')
 p('Chưa đủ cơ sở đưa ra Go/No-Go: cần thống nhất tiêu chí nghiệm thu, xử lý các ca chưa kết luận, xác minh các quan sát N/A và bổ sung minh chứng, đồng thời đánh giá các phạm vi quan trọng chưa được kiểm thử.')

def ch7():
 h('7.1. Phân công test case')
 p('Theo cột Người kiểm thử trong trang TC, tỷ lệ dưới đây là phân bổ số ca, không phản ánh mức hoàn thành hoặc đóng góp thực tế.')
 table(['Thành viên','Số TC được giao','Tỷ lệ'],[['Tạ Trần Vinh Quang','50','33,11%'],['Võ Nhạc Phước','49','32,45%'],['Nguyễn Danh Nghĩa','52','34,44%'],['Tổng','151','100%']])
 h('7.2. Công cụ và nhật ký')
 p('Nhóm theo dõi TR và TC trong Google Sheets; môi trường dự kiến là Chrome trên Windows. Bảng ghi ngày chạy 30/10/2026 cho một ca, 150 ca còn lại chưa có ngày; không suy đoán thời gian thực hiện của các ca đó. Phân công công việc ngoài test case và lịch trình chi tiết chưa có căn cứ trong bảng.')
 h('7.3. Đánh giá thành viên')
 p('Nhóm tự xác nhận nhiệm vụ thực tế, mức hoàn thành, tỷ lệ đóng góp và chữ ký. Số TC được giao không thay thế đánh giá đóng góp.')
 table(['Thành viên','Nhiệm vụ thực tế','Tự đánh giá / chữ ký'],[[n,'Nhóm bổ sung','Chưa đánh giá'] for n in ['Tạ Trần Vinh Quang','Võ Nhạc Phước','Nguyễn Danh Nghĩa']])
replace('CHƯƠNG 3: THIẾT KẾ YÊU CẦU VÀ KỊCH BẢN KIỂM THỬ','CHƯƠNG 4: TRIỂN KHAI THỰC THI KIỂM THỬ VÀ KẾT QUẢ',ch3)
replace('CHƯƠNG 4: TRIỂN KHAI THỰC THI KIỂM THỬ VÀ KẾT QUẢ','CHƯƠNG 5: QUẢN LÝ LỖI VÀ PHÂN TÍCH DEFECT',ch4)
replace('CHƯƠNG 5: QUẢN LÝ LỖI VÀ PHÂN TÍCH DEFECT','CHƯƠNG 6: ĐÁNH GIÁ KẾT QUẢ VÀ ĐO LƯỜNG',ch5)
replace('CHƯƠNG 6: ĐÁNH GIÁ KẾT QUẢ VÀ ĐO LƯỜNG','CHƯƠNG 7: TỔ CHỨC THỰC HIỆN VÀ ĐÁNH GIÁ THÀNH VIÊN',ch6)
replace('CHƯƠNG 7: TỔ CHỨC THỰC HIỆN VÀ ĐÁNH GIÁ THÀNH VIÊN','CHƯƠNG 8: TỔNG KẾT VÀ HƯỚNG PHÁT TRIỂN',ch7)
d.save(out); print(out)

