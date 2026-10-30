from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from pathlib import Path
p=Path(r'E:\KiemThu\Template báo cáo.docx')
d=Document(p)
body=d._element.body
# Keep the reference cover and section properties, replace instructional sample body.
for el in list(body):
    if el.tag==qn('w:sectPr'): continue
    if el.tag==qn('w:p'):
        txt=''.join(el.itertext())
        if 'MỤC LỤC' in txt: break
    continue
els=list(body); cutoff=next(i for i,e in enumerate(els) if e.tag==qn('w:p') and 'MỤC LỤC' in ''.join(e.itertext()))
for e in els[cutoff:]:
    if e.tag!=qn('w:sectPr'): body.remove(e)
style=d.styles['Normal']; style.font.name='Times New Roman'; style.font.size=Pt(13)
style.paragraph_format.space_after=Pt(6); style.paragraph_format.line_spacing=1.3
for name in ['Heading 1','Heading 2']:
    s=d.styles[name]; s.font.name='Times New Roman'; s.font.color.rgb=RGBColor(0,0,0); s.font.bold=True
    s.font.size=Pt(15 if name=='Heading 1' else 13)
    s.paragraph_format.space_before=Pt(12); s.paragraph_format.space_after=Pt(6)
def para(t='', bold=False):
    x=d.add_paragraph(); x.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY; x.add_run(t).bold=bold; return x
def heading(t,level=1): d.add_heading(t,level)
def table(headers,rows):
    t=d.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=True
    for c,v in zip(t.rows[0].cells,headers): c.text=v
    for c in t.rows[0].cells:
        for r in c.paragraphs[0].runs:r.bold=True
    for row in rows:
        cells=t.add_row().cells
        for c,v in zip(cells,row): c.text=str(v); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for row in t.rows:
        for c in row.cells:
            for pp in c.paragraphs:
                pp.paragraph_format.space_after=Pt(3); pp.paragraph_format.line_spacing=1.1
                for rr in pp.runs: rr.font.name='Times New Roman'; rr.font.size=Pt(11)
    d.add_paragraph()
def section(t): d.add_page_break(); heading(t)
heading('MỤC LỤC')
for s in ['CHƯƠNG 1: TỔNG QUAN VÀ GIỚI THIỆU ĐỀ TÀI','CHƯƠNG 2: PHÂN TÍCH YÊU CẦU HỆ THỐNG','CHƯƠNG 3: THIẾT KẾ YÊU CẦU VÀ KỊCH BẢN KIỂM THỬ','CHƯƠNG 4: TRIỂN KHAI THỰC THI KIỂM THỬ VÀ KẾT QUẢ','CHƯƠNG 5: QUẢN LÝ LỖI VÀ PHÂN TÍCH DEFECT','CHƯƠNG 6: ĐÁNH GIÁ KẾT QUẢ VÀ ĐO LƯỜNG','CHƯƠNG 7: TỔ CHỨC THỰC HIỆN VÀ ĐÁNH GIÁ THÀNH VIÊN','CHƯƠNG 8: TỔNG KẾT VÀ HƯỚNG PHÁT TRIỂN','TÀI LIỆU THAM KHẢO VÀ PHỤ LỤC']: para(s)
para('Các đề mục chi tiết được đánh số trong từng chương. Cập nhật số trang sau khi hoàn thiện nội dung và mở tài liệu trong Word.')
section('CHƯƠNG 1: TỔNG QUAN VÀ GIỚI THIỆU ĐỀ TÀI')
heading('1.1. Giới thiệu đề tài và bài toán thực tế',2)
para('Korean Study là ứng dụng web hỗ trợ học tiếng Hàn theo giáo trình. Người học có thể theo dõi tiến độ, học từ vựng và ngữ pháp, luyện nghe chép, shadowing và ôn tập. Ứng dụng cũng có chức năng cộng đồng, xếp hạng và quản trị nội dung. Các luồng học và lưu tiến độ cần được kiểm tra để hạn chế mất dữ liệu, tính điểm sai và truy cập trái quyền.')
heading('1.2. Mục tiêu và phạm vi kiểm thử',2)
para('Mục tiêu là xây dựng yêu cầu và kịch bản kiểm thử phù hợp với chức năng của project; kiểm tra các quy tắc nghiệp vụ có bộ kiểm thử tự động; nhận diện những luồng cần kiểm thử tích hợp, giao diện và phân quyền trước khi đánh giá phát hành.')
para('Trong phạm vi: xác thực và phân quyền, giáo trình và tiến độ, từ vựng, ôn tập, nghe chép, lịch học, tùy chọn giao diện và kiểm tra dữ liệu đầu vào quản trị. Ngoài phạm vi kết luận của lần chạy này: kiểm thử tải, bảo mật toàn diện, kiểm thử thủ công trên nhiều trình duyệt, và tích hợp thực tế các dịch vụ bên ngoài.')
heading('1.3. Phương pháp và quy trình',2)
para('Kết hợp xem xét mã nguồn và tài liệu, thiết kế kiểm thử hộp đen theo phân vùng tương đương, giá trị biên, bảng quyết định và luồng sử dụng. Quy trình đề xuất gồm phân tích yêu cầu, thiết kế TR/TC, chuẩn bị môi trường, thực thi, ghi nhận lỗi, kiểm thử lại và tổng hợp kết quả. Kết quả trong báo cáo được phân biệt giữa kiểm thử tự động đã chạy và kịch bản thủ công chưa thực thi.')
heading('1.4. Cấu trúc báo cáo',2)
para('Báo cáo gồm tám chương: tổng quan, yêu cầu, thiết kế, thực thi, quản lý lỗi, đo lường, tổ chức thực hiện và kết luận; cuối báo cáo là tài liệu tham khảo và phụ lục.')
section('CHƯƠNG 2: PHÂN TÍCH YÊU CẦU HỆ THỐNG')
heading('2.1. Yêu cầu chức năng và phi chức năng',2)
table(['Nhóm','Yêu cầu kiểm thử'],[['Tài khoản','Đăng ký, đăng nhập, khôi phục mật khẩu; xử lý phiên và tài khoản bị khóa.'],['Học tập','Chọn giáo trình/bài; học từ vựng, ngữ pháp; lưu và tiếp tục tiến độ.'],['Ôn tập','Tính điểm, lịch ôn, kết quả từ vựng, nghe chép và shadowing.'],['Cá nhân hóa','Lịch học, mục tiêu, giao diện và ngôn ngữ được lưu hợp lệ.'],['Cộng đồng và quản trị','Người học sử dụng tính năng cộng đồng; quản trị viên quản lý người dùng, nội dung và kiểm duyệt.'],['Phi chức năng','Kiểm tra quyền truy cập, khả năng phục hồi khi dịch vụ lỗi và giao diện trên trình duyệt; cần thực thi riêng để có kết luận.']])
heading('2.2. Đối tượng người dùng và phân quyền',2)
para('Người chưa đăng nhập dùng các màn hình xác thực. Người học đã đăng nhập truy cập nội dung và dữ liệu học tập của mình. Quản trị viên có thêm chức năng quản lý. Backend áp dụng kiểm tra phiên và quyền quản trị; quyền thực tế với dữ liệu còn phụ thuộc cấu hình RLS và cơ sở dữ liệu đang triển khai. Cần kiểm thử trực tiếp bằng các tài khoản khác vai trò.')
heading('2.3. Bản đồ chức năng',2)
para('Korean Study → Tài khoản → Đăng ký / Đăng nhập / Khôi phục mật khẩu; Học tập → Giáo trình / Từ vựng / Ngữ pháp / Nghe chép / Shadowing; Ôn tập → Lịch ôn / Bài luyện / Điểm; Cá nhân → Tiến độ / Lịch học / Cài đặt; Cộng đồng → Bài viết / Bộ từ; Quản trị → Người dùng / Nội dung / Kiểm duyệt.')
section('CHƯƠNG 3: THIẾT KẾ YÊU CẦU VÀ KỊCH BẢN KIỂM THỬ')
heading('3.1. Phương pháp thiết kế',2)
para('Phân vùng tương đương được áp dụng cho dữ liệu hợp lệ và sai kiểu; giá trị biên cho điểm, lịch và tập dữ liệu rỗng; bảng quyết định cho trạng thái phiên, quyền và khóa tài khoản; kiểm thử luồng cho lựa chọn bài và tiếp tục học. Các kịch bản dưới đây là danh mục đề xuất, không đồng nhất với số lượng test tự động.')
heading('3.2. Danh sách yêu cầu kiểm thử',2)
trs=[('TR-01','Xác thực','Phiên hợp lệ cho phép truy cập, phiên sai hoặc tài khoản khóa được xử lý phù hợp.'),('TR-02','Phân quyền','Người học không được thực hiện thao tác quản trị.'),('TR-03','Tiến độ','Bài vừa chọn được ưu tiên khi tiếp tục học; không ghim bài đã hoàn thành hoặc bị khóa.'),('TR-04','Từ vựng','Các từ trùng chữ vẫn giữ ghi chú và đánh dấu theo mã riêng.'),('TR-05','Ôn tập','Điểm hợp lệ, phiên rỗng bằng 0 và câu bỏ qua được tính đúng.'),('TR-06','Lịch học','Lịch nghỉ và thay đổi kế hoạch được áp dụng theo ngày hiệu lực.'),('TR-07','Nghe chép','Thử lại bài kiểm tra thất bại không giữ câu trả lời cũ.'),('TR-08','Tùy chọn','Giá trị cài đặt sai được thay bằng giá trị mặc định an toàn.'),('TR-09','Quản trị','Dữ liệu đầu vào sai kiểu hoặc thiếu trường bắt buộc bị từ chối.'),('TR-10','Tích hợp','Tiến độ, thông báo, AI và dữ liệu được kiểm tra với dịch vụ thật.')]
table(['Mã','Phân hệ','Yêu cầu'],trs)
heading('3.3. Kịch bản kiểm thử tiêu biểu',2)
cases=[('TC-01','TR-03','Đã có bài học chưa hoàn thành; chọn bài mới 0%; quay về và tiếp tục.','Mở bài vừa chọn.','Đã có test tự động tương ứng; đạt.'),('TC-02','TR-04','Tạo hai từ cùng chữ với mã khác nhau; đánh dấu và ghi chú từng từ.','Dữ liệu gắn đúng mã từ.','Đã có test tự động tương ứng; đạt.'),('TC-03','TR-05','Tính điểm phiên rỗng và câu shadowing bỏ qua.','Phiên rỗng 0 điểm; câu bỏ qua tính 0 trong mẫu số.','Đã có test tự động tương ứng; đạt.'),('TC-04','TR-06','Thiết lập lịch nghỉ cuối tuần; xét chuỗi học từ thứ Sáu đến thứ Hai.','Ngày nghỉ không làm mất chuỗi học.','Đã có test tự động tương ứng; đạt.'),('TC-05','TR-07','Hoàn thành bài nghe chép không đạt rồi chọn thử lại.','Xóa đáp án lượt kiểm tra cũ; giữ phần luyện tập.','Đã có test tự động tương ứng; đạt.'),('TC-06','TR-09','Gửi dữ liệu tạo nội dung quản trị sai kiểu hoặc thiếu trường.','Từ chối dữ liệu sai.','Đã có test tự động tương ứng; đạt.'),('TC-07','TR-02','Đăng nhập bằng tài khoản người học và gọi chức năng quản trị.','Bị từ chối; dữ liệu không thay đổi.','Chưa thực thi tích hợp.'),('TC-08','TR-10','Hoàn thành bài, tải lại trang và đăng nhập lại.','Tiến độ đã lưu được khôi phục đúng.','Chưa thực thi tích hợp.')]
for id,tr,steps,expect,result in cases:
    heading(id+' — '+tr,2); para('Điều kiện và bước thực hiện: '+steps); para('Kết quả mong đợi: '+expect); para('Kết quả thực tế / trạng thái: '+result)
section('CHƯƠNG 4: TRIỂN KHAI THỰC THI KIỂM THỬ VÀ KẾT QUẢ')
heading('4.1. Môi trường thực nghiệm',2)
para('Lần kiểm tra ngày 30/10/2026 được thực hiện trên workspace Windows. Project sử dụng React/Vite, backend Fastify/TypeScript và Supabase; bộ kiểm thử sử dụng trình chạy test của Node.js. Lần chạy đạt sử dụng Node đi kèm môi trường làm việc. Không có thông tin đã xác minh về cấu hình phần cứng, phiên bản trình duyệt hoặc môi trường Supabase thực tế.')
heading('4.2. Quy trình và kết quả thực thi',2)
para('Đã chạy toàn bộ các tệp *.test.mjs trong thư mục tests và backend/tests. Kết quả: 37 test đạt, 0 thất bại, 0 bỏ qua. Các test bao phủ những đơn vị logic như chọn bài, tiến độ dashboard, lịch học, chấm điểm, nghe chép, cache, tùy chọn và xác thực dữ liệu quản trị. Đây không phải là kiểm thử toàn bộ chức năng trên giao diện hoặc môi trường triển khai.')
para('Một lần chạy khác bằng Node 20.20.1 cho 32 test đạt và một tệp dashboardProgress.test.mjs không khởi chạy vì node:module không cung cấp registerHooks; năm test trong tệp này không được thực thi ở lần chạy đó. Cần dùng phiên bản Node hỗ trợ API này khi chạy toàn bộ bộ test. Điều này là hạn chế tương thích môi trường kiểm thử, chưa đủ căn cứ kết luận lỗi nghiệp vụ.')
heading('4.3. Bằng chứng kiểm thử',2)
para('Bằng chứng được sử dụng: kết quả chạy Node test và mã nguồn các tệp kiểm thử trong repository. Chưa có ảnh chụp phiên thao tác thủ công hoặc bằng chứng chạy trên hệ thống thật cho các kịch bản TC-07 và TC-08; nhóm cần bổ sung khi thực hiện.')
section('CHƯƠNG 5: QUẢN LÝ LỖI VÀ PHÂN TÍCH DEFECT')
heading('5.1. Quy trình quản lý lỗi',2)
para('Với mỗi lỗi được xác nhận, ghi mã lỗi, môi trường, điều kiện, các bước tái hiện, kết quả mong đợi và thực tế, bằng chứng, mức độ ảnh hưởng, người phụ trách và trạng thái. Quy trình đề xuất: Mới → Đang xử lý → Đã sửa → Kiểm thử lại → Đóng; mở lại nếu lỗi còn tái hiện.')
heading('5.2. Nhật ký lỗi',2)
para('Trong lần chạy 37 test với Node hỗ trợ registerHooks, không ghi nhận test thất bại. Chưa có dữ liệu đủ để lập danh sách lỗi chức năng đang mở. Sự không tương thích Node 20 được ghi nhận là vấn đề môi trường chạy test dưới đây, không tự động xem là defect sản phẩm.')
table(['Mã theo dõi','Hiện tượng','Trạng thái'],[['ENV-01','Node 20.20.1 không chạy được tệp dashboardProgress.test.mjs do thiếu registerHooks.','Đã xác nhận ở môi trường Node 20; chạy thành công bằng Node hỗ trợ API.']])
heading('5.3. Phân tích nguyên nhân và hướng xử lý',2)
para('ENV-01: tệp test nhập registerHooks từ node:module nhưng runtime Node 20.20.1 không xuất API đó. Đề xuất tài liệu hóa phiên bản Node tối thiểu cho bộ test hoặc điều chỉnh test để tương thích nếu project cần hỗ trợ Node 20. Đây là phân tích dựa trên thông báo lỗi; chưa xác nhận bản Node tối thiểu cụ thể.')
section('CHƯƠNG 6: ĐÁNH GIÁ KẾT QUẢ VÀ ĐO LƯỜNG')
heading('6.1. Các chỉ số kiểm thử',2)
table(['Chỉ số','Kết quả và phạm vi'],[['Tỷ lệ đạt test tự động','37/37 = 100% trong lần chạy bằng Node hỗ trợ registerHooks.'],['Kịch bản thủ công đề xuất','8 kịch bản tiêu biểu, trong đó TC-07 và TC-08 chưa được thực thi tích hợp.'],['Độ bao phủ yêu cầu','Chưa tính: chưa có ma trận đầy đủ và kết quả thực thi cho toàn bộ yêu cầu.'],['Mật độ lỗi / mức độ nghiêm trọng','Chưa tính: chưa có nhật ký lỗi đầy đủ; không xem số 0 test thất bại là số 0 lỗi sản phẩm.']])
heading('6.2. Phân tích chất lượng',2)
para('Các phép kiểm tra tự động hiện có cho thấy những quy tắc được kiểm tra đã đạt trong môi trường chạy tương thích. Tuy nhiên, các phép kiểm tra này chủ yếu ở mức đơn vị và không chứng minh các luồng xác thực, RLS, giao diện, kết nối dịch vụ hoặc môi trường production hoạt động đầy đủ.')
heading('6.3. Quyết định phát hành',2)
para('Chưa đủ cơ sở đưa ra quyết định Go/No-Go. Cần xác định tiêu chí chấp nhận, chạy kiểm thử tích hợp và thủ công đối với các luồng quan trọng, xác nhận cấu hình triển khai và rà soát các lỗi còn mở trước khi quyết định.')
section('CHƯƠNG 7: TỔ CHỨC THỰC HIỆN VÀ ĐÁNH GIÁ THÀNH VIÊN')
heading('7.1. Phân công và tiến độ',2)
para('Nhóm gồm Tạ Trần Vinh Quang, Võ Nhạc Phước và Nguyễn Danh Nghĩa theo thông tin trang bìa. Chưa có bằng chứng về phân công, thời gian và tỷ lệ hoàn thành thực tế; nhóm cần thống nhất và điền vào bảng sau.')
table(['Công việc','Người phụ trách','Thời gian / trạng thái'],[['Phân tích yêu cầu và lập kế hoạch','Nhóm bổ sung','Chưa xác nhận'],['Thiết kế TR và test case','Nhóm bổ sung','Chưa xác nhận'],['Thực thi và ghi lỗi','Nhóm bổ sung','Chưa xác nhận'],['Tổng hợp báo cáo và trình bày','Nhóm bổ sung','Chưa xác nhận']])
heading('7.2. Công cụ và nhật ký',2)
para('Công cụ đã sử dụng cho lần kiểm tra này: Node.js test runner và mã nguồn project. Ngày 30/10/2026: rà soát tài liệu, xác định phạm vi và chạy bộ test. Các mốc thực hiện khác, ảnh bằng chứng và công cụ quản lý nhóm cần được bổ sung theo thực tế.')
heading('7.3. Đánh giá mức độ hoàn thành',2)
table(['Thành viên','Nhiệm vụ thực tế','Tỷ lệ đóng góp / chữ ký'],[['Tạ Trần Vinh Quang','Nhóm bổ sung','Chưa đánh giá'],['Võ Nhạc Phước','Nhóm bổ sung','Chưa đánh giá'],['Nguyễn Danh Nghĩa','Nhóm bổ sung','Chưa đánh giá']])
section('CHƯƠNG 8: TỔNG KẾT VÀ HƯỚNG PHÁT TRIỂN')
heading('8.1. Kết luận',2)
para('Báo cáo đã chuyển phạm vi kiểm thử từ nội dung mẫu WordPress sang hệ thống Korean Study, xây dựng các yêu cầu và kịch bản đại diện, đồng thời ghi nhận 37 test tự động đạt trong môi trường phù hợp. Các kết quả này chưa đủ để đánh giá đầy đủ chất lượng toàn hệ thống hoặc xác nhận mức đạt CLO1–CLO4 khi chưa có tiêu chí và minh chứng của học phần.')
heading('8.2. Hướng phát triển',2)
para('Ưu tiên thực thi TC phân quyền và lưu tiến độ với tài khoản, cơ sở dữ liệu thử nghiệm; bổ sung bằng chứng, nhật ký lỗi và kiểm thử lại. Sau đó mở rộng kiểm thử tự động các luồng giao diện quan trọng, kiểm tra RLS và các dịch vụ tích hợp; xây dựng bộ kiểm thử hiệu năng theo mục tiêu tải cụ thể.')
section('TÀI LIỆU THAM KHẢO VÀ PHỤ LỤC')
para('[1] Repository Korean Study, README.md và mã nguồn trong workspace dự án.')
para('[2] Các tệp kiểm thử trong tests/ và backend/tests/ của project.')
para('[3] Tài liệu rà soát luồng admin và user, .docs/flow-audit-2026-10-03.md; phản ánh thời điểm rà soát, cần xác minh lại trên môi trường hiện tại.')
para('[4] MAU_BAI_LAM_BAO_CAO_KIEM_THU.md và Template báo cáo.docx do nhóm cung cấp; dùng làm khung trình bày.')
heading('Phụ lục: Hồ sơ cần bổ sung',2)
para('Ma trận TR–TC đầy đủ; ảnh chụp kết quả thao tác; nhật ký lỗi đã xác nhận; danh sách thành viên và lịch thực hiện thực tế; tiêu chí nghiệm thu và minh chứng CLO; thông tin phiên bản môi trường và cơ sở dữ liệu kiểm thử.')
out=Path(r'C:\Drive D\korean.study\Bao_cao_kiem_thu_Korean_Study.docx'); d.save(out)
print(out)

